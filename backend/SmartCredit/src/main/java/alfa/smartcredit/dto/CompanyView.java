package alfa.smartcredit.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Реквизиты компании")
public record CompanyView(
        @Schema(description = "Идентификатор компании", example = "1")
        Long id,
        @Schema(description = "Название компании", example = "ИП Кузнецов Дмитрий Олегович")
        String name,
        @Schema(description = "ИНН", example = "772834561209")
        String inn,
        @Schema(description = "Основной ОКВЭД", example = "62.01")
        String okved,
        @Schema(description = "Правовая форма", example = "IP", allowableValues = {"IP", "OOO"})
        String legalForm) {}
