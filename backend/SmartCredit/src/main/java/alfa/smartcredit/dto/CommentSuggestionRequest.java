package alfa.smartcredit.dto;

import alfa.smartcredit.validation.ValidTermDays;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

/** Запрос на генерацию комментария сотрудника банка по выбранному решению. */
public record CommentSuggestionRequest(
        @NotNull DecisionRequest.Action action,
        @DecimalMin("50000") @DecimalMax("20000000") BigDecimal amount,
        @ValidTermDays Integer termDays,
        @DecimalMin("0") @DecimalMax("100") BigDecimal finalRate) {}