package alfa.smartcredit.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PrefillRequest(@NotBlank @Size(max = 2000) String text) {}
