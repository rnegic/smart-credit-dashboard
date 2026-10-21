package alfa.smartcredit.service;

import alfa.smartcredit.dto.ApplicationView;
import alfa.smartcredit.dto.CreateApplicationRequest;
import alfa.smartcredit.dto.DecisionRequest;
import alfa.smartcredit.exception.ApiException;
import alfa.smartcredit.model.Company;
import alfa.smartcredit.model.CreditApplication;
import alfa.smartcredit.model.Offer;
import alfa.smartcredit.model.enums.ApplicationStatus;
import alfa.smartcredit.model.enums.OfferStatus;
import alfa.smartcredit.repository.CompanyRepository;
import alfa.smartcredit.repository.CreditApplicationRepository;
import alfa.smartcredit.repository.OfferRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ApplicationService {

    private final CreditApplicationRepository applicationRepository;
    private final CompanyRepository companyRepository;
    private final OfferRepository offerRepository;
    private final ScoringService scoringService;

    @Transactional
    public void setLegalForm(Long companyId, String legalForm) {
        Company c = companyRepository.findById(companyId).orElseThrow(ApiException::unauthorized);
        c.setLegalForm(legalForm);
    }

    @Transactional
    public ApplicationView create(Long companyId, CreateApplicationRequest req) {
        Company company = companyRepository.findById(companyId).orElseThrow(ApiException::unauthorized);
        if (company.getLegalForm() == null)
            throw new ApiException(HttpStatus.CONFLICT, "LEGAL_FORM_REQUIRED", "Сначала выберите ИП или ООО");

        CreditApplication a = new CreditApplication();
        a.setCompanyId(companyId);
        a.setAmount(req.amount());
        a.setTermMonths(req.termMonths());
        a.setPurpose(req.purpose());
        a.setStatus(ApplicationStatus.IN_REVIEW);

        ScoringService.Result r = scoringService.score(company, req.amount(), req.termMonths());
        a.setRiskScore(r.score());
        a.setRiskClass(r.riskClass());
        a.setAiComment(r.comment());
        return toView(applicationRepository.save(a), company);
    }

    @Transactional(readOnly = true)
    public List<ApplicationView> forCompany(Long companyId) {
        Company c = companyRepository.findById(companyId).orElseThrow(ApiException::unauthorized);
        return applicationRepository.findAllByOrderByCreatedAtDesc().stream()
                .filter(a -> a.getCompanyId().equals(companyId))
                .map(a -> toView(a, c)).toList();
    }

    @Transactional(readOnly = true)
    public List<ApplicationView> allForBank() {
        Map<Long, Company> companies = companyRepository.findAll().stream()
                .collect(Collectors.toMap(Company::getId, Function.identity()));
        return applicationRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(a -> toView(a, companies.get(a.getCompanyId()))).toList();
    }

    @Transactional(readOnly = true)
    public ApplicationView getForBank(Long id) {
        CreditApplication a = find(id);
        return toView(a, companyRepository.findById(a.getCompanyId()).orElseThrow());
    }

    @Transactional
    public ApplicationView decide(Long id, DecisionRequest req) {
        CreditApplication a = find(id);
        if (a.getStatus() != ApplicationStatus.IN_REVIEW)
            throw new ApiException(HttpStatus.CONFLICT, "ALREADY_DECIDED", "По заявке уже принято решение");
        a.setOfficerComment(req.comment());

        switch (req.action()) {
            case DECLINE -> a.setStatus(ApplicationStatus.DECLINED);
            case APPROVE -> {
                createOffer(a, a.getAmount(), a.getTermMonths(), rateByClass(a.getRiskClass()));
                a.setStatus(ApplicationStatus.OFFER_READY);
            }
            case OFFER_ALTERNATIVE -> {
                if (req.amount() == null || req.termMonths() == null || req.ratePercent() == null)
                    throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR",
                            "Для альтернативы нужны amount, termMonths, ratePercent");
                createOffer(a, req.amount(), req.termMonths(), req.ratePercent());
                a.setStatus(ApplicationStatus.OFFER_READY);
            }
        }
        return toView(a, companyRepository.findById(a.getCompanyId()).orElseThrow());
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

    private BigDecimal rateByClass(String cls) {
        return new BigDecimal(switch (cls == null ? "D" : cls) {
            case "A" -> "14.00"; case "B" -> "17.00"; case "C" -> "21.00"; default -> "25.00";
        });
    }

    private void createOffer(CreditApplication a, BigDecimal amount, int term, BigDecimal rate) {
        Offer o = new Offer();
        o.setCompanyId(a.getCompanyId());
        o.setApplicationId(a.getId());
        o.setAmount(amount);
        o.setTermMonths(term);
        o.setRatePercent(rate);
        o.setMonthlyPayment(annuity(amount, rate, term));
        o.setValidUntil(LocalDate.now().plusDays(14));
        o.setStatus(OfferStatus.ACTIVE);
        offerRepository.save(o);
    }

    /** Аннуитетный платёж: P * r / (1 - (1+r)^-n), r = ставка/12 */
    private BigDecimal annuity(BigDecimal principal, BigDecimal ratePercent, int months) {
        double r = ratePercent.doubleValue() / 100 / 12;
        double p = principal.doubleValue() * r / (1 - Math.pow(1 + r, -months));
        return BigDecimal.valueOf(p).setScale(2, RoundingMode.HALF_UP);
    }

    private ApplicationView toView(CreditApplication a, Company c) {
        ApplicationView.OfferView offer = offerRepository.findFirstByApplicationIdOrderByIdDesc(a.getId())
                .map(o -> new ApplicationView.OfferView(o.getId(), o.getAmount(), o.getTermMonths(),
                        o.getRatePercent(), o.getMonthlyPayment(), o.getValidUntil(), o.getStatus().name()))
                .orElse(null);
        return new ApplicationView(a.getId(), c.getName(), c.getInn(), c.getLegalForm(),
                a.getAmount(), a.getTermMonths(), a.getPurpose(), a.getStatus().name(),
                a.getRiskScore(), a.getRiskClass(), a.getAiComment(), a.getOfficerComment(),
                a.getCreatedAt(), offer);
    }
}
