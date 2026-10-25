package alfa.smartcredit.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.List;

@Schema(description = "Сохранённый черновик анкеты")
public record ApplicationDraftResponse(
        @Schema(description = "Состояние анкеты")
        ApplicationFormDto form,
        @Schema(description = "Текущий шаг формы", example = "2")
        int currentStep,
        @Schema(description = "Поля, заполненные ИИ")
        List<String> aiFilled,
        @Schema(description = "Поля, которые клиенту ещё нужно заполнить")
        List<String> missingFields,
        @Schema(description = "Ревизия черновика", example = "4")
        long revision,
        @Schema(description = "Когда черновик был сохранён", example = "2026-10-25T12:00:00Z")
        Instant updatedAt) {}
