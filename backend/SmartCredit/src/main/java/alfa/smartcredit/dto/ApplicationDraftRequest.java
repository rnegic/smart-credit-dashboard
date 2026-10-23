package alfa.smartcredit.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.util.List;

public record ApplicationDraftRequest(
        @NotNull ApplicationFormDto form,
        @NotNull @Min(0) @Max(3) Integer currentStep,
        @NotNull List<String> aiFilled,
        @NotNull List<String> missingFields,
        @PositiveOrZero Long revision) {}
