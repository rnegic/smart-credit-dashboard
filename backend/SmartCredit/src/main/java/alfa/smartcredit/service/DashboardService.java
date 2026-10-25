package alfa.smartcredit.service;

import alfa.smartcredit.dto.ContractView;
import alfa.smartcredit.dto.DashboardResponse;
import alfa.smartcredit.exception.ApiException;
import alfa.smartcredit.model.Company;
import alfa.smartcredit.model.CreditApplication;
import alfa.smartcredit.model.Loan;
import alfa.smartcredit.model.Payment;
import alfa.smartcredit.model.enums.ApplicationStatus;
import alfa.smartcredit.model.enums.LoanStatus;
import alfa.smartcredit.model.enums.OfferStatus;
import alfa.smartcredit.model.enums.PaymentStatus;
import alfa.smartcredit.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final CompanyRepository companyRepository;
    private final CreditApplicationRepository applicationRepository;
    private final OfferRepository offerRepository;
    private final LoanRepository loanRepository;
    private final PaymentRepository paymentRepository;
    private final NotificationRepository notificationRepository;
    private final ExternalDataService externalDataService;
    private final ContractService contractService;

    @Transactional(readOnly = true)
    public DashboardResponse build(Long companyId) {
        Company company = companyRepository.findById(companyId)
                .orElseThrow(ApiException::unauthorized);   // песочницу уже почистили

        CreditApplication app = applicationRepository
                .findFirstByCompanyIdOrderByCreatedAtDesc(companyId).orElse(null);

        List<DashboardResponse.OfferDto> offers = offerRepository
                .findByCompanyIdAndStatus(companyId, OfferStatus.ACTIVE).stream()
                .map(o -> new DashboardResponse.OfferDto(o.getId(), o.getAmount(), termDays(o.getTermDays(), o.getTermMonths()),
                        o.getContractTermMonths(),
                        o.getRatePercent(), o.getMonthlyPayment(), o.getValidUntil()))
                .toList();

        Loan loan = loanRepository.findFirstByCompanyIdAndStatus(companyId, LoanStatus.ACTIVE).orElse(null);
        Payment next = loan == null ? null : paymentRepository
                .findFirstByLoanIdAndStatusOrderByDueDateAsc(loan.getId(), PaymentStatus.PENDING).orElse(null);

        ExternalDataService.ExternalData demo = externalDataService.fetch(company);
        ContractView contract = contractService.findActive(companyId);

        return new DashboardResponse(
                new DashboardResponse.CompanyDto(company.getId(), company.getName(),
                        company.getInn(), company.getOkved(), company.getLegalForm(),
                        new DashboardResponse.ExternalDemoDto(demo.bkiScore(), demo.delinquencies12m(),
                                demo.inquiries12m(), demo.revenueTrend(), demo.companyAgeYears())),
                app == null ? null : new DashboardResponse.ApplicationDto(
                        app.getId(), app.getAmount(), termDays(app.getTermDays(), app.getTermMonths()),
                        app.getContractTermMonths(),
                        app.getRate(), app.getPurpose(), app.getStatus().name(),
                        app.getDecision() == null ? null : app.getDecision().name(),
                        app.getFinalRate(), app.getBusinessScale() != null ? app.getBusinessScale().name() : null,
                        app.getCreatedAt()
                ),
                buildStages(app),
                buildActions(app, contract),
                offers,
                contract,
                loan == null ? null : new DashboardResponse.LoanDto(loan.getId(), loan.getPrincipal(),
                        loan.getRatePercent(), loan.getTermMonths(), loan.getMonthlyPayment(),
                        loan.getRemainingBalance(), loan.getStartDate()),
                next == null ? null : new DashboardResponse.PaymentDto(next.getId(), next.getDueDate(), next.getAmount()),
                notificationRepository.countByCompanyIdAndReadFalse(companyId)
        );
    }

    /** Для старых строк без term_days: приблизительно месяцы * 30. */
    private static Integer termDays(Integer termDays, Integer termMonths) {
        return termDays != null ? termDays : (termMonths == null ? null : termMonths * 30);
    }

    private List<DashboardResponse.StageDto> buildStages(CreditApplication app) {
        String[][] defs = {
                {"SUBMITTED", "Заявка подана"},
                {"REVIEW",    "Рассмотрение банком"},
                {"OFFER",     "Предложение банка"},
                {"SIGNING",   "Подписание документов"},
                {"ISSUED",    "Выдача кредита"}
        };
        int current = app == null ? 0 : switch (app.getStatus()) {
            case IN_REVIEW         -> 1;
            case OFFER_READY       -> 2;
            case SIGNATURE_PENDING -> 3;
            case DECLINED          -> 2;
            case ACCEPTED          -> 5;   // все этапы пройдены
        };
        List<DashboardResponse.StageDto> result = new ArrayList<>();
        for (int i = 0; i < defs.length; i++) {
            String state = i < current ? "DONE" : (i == current ? "CURRENT" : "PENDING");
            result.add(new DashboardResponse.StageDto(defs[i][0], defs[i][1], state));
        }
        return result;
    }

    private List<DashboardResponse.ActionDto> buildActions(CreditApplication app, ContractView contract) {
        List<DashboardResponse.ActionDto> actions = new ArrayList<>();
        if (app == null) {
            actions.add(new DashboardResponse.ActionDto("CREATE_APPLICATION", "Подать заявку на кредит"));
        } else if (app.getStatus() == ApplicationStatus.OFFER_READY) {
            actions.add(new DashboardResponse.ActionDto("ACCEPT_OFFER", "Принять условия предложения"));
        } else if (app.getStatus() == ApplicationStatus.SIGNATURE_PENDING) {
            actions.add(new DashboardResponse.ActionDto("SIGN_DOCUMENTS", "Подписать документы"));
        }
        // Действующий договор: можно брать транши, пока есть лимит и нет просрочки
        if (contract != null) {
            if (contract.canIssueTranche())
                actions.add(new DashboardResponse.ActionDto("ISSUE_TRANCHE", "Получить овердрафт"));
            else if ("HAS_OVERDUE_TRANCHE".equals(contract.issueBlockedReason()))
                actions.add(new DashboardResponse.ActionDto("REPAY_TRANCHE", "Погасить просроченный транш"));
        }
        return actions;
    }

}
