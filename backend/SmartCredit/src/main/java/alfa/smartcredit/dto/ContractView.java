package alfa.smartcredit.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Schema(description = "Договор овердрафта: срок, лимит, его использование и транши")
public record ContractView(
        @Schema(description = "Идентификатор договора (= id оферты). Используется в /api/contracts/{id}/tranches", example = "3")
        Long id,
        @Schema(description = "Идентификатор заявки", example = "5")
        Long applicationId,
        @Schema(description = "Статус договора", example = "ACTIVE", allowableValues = {"ACTIVE", "EXPIRED"})
        String status,
        @Schema(description = "Срок договора, месяцев: 6, 12 или 24", example = "12")
        Integer contractTermMonths,
        @Schema(description = "Дата начала (дата подписания)", example = "2026-10-25")
        LocalDate startDate,
        @Schema(description = "Дата окончания договора", example = "2027-10-25")
        LocalDate endDate,
        @Schema(description = "Лимит договора, ₽: общая сумма траншей за весь срок", example = "500000")
        BigDecimal limit,
        @Schema(description = "Использованный лимит, ₽", example = "200000")
        BigDecimal usedLimit,
        @Schema(description = "Доступный лимит, ₽", example = "300000")
        BigDecimal availableLimit,
        @Schema(description = "true - лимит возобновляется после погашения; false - расходуется нарастающим итогом",
                example = "false")
        boolean revolving,
        @Schema(description = "Основной долг по открытым траншам, ₽", example = "100000")
        BigDecimal outstandingPrincipal,
        @Schema(description = "Минимальная сумма транша, ₽", example = "1000")
        BigDecimal minTrancheAmount,
        @Schema(description = "Можно ли сейчас получить новый транш")
        boolean canIssueTranche,
        @Schema(description = "Причина, по которой транш получить нельзя; null, если можно",
                allowableValues = {"CONTRACT_EXPIRED", "HAS_OVERDUE_TRANCHE", "LIMIT_EXHAUSTED", "CONTRACT_ENDING", "RATE_UNAVAILABLE"})
        String issueBlockedReason,
        @Schema(description = "Единые условия всех новых траншей, установленные в одобренном договоре")
        TrancheTerms trancheTerms,
        @Schema(description = "Транши договора, новые сверху")
        List<TrancheView> tranches) {

    @Schema(description = "Фиксированные условия транша из договора")
    public record TrancheTerms(
            @Schema(description = "Срок каждого транша, выбранный на первом шаге заявки, дней", example = "30")
            Integer termDays,
            @Schema(description = "Годовая ставка, зафиксированная в индивидуальных условиях, %", example = "24.50")
            BigDecimal ratePercent,
            @Schema(description = "Дата погашения, если взять транш сегодня", example = "2026-11-24")
            LocalDate dueDate,
            @Schema(description = "Укладывается ли фиксированный срок транша в оставшийся срок договора")
            boolean available) {}
}
