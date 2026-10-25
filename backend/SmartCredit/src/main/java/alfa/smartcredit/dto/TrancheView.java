package alfa.smartcredit.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.LocalDate;

@Schema(description = "Транш (овердрафт) внутри договора")
public record TrancheView(
        @Schema(description = "Идентификатор транша", example = "1")
        Long id,
        @Schema(description = "Идентификатор договора (он же id оферты)", example = "3")
        Long contractId,
        @Schema(description = "Сумма транша, ₽", example = "100000")
        BigDecimal amount,
        @Schema(description = "Срок транша в днях", example = "30")
        Integer termDays,
        @Schema(description = "Годовая ставка транша, %: фиксируется на момент получения", example = "24.50")
        BigDecimal ratePercent,
        @Schema(description = "Дата получения", example = "2026-10-25")
        LocalDate issuedAt,
        @Schema(description = "Дата, до которой нужно погасить", example = "2026-11-24")
        LocalDate dueDate,
        @Schema(description = "Статус", example = "ACTIVE", allowableValues = {"ACTIVE", "OVERDUE", "REPAID"})
        String status,
        @Schema(description = "Проценты, начисленные на сегодня (для погашенного транша - уплаченные), ₽", example = "2013.70")
        BigDecimal accruedInterest,
        @Schema(description = "Сумма к погашению сегодня (основной долг + проценты); для погашенного - сколько уплачено, ₽",
                example = "102013.70")
        BigDecimal totalToRepay,
        @Schema(description = "Дата погашения; null, пока не погашен", example = "2026-11-10")
        LocalDate repaidAt) {}
