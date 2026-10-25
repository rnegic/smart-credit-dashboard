package alfa.smartcredit.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.List;

/** Ответ GET /documents и POST /offers/{id}/sign. */
@Schema(description = "Пакет документов по оферте и статус подписания")
public record DocumentsResponse(
        @Schema(description = "Идентификатор заявки", example = "1")
        Long applicationId,
        @Schema(description = "Идентификатор оферты", example = "1")
        Long offerId,
        @Schema(description = "Версия документов", example = "1")
        String documentVersion,
        @Schema(description = "Документы пакета")
        List<DocumentDto> documents,
        @Schema(description = "Можно ли подписать документы сейчас", example = "true")
        boolean signingAllowed,
        @Schema(description = "Когда документы были подписаны; null, если подписи нет",
                example = "2026-10-25T12:00:00Z")
        Instant signedAt,
        @Schema(description = "Подписант; null, если подписи нет")
        Signer signedBy,
        @Schema(description = "Демонстрационный ли сценарий подписания", example = "true")
        boolean demo) {

    @Schema(description = "Снимок подписанта, сформированный сервером")
    public record Signer(
            @Schema(description = "Идентификатор пользователя", example = "1")
            Long id,
            @Schema(description = "ФИО подписанта", example = "Кузнецов Дмитрий Олегович")
            String fullName) {}
}
