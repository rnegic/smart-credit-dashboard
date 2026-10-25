package alfa.smartcredit.dto;

import alfa.smartcredit.validation.ValidTermDays;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

/** Решение сотрудника по заявке на рассмотрении, независимо от рекомендации скоринга. */
public record DecisionRequest(
        @NotNull Action action,
        @NotBlank String comment,          // комментарий обязателен
        // только для OFFER_ALTERNATIVE:
        @DecimalMin("50000") @DecimalMax("20000000") BigDecimal amount,
        @ValidTermDays Integer termDays,   // 30 | 60 | 90
        // Для APPROVE и OFFER_ALTERNATIVE; обязательна, если сервер не может рассчитать ставку.
        @DecimalMin("0") @DecimalMax("100") BigDecimal finalRate) {
    public enum Action { APPROVE, OFFER_ALTERNATIVE, DECLINE }
}
