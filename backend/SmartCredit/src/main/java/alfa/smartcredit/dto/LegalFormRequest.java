package alfa.smartcredit.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

@Schema(description = "Правовая форма компании")
public record LegalFormRequest(
        @Schema(description = "Форма ИП или ООО", example = "IP", allowableValues = {"IP", "OOO"})
        @NotBlank @Pattern(regexp = "IP|OOO") String legalForm) {}
