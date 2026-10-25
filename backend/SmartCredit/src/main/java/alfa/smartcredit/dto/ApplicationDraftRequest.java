package alfa.smartcredit.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.util.List;

@Schema(description = "Черновик анкеты для автосохранения")
public record ApplicationDraftRequest(
        @Schema(description = "Текущее состояние анкеты")
        @NotNull ApplicationFormDto form,
        @Schema(description = "Текущий шаг формы (0..3)", example = "2", minimum = "0", maximum = "3")
        @NotNull @Min(0) @Max(3) Integer currentStep,
        @Schema(description = "Поля, заполненные ИИ", example = "[\"step2.applicant.inn\"]")
        @NotNull List<String> aiFilled,
        @Schema(description = "Поля, которые клиенту ещё нужно заполнить",
                example = "[\"step2.financials.monthlyRevenue\"]")
        @NotNull List<String> missingFields,
        @Schema(description = "Ревизия черновика для защиты от конкурентного изменения; "
                + "null при первом сохранении", example = "3")
        @PositiveOrZero Long revision) {}
