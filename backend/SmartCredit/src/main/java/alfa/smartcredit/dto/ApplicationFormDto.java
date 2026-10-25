package alfa.smartcredit.dto;

import alfa.smartcredit.model.enums.RevenueTrend;
import alfa.smartcredit.validation.ValidTermDays;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
@Schema(description = "Анкета заявки на кредит")
public record ApplicationFormDto(
        @Schema(description = "Идентификатор заявки на стороне сервера; при создании передаётся null",
                example = "app_2026_0001", accessMode = Schema.AccessMode.READ_ONLY)
        String applicationId,
        @Schema(description = "Время создания заявки; заполняется сервером",
                example = "2026-10-25T12:00:00Z", accessMode = Schema.AccessMode.READ_ONLY)
        Instant createdAt,
        @Schema(description = "Статус анкеты", example = "SUBMITTED", accessMode = Schema.AccessMode.READ_ONLY)
        String status,
        @JsonProperty("step1_financingParameters")
        @Schema(description = "Шаг 1. Параметры финансирования")
        @NotNull @Valid Step1 step1,
        @JsonProperty("step2_businessData")
        @Schema(description = "Шаг 2. Данные бизнеса")
        @NotNull @Valid Step2 step2,
        @Schema(description = "Сведения о предзаполнении данными из внешних источников")
        Prefilled prefilled,
        @JsonProperty("step3_verification")
        @Schema(description = "Шаг 3. Проверка и согласия")
        @NotNull @Valid Step3 step3,
        @Schema(description = "Служебные метаданные формы")
        Meta meta) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    @Schema(description = "Параметры запрашиваемого финансирования")
    public record Step1(
            @Schema(description = "Бизнес-задача, на которую берётся кредит",
                    example = "Закупка лицензий ПО и серверного оборудования для разработки")
            @NotBlank @Size(max = 500) String businessTask,
            @Schema(description = "Запрошенная сумма, ₽ (от 50 000 до 20 000 000)",
                    example = "500000", minimum = "50000", maximum = "20000000")
            @NotNull @DecimalMin("50000") @DecimalMax("20000000") BigDecimal amount,
            @Schema(description = "Срок кредита в днях: 30, 60 или 90", example = "60")
            @NotNull @ValidTermDays Integer termDays,
            @Schema(description = "Процентная ставка, рассчитанная сервером по сроку",
                    example = "18.5", accessMode = Schema.AccessMode.READ_ONLY)
            BigDecimal rate,
            @Schema(description = "Цель кредита", example = "Оборотные средства")
            @NotBlank @Size(max = 100) String purpose) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    @Schema(description = "Данные бизнеса и его финансовые показатели")
    public record Step2(
            @Schema(description = "Данные заявителя")
            @NotNull @Valid Applicant applicant,
            @Schema(description = "Финансовые показатели бизнеса")
            @NotNull @Valid Financials financials,
            @Schema(description = "Ручное переопределение внешних данных (для демо-сценариев)")
            @Valid ExternalDataOverride externalData) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    @Schema(description = "Переопределение данных БКИ/ФНС, обычно отсутствует")
    public record ExternalDataOverride(
            @Schema(description = "Скор БКИ", example = "800", minimum = "0", maximum = "1000")
            @Min(0) @Max(1000) Integer bkiScore,
            @Schema(description = "Просрочки за 12 месяцев", example = "0", minimum = "0", maximum = "24")
            @Min(0) @Max(24) Integer delinquencies12m,
            @Schema(description = "Запросы в БКИ за 12 месяцев", example = "1", minimum = "0", maximum = "30")
            @Min(0) @Max(30) Integer inquiries12m,
            @Schema(description = "Тренд выручки", example = "GROWING",
                    allowableValues = {"GROWING", "STABLE", "DECLINING"})
            RevenueTrend revenueTrend,
            @Schema(description = "Возраст компании в годах", example = "5", minimum = "0", maximum = "100")
            @Min(0) @Max(100) Integer companyAgeYears) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    @Schema(description = "Сведения о заявителе: ИП или ООО")
    public record Applicant(
            @Schema(description = "Тип заявителя", example = "IP", allowableValues = {"IP", "OOO"})
            String type,
            @Schema(description = "Название компании", example = "ИП Кузнецов Дмитрий Олегович")
            String companyName,
            @Schema(description = "ИНН: 10 цифр у ООО, 12 у ИП", example = "772834561209")
            String inn,
            @Schema(description = "Система налогообложения", example = "УСН 6%")
            String taxSystem,
            @Schema(description = "Имя (для ИП)", example = "Дмитрий")
            String firstName,
            @Schema(description = "Фамилия (для ИП)", example = "Кузнецов")
            String lastName,
            @Schema(description = "Отчество (для ИП)", example = "Олегович")
            String middleName,
            @Schema(description = "ОГРНИП (для ИП)", example = "312774600123456")
            String ogrnip,
            @Schema(description = "ОГРН (для ООО)", example = "1127746123456")
            String ogrn,
            @Schema(description = "КПП (для ООО)", example = "770801001")
            String kpp,
            @Schema(description = "Дата регистрации бизнеса", example = "2021-03-15")
            LocalDate registrationDate,
            @Schema(description = "Основной ОКВЭД", example = "62.01")
            String mainOkved,
            @Schema(description = "Отрасль", example = "IT и разработка ПО")
            String industry,
            @Schema(description = "Контактный телефон", example = "+79991110011")
            @Pattern(regexp = "^\\+7[\\s()\\-]*(?:\\d[\\s()\\-]*){10}$",
                    message = "Укажите российский номер в формате +7XXXXXXXXXX") String phone,
            @Schema(description = "Контактный email", example = "kuznetsov@example.com")
            String email,
            @Schema(description = "Адрес регистрации", example = "г. Москва, ул. Тверская, д. 12, оф. 4")
            String registrationAddress) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    @Schema(description = "Финансовые показатели бизнеса")
    public record Financials(
            @Schema(description = "Среднемесячная выручка, ₽", example = "1000000")
            @NotNull @DecimalMin(value = "0", inclusive = false) BigDecimal monthlyRevenue,
            @Schema(description = "Действующая долговая нагрузка, ₽", example = "10000")
            @DecimalMin("0") BigDecimal existingDebt,
            @Schema(description = "Годовая выручка, ₽ (для ООО)", example = "12000000")
            @DecimalMin("0") BigDecimal annualRevenue,
            @Schema(description = "Среднесписочная численность сотрудников (для ООО)", example = "4")
            @DecimalMin("0") Integer averageEmployeeCount,
            @Schema(description = "Иные ежемесячные обязательства, ₽", example = "0")
            @DecimalMin("0") BigDecimal otherMonthlyObligations
    ) {
        public Financials {
            if (existingDebt == null) existingDebt = BigDecimal.ZERO;
            if (otherMonthlyObligations == null) otherMonthlyObligations = BigDecimal.ZERO;
        }
    }

    @Schema(description = "Источник и статус предзаполнения анкеты")
    public record Prefilled(
            @Schema(description = "Источник данных", example = "EGRIP_MOCK",
                    allowableValues = {"EGRIP_MOCK", "EGRUL_MOCK", "AI"})
            String source,
            @Schema(description = "Когда данные были получены", example = "2026-10-25T12:00:00Z")
            Instant fetchedAt,
            @Schema(description = "Подтвердил ли пользователь предзаполненные данные", example = "true")
            Boolean confirmedByUser) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    @Schema(description = "Шаг проверки и согласий")
    public record Step3(
            @Schema(description = "Обязательные согласия")
            @NotNull @Valid Consents consents) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    @Schema(description = "Согласия заявителя")
    public record Consents(
            @Schema(description = "Согласие на обработку персональных данных", example = "true")
            @AssertTrue(message = "требуется согласие") boolean personalData,
            @Schema(description = "Согласие на запрос в БКИ", example = "true")
            @AssertTrue(message = "требуется согласие") boolean bkiRequest,
            @Schema(description = "Согласие на запрос данных ФНС", example = "true")
            @AssertTrue(message = "требуется согласие") boolean fnsRequest,
            @Schema(description = "Когда согласия были приняты", example = "2026-10-25T12:00:00Z")
            Instant acceptedAt) {}

    @Schema(description = "Служебные метаданные формы")
    public record Meta(
            @Schema(description = "Версия формы", example = "1.3")
            String formVersion,
            @Schema(description = "События, произошедшие с формой",
                    example = "[\"form_started\", \"prefill_confirmed\", \"submitted\"]")
            List<String> events) {}
}
