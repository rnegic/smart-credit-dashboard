package alfa.smartcredit.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Редактируемые реквизиты компании из профиля клиента. */
public record CompanyRequest(
        @NotBlank @Size(max = 255) String name,
        @NotBlank
        @Pattern(regexp = "^\\d{10}(\\d{2})?$", message = "ИНН должен содержать 10 или 12 цифр")
        String inn,
        @Size(max = 32)
        @Pattern(regexp = "^$|^\\d{2}(\\.\\d+)?$", message = "ОКВЭД должен начинаться с двух цифр")
        String okved) {}
