package alfa.smartcredit.dto;

import alfa.smartcredit.validation.ValidTermDays;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

@Schema(description = "Запрос на получение транша (овердрафта) в рамках действующего договора")
public record TrancheRequest(
        @Schema(description = "Сумма транша, ₽: любая от минимальной до доступного лимита договора", example = "100000")
        @NotNull @DecimalMin(value = "0", inclusive = false) @Digits(integer = 17, fraction = 2) BigDecimal amount,
        @Schema(description = "Срок транша в днях: 30, 60 или 90", example = "30")
        @NotNull @ValidTermDays Integer termDays) {}
