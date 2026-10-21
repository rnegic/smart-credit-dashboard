package alfa.smartcredit.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record ApplicationView(
        Long id, String companyName, String inn, String legalForm,
        BigDecimal amount, Integer termMonths, String purpose, String status,
        Integer riskScore, String riskClass, String aiComment, String officerComment,
        Instant createdAt, OfferView offer) {
    public record OfferView(Long id, BigDecimal amount, Integer termMonths,
                            BigDecimal ratePercent, BigDecimal monthlyPayment,
                            LocalDate validUntil, String status) {}
}
