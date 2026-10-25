package alfa.smartcredit.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

@Schema(description = "Получение транша: клиент указывает только сумму, срок и ставка установлены договором")
public record TrancheRequest(
        @Schema(description = "Сумма транша, ₽: любая от минимальной до доступного лимита договора", example = "100000")
        @NotNull @DecimalMin(value = "0", inclusive = false) @Digits(integer = 17, fraction = 2) BigDecimal amount) {}
