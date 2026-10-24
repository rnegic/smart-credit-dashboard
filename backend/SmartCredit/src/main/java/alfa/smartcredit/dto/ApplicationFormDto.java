package alfa.smartcredit.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import alfa.smartcredit.model.enums.RevenueTrend;
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
            @NotNull @DecimalMin("50000") @DecimalMax("20000000") BigDecimal amount,
            @NotNull @ValidTermDays Integer termDays,
            BigDecimal rate, // рассчитывается на бэкенде
            @NotBlank @Size(max = 100) String purpose) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Step2(@NotNull @Valid Applicant applicant, @NotNull @Valid Financials financials,
                        @Valid ExternalDataOverride externalData) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ExternalDataOverride(
            @Min(0) @Max(1000) Integer bkiScore,
            @Min(0) @Max(24) Integer delinquencies12m,
            @Min(0) @Max(30) Integer inquiries12m,
            RevenueTrend revenueTrend,
            @Min(0) @Max(100) Integer companyAgeYears) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Applicant(
            String type, String companyName, String inn, String taxSystem,
            String firstName, String lastName, String middleName,
            String ogrnip, String ogrn, String kpp, // Добавлены поля для ООО
            LocalDate registrationDate, String mainOkved, String industry,
            @Pattern(regexp = "^\\+7[\\s()\\-]*(?:\\d[\\s()\\-]*){10}$",
                    message = "Укажите российский номер в формате +7XXXXXXXXXX") String phone,
            String email,
            String registrationAddress) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Financials(
            @NotNull @DecimalMin(value = "0", inclusive = false) BigDecimal monthlyRevenue,
            @DecimalMin("0") BigDecimal existingDebt,
            @DecimalMin("0") BigDecimal annualRevenue,         // Для ООО (Масштаб)
            @DecimalMin("0") Integer averageEmployeeCount,     // Для ООО (Масштаб)
            @DecimalMin("0") BigDecimal otherMonthlyObligations // Иные обязательства
    ) {
        public Financials {
            if (existingDebt == null) existingDebt = BigDecimal.ZERO;
            if (otherMonthlyObligations == null) otherMonthlyObligations = BigDecimal.ZERO;
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