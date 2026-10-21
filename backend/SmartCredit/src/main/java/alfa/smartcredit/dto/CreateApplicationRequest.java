package alfa.smartcredit.dto;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;

public record CreateApplicationRequest(
        @NotNull @DecimalMin("10000") BigDecimal amount,
        @NotNull @Min(1) @Max(120) Integer termMonths,
        @NotBlank @Size(max = 100) String purpose) {}
