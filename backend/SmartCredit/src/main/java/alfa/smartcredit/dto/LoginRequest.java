package alfa.smartcredit.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

@Schema(description = "Учётные данные для входа")
public record LoginRequest(
        @Schema(description = "Логин пользователя", example = "demo_ip_approved")
        @NotBlank String login,
        @Schema(description = "Пароль", example = "demo123")
        @NotBlank String password) {}
