package alfa.smartcredit.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record LegalFormRequest(@NotBlank @Pattern(regexp = "IP|OOO") String legalForm) {}
