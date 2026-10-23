package alfa.smartcredit.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
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
            @NotNull @DecimalMin("10000") BigDecimal amount,
            @NotNull @Min(1) @Max(120) Integer termMonths,
            @NotBlank @Size(max = 100) String purpose) {}

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
            @NotNull @DecimalMin("1") BigDecimal monthlyRevenue,
            @NotNull @DecimalMin("0") BigDecimal existingMonthlyDebtPayment) {}

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
