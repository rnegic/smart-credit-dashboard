package alfa.smartcredit.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import alfa.smartcredit.service.ProductRules;
import alfa.smartcredit.validation.ValidTermDays;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record ApplicationFormDto(
        String applicationId,
        Instant createdAt,
        String status,
        @JsonProperty("step1_financingParameters") @NotNull @Valid Step1 step1,
        @JsonProperty("step2_businessData")        @NotNull @Valid Step2 step2,
        Prefilled prefilled,
        @JsonProperty("step3_verification")        @NotNull @Valid Step3 step3,
        Meta meta) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Step1(
            @NotBlank @Size(max = 500) String businessTask,
            /** Сумма кредита: от 50 000 до 20 000 000 ₽. */
            @NotNull @DecimalMin("50000") @DecimalMax("20000000") BigDecimal amount,
            /** Срок транша в днях: только 30, 60 или 90. */
            @NotNull @ValidTermDays Integer termDays,
            /** Базовая ставка (24.50 / 24.75 / 25.00). Вычисляется сервером по termDays, значение от клиента игнорируется. */
            BigDecimal rate,
            @NotBlank @Size(max = 100) String purpose) {
        public Step1 {
            rate = ProductRules.baseRate(termDays);
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Step2(@NotNull @Valid Applicant applicant, @NotNull @Valid Financials financials) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Applicant(
            String type, String companyName, String inn, String taxSystem,
            String firstName, String lastName, String middleName,
            String ogrnip, String ogrn, LocalDate registrationDate,
            String mainOkved, String industry, String phone, String email,
            String registrationAddress) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Financials(
            /** Среднемесячная выручка, &gt; 0. */
            @NotNull @DecimalMin(value = "0", inclusive = false) BigDecimal monthlyRevenue,
            /** Платёж по текущим кредитам в месяц, &gt;= 0; если не передан, считается 0. */
            @DecimalMin("0") BigDecimal existingDebt) {
        public Financials {
            if (existingDebt == null) existingDebt = BigDecimal.ZERO;
        }
    }

    public record Prefilled(String source, Instant fetchedAt, Boolean confirmedByUser) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Step3(@NotNull @Valid Consents consents) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Consents(
            @AssertTrue(message = "требуется согласие") boolean personalData,
            @AssertTrue(message = "требуется согласие") boolean bkiRequest,
            @AssertTrue(message = "требуется согласие") boolean fnsRequest,
            Instant acceptedAt) {}

    public record Meta(String formVersion, List<String> events) {}
}
