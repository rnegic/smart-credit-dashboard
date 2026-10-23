package alfa.smartcredit.dto;

import alfa.smartcredit.model.enums.DecisionStatus;
import alfa.smartcredit.service.ScoringService;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record ApplicationView(
        Long id, String companyName, String inn, String legalForm,
        BigDecimal amount,            // запрошенная сумма
        Integer termDays,             // 30 | 60 | 90
        BigDecimal rate,              // базовая ставка по сроку
        String purpose, String businessTask,
        String status,                // IN_REVIEW | OFFER_READY | ACCEPTED | DECLINED (статус процесса)
        String decision,              // ИТОГОВОЕ решение сотрудника банка: APPROVED | ALTERNATIVE_OFFER | DECLINED; null, пока не вынесено
        BigDecimal finalRate,         // ставка по решению сотрудника; null, пока решения нет
        Integer internalScore,        // 0..100
        String riskClass,             // A | B | C | D
        String aiComment,             // краткий комментарий ИИ; только для сотрудника банка, клиенту null
        String officerComment,
        Instant createdAt,
        ScoringService.Result scoring,   // производные поля скоринга; для клиента без bkiZone/external/points
        Recommendation recommendation,   // рекомендация системы; только для сотрудника банка, клиенту null
        OfferView offer,
        CompanyAge companyAge){
    /** Рекомендация DecisionEngine: что система предлагает сотруднику (не решение). */
    public record Recommendation(DecisionStatus decision, BigDecimal finalRate, BigDecimal amount, String reason) {}

    public record OfferView(Long id, BigDecimal amount, Integer termDays,
                            BigDecimal finalRate, BigDecimal monthlyPayment,
                            LocalDate validUntil, String status) {}
    public record CompanyAge(LocalDate registrationDate, int years, int months, int days, long totalDays) {}
}
