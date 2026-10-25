package alfa.smartcredit.dto;

import alfa.smartcredit.validation.ValidTermDays;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

/** Решение сотрудника по заявке на рассмотрении, независимо от рекомендации скоринга. */
@Schema(description = "Решение сотрудника банка по заявке")
public record DecisionRequest(
        @Schema(description = "Решение", example = "APPROVE",
                allowableValues = {"APPROVE", "OFFER_ALTERNATIVE", "DECLINE"})
        @NotNull Action action,
        @Schema(description = "Комментарий обязателен и сохраняется в заявке",
                example = "Одобрено на запрошенных условиях: положительная кредитная история.")
        @NotBlank String comment,
        @Schema(description = "Сумма для альтернативного предложения, ₽ (от 50 000 до 20 000 000); "
                + "используется только при OFFER_ALTERNATIVE", example = "400000",
                minimum = "50000", maximum = "20000000")
        @DecimalMin("50000") @DecimalMax("20000000") BigDecimal amount,
        @Schema(description = "Срок для альтернативного предложения: 30, 60 или 90 дней", example = "60")
        @ValidTermDays Integer termDays,
        @Schema(description = "Ставка для APPROVE и OFFER_ALTERNATIVE, %; "
                + "если не передана, сервер рассчитывает её сам", example = "18.5",
                minimum = "0", maximum = "100")
        @DecimalMin("0") @DecimalMax("100") BigDecimal finalRate) {

    @Schema(description = "Действие сотрудника банка")
    public enum Action {
        APPROVE,
        OFFER_ALTERNATIVE,
        DECLINE
    }
}
