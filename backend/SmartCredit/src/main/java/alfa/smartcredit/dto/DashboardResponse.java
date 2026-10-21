package alfa.smartcredit.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record DashboardResponse(
        CompanyDto company,
        ApplicationDto currentApplication,   // null, если заявок нет
        List<StageDto> stages,
        List<ActionDto> requiredActions,
        List<OfferDto> offers,
        LoanDto activeLoan,                  // null, если кредита нет
        PaymentDto nextPayment,              // null, если нет
        long unreadNotifications
) {
    public record CompanyDto(Long id, String name, String inn, String okved, String legalForm) {}

    public record ApplicationDto(Long id, BigDecimal amount, Integer termMonths,
                                 String purpose, String status, Instant createdAt) {}

    public record StageDto(String code, String title, String state) {}

    public record ActionDto(String code, String title) {}

    public record OfferDto(Long id, BigDecimal amount, Integer termMonths,
                           BigDecimal ratePercent, BigDecimal monthlyPayment, LocalDate validUntil) {}

    public record LoanDto(Long id, BigDecimal principal, BigDecimal ratePercent, Integer termMonths,
                          BigDecimal monthlyPayment, BigDecimal remainingBalance, LocalDate startDate) {}

    public record PaymentDto(Long id, LocalDate dueDate, BigDecimal amount) {}
}
