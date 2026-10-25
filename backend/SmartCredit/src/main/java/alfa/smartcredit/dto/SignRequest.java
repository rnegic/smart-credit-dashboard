package alfa.smartcredit.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/** Тело POST /offers/{id}/sign. ФИО и время клиент не передаёт. */
@Schema(description = "Подтверждение подписания документов. ФИО и время подписания определяет сервер.")
public record SignRequest(
        @Schema(description = "Версия документов, которую подписывает клиент", example = "1")
        @NotBlank String documentVersion,
        @Schema(description = "Клиент подтвердил ознакомление с документами", example = "true")
        @NotNull Boolean confirmed) {}
