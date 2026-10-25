package alfa.smartcredit.service;

import alfa.smartcredit.dto.*;
import alfa.smartcredit.event.ApplicationStatusChangedEvent;
import alfa.smartcredit.exception.ApiException;
import alfa.smartcredit.model.Company;
import alfa.smartcredit.model.CreditApplication;
import alfa.smartcredit.model.Offer;
import alfa.smartcredit.model.User;
import alfa.smartcredit.model.enums.ApplicationStatus;
import alfa.smartcredit.model.enums.DecisionStatus;
import alfa.smartcredit.model.enums.RiskClass;
import alfa.smartcredit.model.enums.OfferStatus;
import alfa.smartcredit.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.Period;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
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
    private final ApplicationEventPublisher eventPublisher;
    private final DocumentService documentService;
    private final UserRepository userRepository;

    @Transactional
    public void setLegalForm(Long companyId, String legalForm) {
        Company c = companyRepository.findById(companyId).orElseThrow(ApiException::unauthorized);
        c.setLegalForm(legalForm);
    }

    // ... (импорты)
    @Transactional
    public ApplicationView create(Long companyId, ApplicationFormDto form) {
        Company company = companyRepository.findById(companyId).orElseThrow(ApiException::unauthorized);
        if (company.getLegalForm() == null)
            throw new ApiException(HttpStatus.CONFLICT, "LEGAL_FORM_REQUIRED", "Сначала выберите ИП или ООО");

        var s1 = form.step1();
        var fin = form.step2().financials();
        var appData = form.step2().applicant();

        // 1) Скоринг
        ScoringService.Result r = scoringService.score(company, form);
        DecisionEngine.Decision rec = decisionEngine.decide(s1.amount(), fin.monthlyRevenue(), r, company.getLegalForm());

        if (rec.status() == DecisionStatus.INFO_REQUIRED)
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "INFO_REQUIRED", rec.reason());

        CreditApplication a = new CreditApplication();
        a.setCompanyId(companyId);
        a.setAmount(s1.amount());
        a.setTermDays(s1.termDays());
        a.setTermMonths(ProductRules.termMonthsRoundedUp(s1.termDays()));
        a.setRate(r.rate());
        a.setPurpose(s1.purpose());
        a.setBusinessTask(s1.businessTask());

        // Сохраняем поля ООО
        a.setBusinessScale(r.businessScale());
        a.setAnnualRevenue(fin.annualRevenue());
        a.setAverageEmployeeCount(fin.averageEmployeeCount());

        a.setRiskScore(r.internalScore());
        a.setRiskClass(r.riskClass().name());
        a.setCalculatedLimit(r.calculatedLimit());
        a.setScoringData(mapper.valueToTree(r));
        a.setRecommendation(mapper.valueToTree(
                new ApplicationView.Recommendation(rec.status(), rec.finalRate(), rec.amount(), rec.reason())));
        a.setAiComment(aiCommentService.comment(r, rec, s1.amount(), s1.termDays()));

        a.setStatus(ApplicationStatus.IN_REVIEW);
        a = applicationRepository.save(a);

        // Сохраняем форму
        ObjectNode tree = mapper.valueToTree(form);
        ApplicationFormService.applyCompanyIdentity(tree, company);
        // Добавляем ОГРН и КПП в форму, если их не было (мок)
        if ("OOO".equals(company.getLegalForm())) {
            ObjectNode applicantNode = (ObjectNode) tree.at("/step2_businessData/applicant");
            applicantNode.put("ogrn", "1157746" + String.format("%06d", a.getId()));
            applicantNode.put("kpp", "770101001");
        }

        tree.put("applicationId", "app_2026_" + String.format("%04d", a.getId()));
        tree.put("status", "SUBMITTED");
        a.setFormData(tree);
        applicationRepository.saveAndFlush(a);
        draftRepository.deleteByCompanyId(companyId);

        eventPublisher.publishEvent(new ApplicationStatusChangedEvent(
                companyId, a.getId(), ApplicationStatus.IN_REVIEW.name(),
                String.format("Заявка №%d на %s подана и находится на рассмотрении банка.",
                        a.getId(), money(s1.amount()))));

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
                BigDecimal finalRate = req.finalRate() != null ? req.finalRate()
                        : rec != null && rec.finalRate() != null ? rec.finalRate() : manualFinalRate(a, termDays);
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
        // строим сообщение под фактическое состояние
        String text = switch (a.getStatus()) {
            case DECLINED -> String.format(
                    "По заявке №%d принято решение об отказе. Комментарий банка: %s",
                    a.getId(), req.comment());
            case OFFER_READY -> String.format(
                    "По заявке №%d одобрено предложение: %s под %s%% на %d дн. Подпишите его в личном кабинете.",
                    a.getId(), money(a.getFinalRate() != null ? offerAmount(a.getId()) : a.getAmount()),
                    pct(a.getFinalRate()), termDaysOf(a));
            default -> null;
        };
        if (text != null) {
            eventPublisher.publishEvent(new ApplicationStatusChangedEvent(
                    a.getCompanyId(), a.getId(), a.getStatus().name(), text));
        }

        return toView(a, companyRepository.findById(a.getCompanyId()).orElseThrow(), true);
    }

    @Transactional
    public ApplicationView acceptOffer(Long companyId, Long offerId) {
        Offer o = offerRepository.findForUpdate(offerId)
                .orElseThrow(() -> ApiException.notFound("Предложение не найдено"));
        if (!o.getCompanyId().equals(companyId)) throw ApiException.forbidden();
        Company company = companyRepository.findById(companyId).orElseThrow(ApiException::unauthorized);
        CreditApplication a = find(o.getApplicationId());

        // идемпотентно: уже принято / уже подписано
        if (a.getStatus() == ApplicationStatus.SIGNATURE_PENDING && o.getStatus() == OfferStatus.ACCEPTED)
            return toView(a, company, false);
        if (a.getStatus() == ApplicationStatus.ACCEPTED)
            return toView(a, company, false);

        if (a.getStatus() != ApplicationStatus.OFFER_READY)
            throw new ApiException(HttpStatus.CONFLICT, "INVALID_STAGE",
                    "Принятие предложения доступно только на этапе предложения");
        if (o.getStatus() != OfferStatus.ACTIVE)
            throw new ApiException(HttpStatus.CONFLICT, "OFFER_NOT_ACTIVE", "Предложение уже неактуально");
        if (o.getValidUntil() == null || o.getValidUntil().isBefore(LocalDate.now()))
            throw new ApiException(HttpStatus.CONFLICT, "OFFER_EXPIRED", "Срок действия предложения истёк");

        if (!hasCompleteDocuments(o)) {
            o.setDocuments(mapper.valueToTree(documentService.buildDocuments(company, a, o)));
            o.setDocumentVersion("1");
        }
        o.setStatus(OfferStatus.ACCEPTED);
        a.setStatus(ApplicationStatus.SIGNATURE_PENDING);

        eventPublisher.publishEvent(new ApplicationStatusChangedEvent(
                companyId, a.getId(), ApplicationStatus.SIGNATURE_PENDING.name(),
                String.format("Предложение по заявке №%d принято. Подпишите документы.", a.getId())));

        return toView(a, company, false);
    }

    @Transactional(readOnly = true)
    public DocumentsResponse getDocuments(Long companyId, Long applicationId) {
        CreditApplication a = find(applicationId);
        if (!a.getCompanyId().equals(companyId)) throw ApiException.forbidden();
        Offer o = offerRepository.findFirstByApplicationIdOrderByIdDesc(applicationId).orElse(null);
        if (o == null) {
            return new DocumentsResponse(applicationId, null, null,
                    List.of(), false, null, null, true);
        }
        return toDocumentsResponse(a, o);
    }

    @Transactional
    public DocumentsResponse signOffer(Long companyId, Long userId, Long offerId, SignRequest req) {
        Offer o = offerRepository.findForUpdate(offerId)
                .orElseThrow(() -> ApiException.notFound("Предложение не найдено"));
        if (!o.getCompanyId().equals(companyId)) throw ApiException.forbidden();
        CreditApplication a = find(o.getApplicationId());
        User signer = userRepository.findById(userId).orElseThrow(ApiException::unauthorized);

        // Идемпотентность: повторный запрос возвращает сохранённый результат
        if (o.getSignedAt() != null) {
            return toDocumentsResponse(a, o);
        }

        if (a.getStatus() != ApplicationStatus.SIGNATURE_PENDING)
            throw new ApiException(HttpStatus.CONFLICT, "INVALID_STAGE",
                    "Подписание доступно только на этапе подписания документов");
        if (o.getStatus() != OfferStatus.ACCEPTED)
            throw new ApiException(HttpStatus.CONFLICT, "OFFER_NOT_ACCEPTED",
                    "Сначала примите условия предложения");
        if (o.getValidUntil() == null || o.getValidUntil().isBefore(LocalDate.now()))
            throw new ApiException(HttpStatus.CONFLICT, "OFFER_EXPIRED", "Срок действия предложения истёк");
        if (!hasCompleteDocuments(o))
            throw new ApiException(HttpStatus.CONFLICT, "NO_DOCUMENTS", "Документы не сформированы");
        if (!Boolean.TRUE.equals(req.confirmed()))
            throw new ApiException(HttpStatus.BAD_REQUEST, "NOT_CONFIRMED",
                    "Необходимо подтвердить ознакомление с документами");
        if (!o.getDocumentVersion().equals(req.documentVersion()))
            throw new ApiException(HttpStatus.CONFLICT, "DOCUMENT_VERSION_MISMATCH",
                    "Версия документов устарела, обновите страницу");
        if (signer.getFullName() == null || signer.getFullName().isBlank())
            throw new ApiException(HttpStatus.BAD_REQUEST, "SIGNER_NAME_REQUIRED",
                    "Для подписания заполните ФИО в профиле");

        o.setSignedAt(Instant.now());
        o.setSignedById(signer.getId());
        o.setSignedByFullName(signer.getFullName());
        a.setStatus(ApplicationStatus.ACCEPTED);

        eventPublisher.publishEvent(new ApplicationStatusChangedEvent(
                companyId, a.getId(), ApplicationStatus.ACCEPTED.name(),
                String.format("Документы по заявке №%d подписаны. Кредит будет оформлен.", a.getId())));

        return toDocumentsResponse(a, o);
    }

    private DocumentsResponse toDocumentsResponse(CreditApplication a, Offer o) {
        List<DocumentDto> docs = new ArrayList<>();
        if (o.getDocuments() != null && o.getDocuments().isArray()) {
            for (JsonNode n : o.getDocuments()) {
                docs.add(new DocumentDto(
                        n.path("type").asText(),
                        n.path("title").asText(),
                        n.path("content").asText()));
            }
        }
        boolean signingAllowed = o.getSignedAt() == null
                && a.getStatus() == ApplicationStatus.SIGNATURE_PENDING
                && o.getStatus() == OfferStatus.ACCEPTED
                && o.getValidUntil() != null && !o.getValidUntil().isBefore(LocalDate.now())
                && hasCompleteDocuments(o);
        DocumentsResponse.Signer signedBy = o.getSignedAt() != null && o.getSignedById() != null
                ? new DocumentsResponse.Signer(o.getSignedById(), o.getSignedByFullName())
                : null;
        return new DocumentsResponse(a.getId(), o.getId(), o.getDocumentVersion(),
                docs, signingAllowed, o.getSignedAt(), signedBy, true);
    }

    // ---------- helpers ----------

    /** Only a complete, versioned pair of documents can be signed. */
    private boolean hasCompleteDocuments(Offer offer) {
        JsonNode docs = offer.getDocuments();
        if (offer.getDocumentVersion() == null || offer.getDocumentVersion().isBlank()
                || docs == null || !docs.isArray() || docs.size() != 2) return false;
        boolean agreement = false, terms = false;
        for (JsonNode doc : docs) {
            if (doc.path("title").asText().isBlank() || doc.path("content").asText().isBlank()) return false;
            String type = doc.path("type").asText();
            if ("OVERDRAFT_AGREEMENT".equals(type) && !agreement) agreement = true;
            else if ("INDIVIDUAL_TERMS".equals(type) && !terms) terms = true;
            else return false;
        }
        return agreement && terms;
    }

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

        // ИП: ставка зависит только от срока; ООО: от масштаба и срока. Масштаб берём из заявки (для ИП его нет).
        BigDecimal rate = a.getRate() != null
                ? a.getRate()
                : ProductRules.baseRate(c.getLegalForm(), a.getBusinessScale(), termDays);

        return decisionEngine.finalRate(rate, RiskClass.parse(a.getRiskClass()),
                IndustryDirectory.byOkved(c.getOkved()).ratePremium());
    }

    private void createOffer(CreditApplication a, BigDecimal amount, int termDays, BigDecimal finalRate) {
        if (finalRate == null)
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "FINAL_RATE_REQUIRED",
                    "Для этой заявки нет расчётной ставки. Укажите итоговую годовую ставку вручную, чтобы одобрить заявку или предложить другие условия.");
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
        Company company = companyRepository.findById(a.getCompanyId())
                .orElseThrow(() -> ApiException.notFound("Компания не найдена"));
        o.setDocuments(mapper.valueToTree(documentService.buildDocuments(company, a, o)));
        o.setDocumentVersion("1");
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

        ApplicationView.Recommendation recommendation = !forBank || a.getRecommendation() == null ? null
                : mapper.treeToValue(a.getRecommendation(), ApplicationView.Recommendation.class);

        // Срок существования компании: считаем на текущий момент (now - registrationDate).
        // Видит только сотрудник банка. Источник даты регистрации — ExternalDataService (мок ЕГРЮЛ/ЕГРИП),
        // в проде заменяется на реальный вызов.
        ApplicationView.CompanyAge companyAge = null;
        if (forBank) {
            LocalDate reg = ExternalDataService.registrationDate(c.getInn());
            LocalDate today = LocalDate.now();
            if (reg != null && !reg.isAfter(today)) {
                Period p = Period.between(reg, today);
                long totalDays = ChronoUnit.DAYS.between(reg, today);
                companyAge = new ApplicationView.CompanyAge(reg, p.getYears(), p.getMonths(), p.getDays(), totalDays);
            }
        }

        return new ApplicationView(a.getId(), c.getName(), c.getInn(), c.getLegalForm(),
                a.getAmount(), termDaysOf(a), a.getRate(), a.getPurpose(), a.getBusinessTask(),
                a.getStatus().name(), a.getDecision() == null ? null : a.getDecision().name(), a.getFinalRate(),
                a.getRiskScore(), a.getRiskClass(), forBank ? a.getAiComment() : null, a.getOfficerComment(),
                a.getCreatedAt(), scoring, recommendation, offer, companyAge);
    }
    private BigDecimal offerAmount(Long applicationId) {
        return offerRepository.findFirstByApplicationIdOrderByIdDesc(applicationId)
                .map(Offer::getAmount).orElse(BigDecimal.ZERO);
    }
    private static String money(BigDecimal v) {
        return String.format(java.util.Locale.forLanguageTag("ru-RU"), "%,.0f ₽", v);
    }
    private static String pct(BigDecimal v) {
        return v == null ? "—" : v.setScale(2, java.math.RoundingMode.HALF_UP).toPlainString();
    }
    @Transactional(readOnly = true)
    public String suggestComment(Long id, CommentSuggestionRequest req) {
        CreditApplication a = find(id);
        if (a.getStatus() != ApplicationStatus.IN_REVIEW)
            throw new ApiException(HttpStatus.CONFLICT, "ALREADY_DECIDED",
                    "По заявке уже принято решение");

        ScoringService.Result r = null;
        if (a.getScoringData() != null) {
            try {
                r = mapper.treeToValue(a.getScoringData(), ScoringService.Result.class);
            } catch (Exception e) {
                // Если не удалось распарсить, работаем без данных скоринга
            }
        }
        return aiCommentService.commentForOfficer(r, a.getAmount(), a.getTermDays(), req);
    }
}
