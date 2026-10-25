package alfa.smartcredit.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/** Один документ пакета. content — обычный текст, не HTML. */
@Schema(description = "Документ пакета оферты")
public record DocumentDto(
        @Schema(description = "Тип документа", example = "OFFER")
        String type,
        @Schema(description = "Название документа", example = "Предложение о заключении договора")
        String title,
        @Schema(description = "Текст документа в виде обычного текста (не HTML)")
        String content) {}
