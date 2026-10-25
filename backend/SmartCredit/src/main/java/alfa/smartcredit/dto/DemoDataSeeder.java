package alfa.smartcredit.service;

import alfa.smartcredit.dto.ApplicationFormDto;
import alfa.smartcredit.dto.ApplicationView;
import alfa.smartcredit.model.*;
import alfa.smartcredit.model.enums.ApplicationStatus;
import alfa.smartcredit.model.enums.DecisionStatus;
import alfa.smartcredit.model.enums.OfferStatus;
import alfa.smartcredit.model.enums.Role;
import alfa.smartcredit.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Locale;

/**
 * Создаёт в БД 4 демо-сценария из {@link DemoScenarioCatalog} (компания, пользователь, заявка со скорингом,
 * рекомендацией, анкетой, оффер с документами, уведомления). Идемпотентно: сценарий с существующим логином пропускается.
 * Использует настоящие ScoringService / DecisionEngine / DocumentService, поэтому данные согласованы с боевым потоком.
 * ИИ-комментарий строится по шаблону (без обращения к внешнему API при старте).
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DemoDataSeeder implements ApplicationRunner {

    private final CompanyRepository companyRepository;
    private final UserRepository userRepository;
    private final CreditApplicationRepository applicationRepository;
    private final OfferRepository offerRepository;
    private final NotificationRepository notificationRepository;
    private final ScoringService scoringService;
    private final DecisionEngine decisionEngine;
    private final AiCommentService aiCommentService;
    private final DocumentService documentService;
    private final ObjectMapper mapper;
    private final PlatformTransactionManager txManager;

    @Override
    public void run(ApplicationArguments args) {
        TransactionTemplate tx = new TransactionTemplate(txManager);
        for (DemoScenarioCatalog.Scenario s : DemoScenarioCatalog.all()) {
            if (userRepository.findByLogin(s.login()).isPresent()) continue;
            try {
                tx.executeWithoutResult(status -> seed(s));
                log.info("Демо-сценарий {} создан", s.login());
            } catch (Exception e) {
                log.error("Не удалось создать демо-сценарий {}", s.login(), e);
            }
        }
    }

    private void seed(DemoScenarioCatalog.Scenario s) {
        Instant created = Instant.now().minus(s.daysAgo(), ChronoUnit.DAYS);

        Company c = new Company();
        c.setProfileId("demo");
        c.setName(s.companyName());
        c.setInn(s.inn());
        c.setOkved(s.okved());
        c.setLegalForm(s.legalForm());
        c.setCreatedAt(created.minus(30, ChronoUnit.DAYS));
        c = companyRepository.save(c);

        User u = new User();
        u.setLogin(s.login());
        u.setPassword(DemoScenarioCatalog.PASSWORD);
        u.setRole(Role.CLIENT);
        u.setFullName(s.fullName());
        u.setDescription(s.description());
        u.setCompanyId(c.getId());
        u.setPhone(s.phone());
        u.setEmail(s.email());
        u.setDemoOrder(s.order());
        userRepository.save(u);

        ApplicationFormDto form = s.form();
        var s1 = form.step1();
        var fin = form.step2().financials();
        ScoringService.Result r = scoringService.score(c, form);
        DecisionEngine.Decision rec = decisionEngine.decide(s1.amount(), fin.monthlyRevenue(), r, s.legalForm());
        if (rec.status() != s.expected())
            throw new IllegalStateException("Сценарий " + s.login() + ": ожидалось " + s.expected()
                    + ", получено " + rec.status() + " (" + rec.reason() + ")");

        // ---- заявка (те же поля, что заполняет ApplicationService.create) ----
        CreditApplication a = new CreditApplication();
        a.setCompanyId(c.getId());
        a.setAmount(s1.amount());
        a.setTermDays(s1.termDays());
        a.setTermMonths(ProductRules.termMonthsRoundedUp(s1.termDays()));
        a.setRate(r.rate());
        a.setPurpose(s1.purpose());
        a.setBusinessTask(s1.businessTask());
        a.setBusinessScale(r.businessScale());
        a.setAnnualRevenue(fin.annualRevenue());
        a.setAverageEmployeeCount(fin.averageEmployeeCount());
        a.setRiskScore(r.internalScore());
        a.setRiskClass(r.riskClass().name());
        a.setCalculatedLimit(r.calculatedLimit());
        a.setScoringData(mapper.valueToTree(r));
        a.setRecommendation(mapper.valueToTree(
                new ApplicationView.Recommendation(rec.status(), rec.finalRate(), rec.amount(), rec.reason())));
        a.setAiComment(aiCommentService.fallback(r, rec));
        a.setStatus(ApplicationStatus.IN_REVIEW);
        a.setCreatedAt(created);
        a = applicationRepository.save(a);

        ObjectNode tree = mapper.valueToTree(form);
        ApplicationFormService.applyCompanyIdentity(tree, c);
        tree.put("applicationId", "app_2026_" + String.format("%04d", a.getId()));
        tree.put("status", "SUBMITTED");
        a.setFormData(tree);

        notify(c.getId(), String.format("Заявка №%d на %s подана и находится на рассмотрении банка.",
                a.getId(), money(s1.amount())), true, created.plus(1, ChronoUnit.MINUTES));

        // ---- решение сотрудника банка, если оно уже вынесено ----
        switch (s.stage()) {
            case OFFER_READY -> {
                BigDecimal finalRate = rec.finalRate();
                a.setOfficerComment(s.officerComment());
                a.setFinalRate(finalRate);
                a.setDecision(DecisionStatus.APPROVED);
                a.setStatus(ApplicationStatus.OFFER_READY);
                a = applicationRepository.saveAndFlush(a);

                Offer o = new Offer();
                o.setCompanyId(c.getId());
                o.setApplicationId(a.getId());
                o.setAmount(a.getAmount());
                o.setTermDays(a.getTermDays());
                o.setTermMonths(ProductRules.termMonthsRoundedUp(a.getTermDays()));
                o.setRatePercent(finalRate);
                o.setMonthlyPayment(scoringService.monthlyPayment(a.getAmount(), finalRate, a.getTermDays()));
                o.setValidUntil(LocalDate.now().plusDays(90));
                o.setStatus(OfferStatus.ACTIVE);
                o.setDocuments(mapper.valueToTree(documentService.buildDocuments(c, a, o)));
                o.setDocumentVersion("1");
                offerRepository.save(o);

                notify(c.getId(), String.format(
                        "По заявке №%d одобрено предложение: %s под %s%% на %d дн. Подпишите его в личном кабинете.",
                        a.getId(), money(a.getAmount()), pct(finalRate), a.getTermDays()),
                        false, created.plus(3, ChronoUnit.HOURS));
            }
            case DECLINED -> {
                a.setOfficerComment(s.officerComment());
                a.setDecision(DecisionStatus.DECLINED);
                a.setStatus(ApplicationStatus.DECLINED);
                applicationRepository.saveAndFlush(a);
                notify(c.getId(), String.format(
                        "По заявке №%d принято решение об отказе. Комментарий банка: %s",
                        a.getId(), s.officerComment()), false, created.plus(3, ChronoUnit.HOURS));
            }
            case IN_REVIEW -> applicationRepository.saveAndFlush(a);   // решения ещё нет: его вынесет сотрудник
        }
    }

    private void notify(Long companyId, String text, boolean read, Instant at) {
        Notification n = new Notification();
        n.setCompanyId(companyId);
        n.setText(text);
        n.setRead(read);
        n.setCreatedAt(at);
        notificationRepository.save(n);
    }

    private static String money(BigDecimal v) {
        return String.format(Locale.forLanguageTag("ru-RU"), "%,.0f ₽", v);
    }

    private static String pct(BigDecimal v) {
        return v.setScale(2, RoundingMode.HALF_UP).toPlainString();
    }
}
