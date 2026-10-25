package alfa.smartcredit.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Plain-text assistant answer with at most one existing screen field to focus. */
public record AssistantResponse(
        @NotBlank @Size(max = 6000) String answer,
        @Size(max = 160) String focusFieldId) {}
