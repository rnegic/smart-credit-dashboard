package alfa.smartcredit.dto;

import java.time.Instant;
import java.util.List;

public record ApplicationDraftResponse(
        ApplicationFormDto form,
        int currentStep,
        List<String> aiFilled,
        List<String> missingFields,
        long revision,
        Instant updatedAt) {}
