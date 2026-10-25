package alfa.smartcredit.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Профиль пользователя")
public record ProfileView(
        @Schema(description = "Идентификатор пользователя", example = "1")
        Long userId,
        @Schema(description = "ФИО", example = "Кузнецов Дмитрий Олегович")
        String fullName,
        @Schema(description = "Телефон", example = "+79991110011")
        String phone,
        @Schema(description = "Email", example = "kuznetsov@example.com")
        String email) {}
