package alfa.smartcredit.dto;

import alfa.smartcredit.validation.ValidContractTerm;
import alfa.smartcredit.validation.ValidTermDays;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

/** Запрос на генерацию комментария сотрудника банка по выбранному решению. */
@Schema(description = "Параметры решения, для которого генерируется комментарий")
public record CommentSuggestionRequest(
        @Schema(description = "Выбранное решение", example = "APPROVE",
                allowableValues = {"APPROVE", "OFFER_ALTERNATIVE", "DECLINE"})
        @NotNull DecisionRequest.Action action,
        @Schema(description = "Сумма предложения, ₽", example = "500000",
                minimum = "50000", maximum = "20000000")
        @DecimalMin("50000") @DecimalMax("20000000") BigDecimal amount,
        @Schema(description = "Срок предложения в днях: 30, 60 или 90", example = "60")
        @ValidTermDays Integer termDays,
        @Schema(description = "Срок договора предложения в месяцах: 6, 12 или 24", example = "12")
        @ValidContractTerm Integer contractTermMonths,
        @Schema(description = "Ставка предложения, %", example = "18.5", minimum = "0", maximum = "100")
        @DecimalMin("0") @DecimalMax("100") BigDecimal finalRate) {}
