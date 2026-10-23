package alfa.smartcredit.service;

import alfa.smartcredit.dto.ApplicationFormDto;
import alfa.smartcredit.dto.ApplicationView;
import alfa.smartcredit.dto.DecisionRequest;
import alfa.smartcredit.exception.ApiException;
import alfa.smartcredit.model.Company;
import alfa.smartcredit.model.CreditApplication;
import alfa.smartcredit.model.Offer;
import alfa.smartcredit.model.enums.ApplicationStatus;
import alfa.smartcredit.model.enums.DecisionStatus;
import alfa.smartcredit.model.enums.RiskClass;
import alfa.smartcredit.model.enums.OfferStatus;
import alfa.smartcredit.repository.ApplicationDraftRepository;
import alfa.smartcredit.repository.CompanyRepository;
import alfa.smartcredit.repository.CreditApplicationRepository;
import alfa.smartcredit.repository.OfferRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ApplicationService {

    private final CreditApplicationRepository applicationRepository;
    private final ApplicationDraftRepository draftRepository;
    private final CompanyRepository companyRepository;
    private final OfferRepository offerRepository;
    private final ScoringService scoringService;
    private final DecisionEngine decisionEngine;
    private final AiCommentService aiCommentService;
    private final ObjectMapper mapper;

    @Transactional
    public void setLegalForm(Long companyId, String legalForm) {
        Company c = companyRepository.findById(companyId).orElseThrow(ApiException::unauthorized);
        c.setLegalForm(legalForm);
    }

    @Transactional
    public ApplicationView create(Long companyId, ApplicationFormDto form) {
        Company company = companyRepository.findById(companyId).orElseThrow(ApiException::unauthorized);
        if (company.getLegalForm() == null)
            throw new ApiException(HttpStatus.CONFLICT, "LEGAL_FORM_REQUIRED", "Сначала выберите ИП или ООО");

        var s1 = form.step1();
        var fin = form.step2().financials();

        // 1) скоринг (Группы 2-3 ТЗ) и 2) РЕКОМЕНДАЦИЯ DecisionEngine. Итоговое решение выносит сотрудник банка.
        ScoringService.Result r = scoringService.score(company, form);
        DecisionEngine.Decision rec = decisionEngine.decide(s1.amount(), fin.monthlyRevenue(), r);
        if (rec.status() == DecisionStatus.INFO_REQUIRED)
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "INFO_REQUIRED", rec.reason());

        CreditApplication a = new CreditApplication();
        a.setCompanyId(companyId);
        a.setAmount(s1.amount());
        a.setTermDays(s1.termDays());
        a.setTermMonths(ProductRules.termMonthsRoundedUp(s1.termDays()));   // legacy-колонка NOT NULL
        a.setRate(r.rate());
        a.setPurpose(s1.purpose());
        a.setBusinessTask(s1.businessTask());

        a.setRiskScore(r.internalScore());
        a.setRiskClass(r.riskClass().name());
        a.setCalculatedLimit(r.calculatedLimit());
        a.setScoringData(mapper.valueToTree(r));
        a.setRecommendation(mapper.valueToTree(
                new ApplicationView.Recommendation(rec.status(), rec.finalRate(), rec.amount(), rec.reason())));
        a.setAiComment(aiCommentService.comment(r, rec, s1.amount(), s1.termDays()));

        // независимо от класса A/B/C и рекомендации заявка идёт к сотруднику; decision/finalRate/offer появятся после его решения
        a.setStatus(ApplicationStatus.IN_REVIEW);
        a = applicationRepository.save(a);

        // сохраняем форму целиком, но личность заявителя берём у сервера, не у клиента
        ObjectNode tree = mapper.valueToTree(form);
        ApplicationFormService.applyCompanyIdentity(tree, company);
        tree.put("applicationId", "app_2026_" + String.format("%04d", a.getId()));
        tree.put("status", "SUBMITTED");
        a.setFormData(tree);
        applicationRepository.saveAndFlush(a);
        draftRepository.deleteByCompanyId(companyId);

        return toView(a, company, false);
    }

    @Transactional(readOnly = true)
    public JsonNode getFormForBank(Long id) {
        JsonNode f = find(id).getFormData();
        if (f == null) throw ApiException.notFound("Для этой заявки нет анкеты (демо-данные)");
        return f;
    }

    @Transactional(readOnly = true)
    public List<ApplicationView> forCompany(Long companyId) {
        Company c = companyRepository.findById(companyId).orElseThrow(ApiException::unauthorized);
        return applicationRepository.findAllByOrderByCreatedAtDesc().stream()
                .filter(a -> a.getCompanyId().equals(companyId))
                .map(a -> toView(a, c, false)).toList();
    }

    @Transactional(readOnly = true)
    public List<ApplicationView> allForBank() {
        Map<Long, Company> companies = companyRepository.findAll().stream()
                .collect(Collectors.toMap(Company::getId, Function.identity()));
        return applicationRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(a -> toView(a, companies.get(a.getCompanyId()), true)).toList();
    }

    @Transactional(readOnly = true)
    public ApplicationView getForBank(Long id) {
        CreditApplication a = find(id);
        return toView(a, companyRepository.findById(a.getCompanyId()).orElseThrow(), true);
    }

    @Transactional
    public ApplicationView decide(Long id, DecisionRequest req) {
        CreditApplication a = find(id);
        if (a.getStatus() != ApplicationStatus.IN_REVIEW)
            throw new ApiException(HttpStatus.CONFLICT, "ALREADY_DECIDED", "По заявке уже принято решение");
        a.setOfficerComment(req.comment());

        ApplicationView.Recommendation rec = a.getRecommendation() == null ? null
                : mapper.treeToValue(a.getRecommendation(), ApplicationView.Recommendation.class);

        switch (req.action()) {
            case DECLINE -> a.setStatus(ApplicationStatus.DECLINED);
            case APPROVE -> {
                // запрошенные клиентом условия; ставка из рекомендации (rate + премия класса + отраслевая) или расчёт заново
                int termDays = termDaysOf(a);
                BigDecimal finalRate = rec != null && rec.finalRate() != null ? rec.finalRate() : manualFinalRate(a, termDays);
                createOffer(a, a.getAmount(), termDays, finalRate);
                a.setFinalRate(finalRate);
                a.setStatus(ApplicationStatus.OFFER_READY);
            }
            case OFFER_ALTERNATIVE -> {
                // что не передано менеджером, берём из рекомендации системы, иначе из заявки
                int termDays = req.termDays() != null ? req.termDays() : termDaysOf(a);
                BigDecimal amount = req.amount() != null ? req.amount()
                        : rec != null && rec.amount() != null ? rec.amount()
                        : a.getAmount().min(a.getCalculatedLimit() != null ? a.getCalculatedLimit() : a.getAmount());
                BigDecimal finalRate = req.finalRate() != null ? req.finalRate()
                        : rec != null && rec.finalRate() != null ? rec.finalRate() : manualFinalRate(a, termDays);
                createOffer(a, amount, termDays, finalRate);
                a.setFinalRate(finalRate);
                a.setStatus(ApplicationStatus.OFFER_READY);
            }
        }
        a.setDecision(switch (req.action()) {
            case DECLINE -> DecisionStatus.DECLINED;
            case APPROVE -> DecisionStatus.APPROVED;
            case OFFER_ALTERNATIVE -> DecisionStatus.ALTERNATIVE_OFFER;
        });
        return toView(a, companyRepository.findById(a.getCompanyId()).orElseThrow(), true);
    }

    @Transactional
    public void signOffer(Long companyId, Long offerId) {
        Offer o = offerRepository.findById(offerId).orElseThrow(() -> ApiException.notFound("Предложение не найдено"));
        if (!o.getCompanyId().equals(companyId)) throw ApiException.forbidden();
        if (o.getStatus() != OfferStatus.ACTIVE)
            throw new ApiException(HttpStatus.CONFLICT, "OFFER_NOT_ACTIVE", "Предложение уже неактуально");
        o.setStatus(OfferStatus.ACCEPTED);
        find(o.getApplicationId()).setStatus(ApplicationStatus.ACCEPTED);
        // TODO: здесь же можно создать Loan + график платежей
    }

    // ---------- helpers ----------

    private CreditApplication find(Long id) {
        return applicationRepository.findById(id).orElseThrow(() -> ApiException.notFound("Заявка не найдена"));
    }

    private int termDaysOf(CreditApplication a) {
        if (a.getTermDays() != null) return a.getTermDays();
        return a.getTermMonths() * ProductRules.DAYS_IN_MONTH;   // старые демо-строки
    }

    /** finalRate при ручном APPROVE (для MANUAL_REVIEW автоматом ставка не считается): rate + премия класса + отраслевая. */
    private BigDecimal manualFinalRate(CreditApplication a, int termDays) {
        Company c = companyRepository.findById(a.getCompanyId()).orElseThrow();
        BigDecimal rate = a.getRate() != null ? a.getRate() : ProductRules.baseRate(termDays);
        return decisionEngine.finalRate(rate, RiskClass.parse(a.getRiskClass()),
                IndustryDirectory.byOkved(c.getOkved()).ratePremium());
    }

    private void createOffer(CreditApplication a, BigDecimal amount, int termDays, BigDecimal finalRate) {
        Offer o = new Offer();
        o.setCompanyId(a.getCompanyId());
        o.setApplicationId(a.getId());
        o.setAmount(amount);
        o.setTermDays(termDays);
        o.setTermMonths(ProductRules.termMonthsRoundedUp(termDays));   // legacy-колонка NOT NULL
        o.setRatePercent(finalRate);
        o.setMonthlyPayment(scoringService.monthlyPayment(amount, finalRate, termDays));
        o.setValidUntil(LocalDate.now().plusDays(14));
        o.setStatus(OfferStatus.ACTIVE);
        offerRepository.save(o);
    }

    /** forBank=false: клиенту не отдаём bkiZone, данные БКИ/ФНС и разбивку баллов (ТЗ: bkiZone только для менеджера). */
    private ApplicationView toView(CreditApplication a, Company c, boolean forBank) {
        ApplicationView.OfferView offer = offerRepository.findFirstByApplicationIdOrderByIdDesc(a.getId())
                .map(o -> new ApplicationView.OfferView(o.getId(), o.getAmount(),
                        o.getTermDays() != null ? o.getTermDays() : o.getTermMonths() * ProductRules.DAYS_IN_MONTH,
                        o.getRatePercent(), o.getMonthlyPayment(), o.getValidUntil(), o.getStatus().name()))
                .orElse(null);

        ScoringService.Result scoring = a.getScoringData() == null ? null
                : mapper.treeToValue(a.getScoringData(), ScoringService.Result.class);
        if (scoring != null && !forBank) scoring = scoring.forClient();

        // рекомендация системы и ИИ-комментарий видит только сотрудник банка
        ApplicationView.Recommendation recommendation = !forBank || a.getRecommendation() == null ? null
                : mapper.treeToValue(a.getRecommendation(), ApplicationView.Recommendation.class);

        return new ApplicationView(a.getId(), c.getName(), c.getInn(), c.getLegalForm(),
                a.getAmount(), termDaysOf(a), a.getRate(), a.getPurpose(), a.getBusinessTask(),
                a.getStatus().name(), a.getDecision() == null ? null : a.getDecision().name(), a.getFinalRate(),
                a.getRiskScore(), a.getRiskClass(), forBank ? a.getAiComment() : null, a.getOfficerComment(),
                a.getCreatedAt(), scoring, recommendation, offer);
    }
}
