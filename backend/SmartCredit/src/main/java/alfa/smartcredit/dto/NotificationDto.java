package alfa.smartcredit.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

@Schema(description = "Уведомление личного кабинета")
public record NotificationDto(
        @Schema(description = "Идентификатор уведомления", example = "1")
        Long id,
        @Schema(description = "Текст уведомления",
                example = "Заявка №1 на 500 000 ₽ подана и находится на рассмотрении банка.")
        String text,
        @Schema(description = "Прочитано ли уведомление", example = "false")
        boolean read,
        @Schema(description = "Когда уведомление создано", example = "2026-10-25T12:00:00Z")
        Instant createdAt) {}
