package alfa.smartcredit.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record DecisionRequest(
        @NotNull Action action,
        @NotBlank String comment,          // комментарий обязателен
        BigDecimal amount,                 // только для OFFER_ALTERNATIVE
        Integer termMonths,
        BigDecimal ratePercent) {
    public enum Action { APPROVE, OFFER_ALTERNATIVE, DECLINE }
}
