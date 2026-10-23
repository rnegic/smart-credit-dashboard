package alfa.smartcredit.dto;

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
        String decision,              // INFO_REQUIRED | DECLINED | APPROVED | ALTERNATIVE_OFFER | MANUAL_REVIEW (решение DecisionEngine)
        BigDecimal finalRate,         // итоговая ставка; null, если решения со ставкой ещё нет
        Integer internalScore,        // 0..100
        String riskClass,             // A | B | C | D
        String aiComment, String officerComment,
        Instant createdAt,
        ScoringService.Result scoring,   // производные поля скоринга; для клиента без bkiZone/external/points
        OfferView offer) {
    public record OfferView(Long id, BigDecimal amount, Integer termDays,
                            BigDecimal finalRate, BigDecimal monthlyPayment,
                            LocalDate validUntil, String status) {}
}
