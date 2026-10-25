package alfa.smartcredit.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

@Schema(description = "Единый формат ответа об ошибке")
public record ErrorResponse(
        @Schema(description = "Машиночитаемый код ошибки", example = "VALIDATION_ERROR")
        String code,
        @Schema(description = "Описание ошибки для пользователя", example = "amount: должно быть больше или равно 50000")
        String message,
        @Schema(description = "Момент времени, когда произошла ошибка", example = "2026-10-25T12:00:00Z")
        Instant timestamp) {
    public static ErrorResponse of(String code, String message) {
        return new ErrorResponse(code, message, Instant.now());
    }
}
