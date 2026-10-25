package alfa.smartcredit.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Контакты пользователя. Пустая строка или null очищают поле. */
@Schema(description = "Контакты пользователя. Пустая строка или null очищают поле.")
public record ProfileRequest(
        @Schema(description = "Телефон", example = "+79991110011")
        @Pattern(regexp = "^$|^\\+?[0-9][0-9\\-\\s()]{9,18}$", message = "Некорректный номер телефона")
        String phone,
        @Schema(description = "Email", example = "kuznetsov@example.com")
        @Email @Size(max = 255) String email) {}
