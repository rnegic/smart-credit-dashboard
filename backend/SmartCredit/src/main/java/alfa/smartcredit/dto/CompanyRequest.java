package alfa.smartcredit.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Редактируемые реквизиты компании из профиля клиента. */
@Schema(description = "Реквизиты компании")
public record CompanyRequest(
        @Schema(description = "Название компании", example = "ИП Кузнецов Дмитрий Олегович")
        @NotBlank @Size(max = 255) String name,
        @Schema(description = "ИНН: 10 или 12 цифр", example = "772834561209")
        @NotBlank
        @Pattern(regexp = "^\\d{10}(\\d{2})?$", message = "ИНН должен содержать 10 или 12 цифр")
        String inn,
        @Schema(description = "ОКВЭД: минимум две цифры", example = "62.01")
        @Size(max = 32)
        @Pattern(regexp = "^$|^\\d{2}(\\.\\d+)?$", message = "ОКВЭД должен начинаться с двух цифр")
        String okved) {}
