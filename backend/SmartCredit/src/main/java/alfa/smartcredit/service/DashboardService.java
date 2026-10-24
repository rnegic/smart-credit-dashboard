package alfa.smartcredit.service;

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

    @Transactional(readOnly = true)
    public DashboardResponse build(Long companyId) {
        Company company = companyRepository.findById(companyId)
                .orElseThrow(ApiException::unauthorized);   // песочницу уже почистили

        CreditApplication app = applicationRepository
                .findFirstByCompanyIdOrderByCreatedAtDesc(companyId).orElse(null);

        List<DashboardResponse.OfferDto> offers = offerRepository
                .findByCompanyIdAndStatus(companyId, OfferStatus.ACTIVE).stream()
                .map(o -> new DashboardResponse.OfferDto(o.getId(), o.getAmount(), termDays(o.getTermDays(), o.getTermMonths()),
                        o.getRatePercent(), o.getMonthlyPayment(), o.getValidUntil()))
                .toList();

        Loan loan = loanRepository.findFirstByCompanyIdAndStatus(companyId, LoanStatus.ACTIVE).orElse(null);
        Payment next = loan == null ? null : paymentRepository
                .findFirstByLoanIdAndStatusOrderByDueDateAsc(loan.getId(), PaymentStatus.PENDING).orElse(null);

        return new DashboardResponse(
                new DashboardResponse.CompanyDto(company.getId(), company.getName(),
                        company.getInn(), company.getOkved(), company.getLegalForm()),
                app == null ? null : new DashboardResponse.ApplicationDto(
                        app.getId(), app.getAmount(), termDays(app.getTermDays(), app.getTermMonths()),
                        app.getRate(), app.getPurpose(), app.getStatus().name(),
                        app.getDecision() == null ? null : app.getDecision().name(),
                        app.getFinalRate(), app.getBusinessScale() != null ? app.getBusinessScale().name() : null,
                        app.getCreatedAt()
                ),
                buildStages(app),
                buildActions(app),
                offers,
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
                {"REVIEW", "Рассмотрение банком"},
                {"OFFER", "Предложение банка"},
                {"ISSUED", "Выдача кредита"}
        };
        int current = app == null ? 0 : switch (app.getStatus()) {
            case IN_REVIEW -> 1;
            case OFFER_READY -> 2;
            case DECLINED -> 2;
            case ACCEPTED -> 4;   // все этапы пройдены
        };
        List<DashboardResponse.StageDto> result = new ArrayList<>();
        for (int i = 0; i < defs.length; i++) {
            String state = i < current ? "DONE" : (i == current ? "CURRENT" : "PENDING");
            result.add(new DashboardResponse.StageDto(defs[i][0], defs[i][1], state));
        }
        return result;
    }

    private List<DashboardResponse.ActionDto> buildActions(CreditApplication app) {
        if (app == null) {
            return List.of(new DashboardResponse.ActionDto("CREATE_APPLICATION", "Подать заявку на кредит"));
        }
        if (app.getStatus() == ApplicationStatus.OFFER_READY) {
            return List.of(new DashboardResponse.ActionDto("ACCEPT_OFFER", "Принять или отклонить предложение банка"));
        }
        return List.of();
    }
}
