package alfa.smartcredit.dto;

import alfa.smartcredit.model.enums.RevenueTrend;
import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Schema(description = "Сводная информация личного кабинета клиента")
public record DashboardResponse(
        @Schema(description = "Данные компании")
        CompanyDto company,
        @Schema(description = "Текущая заявка; null, если заявок нет")
        ApplicationDto currentApplication,
        @Schema(description = "Этапы процесса")
        List<StageDto> stages,
        @Schema(description = "Действия, которые требуются от клиента")
        List<ActionDto> requiredActions,
        @Schema(description = "Доступные оферты")
        List<OfferDto> offers,
        @Schema(description = "Действующий кредит; null, если кредита нет")
        LoanDto activeLoan,
        @Schema(description = "Ближайший платёж; null, если платежей нет")
        PaymentDto nextPayment,
        @Schema(description = "Количество непрочитанных уведомлений", example = "2")
        long unreadNotifications
) {
    @Schema(description = "Компания в дашборде")
    public record CompanyDto(
            @Schema(description = "Идентификатор компании", example = "1")
            Long id,
            @Schema(description = "Название компании", example = "ИП Кузнецов Дмитрий Олегович")
            String name,
            @Schema(description = "ИНН", example = "772834561209")
            String inn,
            @Schema(description = "ОКВЭД", example = "62.01")
            String okved,
            @Schema(description = "Правовая форма", example = "IP", allowableValues = {"IP", "OOO"})
            String legalForm,
            @Schema(description = "Демонстрационные внешние данные")
            ExternalDemoDto externalDemo) {}

    @Schema(description = "Демонстрационные внешние данные компании")
    public record ExternalDemoDto(
            @Schema(description = "Скор БКИ", example = "800")
            Integer bkiScore,
            @Schema(description = "Просрочки за 12 месяцев", example = "0")
            Integer delinquencies12m,
            @Schema(description = "Запросы в БКИ за 12 месяцев", example = "1")
            Integer inquiries12m,
            @Schema(description = "Тренд выручки", example = "GROWING",
                    allowableValues = {"GROWING", "STABLE", "DECLINING"})
            RevenueTrend revenueTrend,
            @Schema(description = "Возраст компании в годах", example = "5")
            Integer companyAgeYears) {}

    @Schema(description = "Заявка в дашборде")
    public record ApplicationDto(
            @Schema(description = "Идентификатор заявки", example = "1")
            Long id,
            @Schema(description = "Сумма, ₽", example = "500000")
            BigDecimal amount,
            @Schema(description = "Срок в днях", example = "60")
            Integer termDays,
            @Schema(description = "Ставка, %", example = "18.5")
            BigDecimal rate,
            @Schema(description = "Цель кредита", example = "Оборотные средства")
            String purpose,
            @Schema(description = "Статус заявки", example = "IN_REVIEW")
            String status,
            @Schema(description = "Решение банка; null, пока решения нет", example = "APPROVED")
            String decision,
            @Schema(description = "Итоговая ставка, %", example = "18.5")
            BigDecimal finalRate,
            @Schema(description = "Масштаб бизнеса для ООО", example = "SMALL")
            String businessScale,
            @Schema(description = "Дата создания", example = "2026-10-22T12:00:00Z")
            Instant createdAt) {}

    @Schema(description = "Этап процесса")
    public record StageDto(
            @Schema(description = "Код этапа", example = "SCORING")
            String code,
            @Schema(description = "Название этапа", example = "Скоринг")
            String title,
            @Schema(description = "Состояние этапа", example = "DONE",
                    allowableValues = {"DONE", "CURRENT", "PENDING"})
            String state) {}

    @Schema(description = "Требуемое действие")
    public record ActionDto(
            @Schema(description = "Код действия", example = "SIGN_DOCUMENTS")
            String code,
            @Schema(description = "Описание действия", example = "Подписать документы по оферте")
            String title) {}

    @Schema(description = "Оферта клиенту")
    public record OfferDto(
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
            LocalDate validUntil) {}

    @Schema(description = "Действующий кредит")
    public record LoanDto(
            @Schema(description = "Идентификатор кредита", example = "1")
            Long id,
            @Schema(description = "Основной долг, ₽", example = "500000")
            BigDecimal principal,
            @Schema(description = "Ставка, %", example = "18.5")
            BigDecimal ratePercent,
            @Schema(description = "Срок в месяцах", example = "2")
            Integer termMonths,
            @Schema(description = "Ежемесячный платёж, ₽", example = "254917.32")
            BigDecimal monthlyPayment,
            @Schema(description = "Остаток долга, ₽", example = "254917.32")
            BigDecimal remainingBalance,
            @Schema(description = "Дата выдачи", example = "2026-10-25")
            LocalDate startDate) {}

    @Schema(description = "Платёж по кредиту")
    public record PaymentDto(
            @Schema(description = "Идентификатор платежа", example = "1")
            Long id,
            @Schema(description = "Дата платежа", example = "2026-11-25")
            LocalDate dueDate,
            @Schema(description = "Сумма, ₽", example = "254917.32")
            BigDecimal amount) {}
}
