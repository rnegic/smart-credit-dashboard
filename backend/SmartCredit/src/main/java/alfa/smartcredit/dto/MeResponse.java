package alfa.smartcredit.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Данные авторизованного пользователя")
public record MeResponse(
        @Schema(description = "Идентификатор пользователя", example = "1")
        Long userId,
        @Schema(description = "ФИО пользователя", example = "Кузнецов Дмитрий Олегович")
        String fullName,
        @Schema(description = "Роль пользователя", example = "CLIENT",
                allowableValues = {"CLIENT", "BANK_OFFICER"})
        String role,
        @Schema(description = "Идентификатор компании клиента; null для сотрудника банка", example = "1")
        Long companyId,
        @Schema(description = "Правовая форма компании", example = "IP", allowableValues = {"IP", "OOO"})
        String legalForm,
        @Schema(description = "Телефон", example = "+79991110011")
        String phone,
        @Schema(description = "Email", example = "kuznetsov@example.com")
        String email) {}
