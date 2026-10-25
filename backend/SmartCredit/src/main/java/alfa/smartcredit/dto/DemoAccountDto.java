package alfa.smartcredit.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Демонстрационная учётная запись")
public record DemoAccountDto(
        @Schema(description = "Логин", example = "demo_ip_approved")
        String login,
        @Schema(description = "Пароль", example = "demo123")
        String password,
        @Schema(description = "Роль", example = "CLIENT", allowableValues = {"CLIENT", "BANK_OFFICER"})
        String role,
        @Schema(description = "ФИО пользователя", example = "Кузнецов Дмитрий Олегович")
        String fullName,
        @Schema(description = "Описание демонстрационного сценария")
        String description) {}
