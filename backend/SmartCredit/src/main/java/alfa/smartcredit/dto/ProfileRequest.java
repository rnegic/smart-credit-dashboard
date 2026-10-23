package alfa.smartcredit.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Контакты пользователя. Пустая строка или null очищают поле. */
public record ProfileRequest(
        @Pattern(regexp = "^$|^\\+?[0-9][0-9\\-\\s()]{9,18}$", message = "Некорректный номер телефона") String phone,
        @Email @Size(max = 255) String email) {}
