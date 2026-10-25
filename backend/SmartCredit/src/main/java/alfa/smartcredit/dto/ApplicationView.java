package alfa.smartcredit.dto;

import alfa.smartcredit.model.enums.DecisionStatus;
import alfa.smartcredit.service.ScoringService;
import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Schema(description = "Заявка на кредит")
public record ApplicationView(
        @Schema(description = "Идентификатор заявки", example = "1")
        Long id,
        @Schema(description = "Название компании", example = "ИП Кузнецов Дмитрий Олегович")
        String companyName,
        @Schema(description = "ИНН", example = "772834561209")
        String inn,
        @Schema(description = "Правовая форма", example = "IP", allowableValues = {"IP", "OOO"})
        String legalForm,
        @Schema(description = "Запрошенная сумма, ₽", example = "500000")
        BigDecimal amount,
        @Schema(description = "Срок кредита в днях: 30, 60 или 90", example = "60")
        Integer termDays,
        @Schema(description = "Базовая ставка по сроку, %", example = "18.5")
        BigDecimal rate,
        @Schema(description = "Цель кредита", example = "Оборотные средства")
        String purpose,
        @Schema(description = "Бизнес-задача", example = "Закупка оборудования")
        String businessTask,
        @Schema(description = "Статус процесса", example = "IN_REVIEW",
                allowableValues = {"IN_REVIEW", "OFFER_READY", "ACCEPTED", "DECLINED"})
        String status,
        @Schema(description = "Итоговое решение сотрудника банка; null, пока решение не вынесено",
                example = "APPROVED", allowableValues = {"APPROVED", "ALTERNATIVE_OFFER", "DECLINED"})
        String decision,
        @Schema(description = "Ставка по решению сотрудника; null, пока решения нет", example = "18.5")
        BigDecimal finalRate,
        @Schema(description = "Внутренний скор 0..100", example = "100")
        Integer internalScore,
        @Schema(description = "Класс риска", example = "A", allowableValues = {"A", "B", "C", "D"})
        String riskClass,
        @Schema(description = "Комментарий ИИ; только для сотрудника банка, клиенту null")
        String aiComment,
        @Schema(description = "Комментарий сотрудника банка")
        String officerComment,
        @Schema(description = "Дата создания заявки", example = "2026-10-22T12:00:00Z")
        Instant createdAt,
        @Schema(description = "Результаты скоринга; клиенту доступна только безопасная часть")
        ScoringService.Result scoring,
        @Schema(description = "Рекомендация системы; только для сотрудника банка, клиенту null")
        Recommendation recommendation,
        @Schema(description = "Оферта по заявке, если она сформирована")
        OfferView offer,
        @Schema(description = "Возраст компании")
        CompanyAge companyAge) {

    @Schema(description = "Рекомендация DecisionEngine: что система предлагает сотруднику (не решение)")
    public record Recommendation(
            @Schema(description = "Предлагаемое решение", example = "APPROVED",
                    allowableValues = {"APPROVED", "ALTERNATIVE_OFFER", "MANUAL_REVIEW", "DECLINED"})
            DecisionStatus decision,
            @Schema(description = "Предлагаемая ставка, %", example = "18.5")
            BigDecimal finalRate,
            @Schema(description = "Предлагаемая сумма, ₽", example = "500000")
            BigDecimal amount,
            @Schema(description = "Обоснование рекомендации")
            String reason) {}

    @Schema(description = "Оферта клиенту")
    public record OfferView(
            @Schema(description = "Идентификатор оферты", example = "1")
            Long id,
            @Schema(description = "Сумма, ₽", example = "500000")
            BigDecimal amount,
            @Schema(description = "Срок в днях", example = "60")
            Integer termDays,
            @Schema(description = "Ставка, %", example = "18.5")
            BigDecimal finalRate,
            @Schema(description = "Ежемесячный платёж, ₽", example = "84917.32")
            BigDecimal monthlyPayment,
            @Schema(description = "Оферта действует до", example = "2027-01-23")
            LocalDate validUntil,
            @Schema(description = "Статус оферты", example = "ACTIVE")
            String status) {}

    @Schema(description = "Возраст компании")
    public record CompanyAge(
            @Schema(description = "Дата регистрации", example = "2021-03-15")
            LocalDate registrationDate,
            @Schema(description = "Полных лет", example = "5")
            int years,
            @Schema(description = "Полных месяцев сверх лет", example = "7")
            int months,
            @Schema(description = "Дней сверх месяцев", example = "10")
            int days,
            @Schema(description = "Всего дней", example = "2050")
            long totalDays) {}
}
