package alfa.smartcredit.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

@Schema(description = "Результат заполнения анкеты ИИ")
public record PrefillResponse(
        @Schema(description = "Анкета с заполненными полями")
        ApplicationFormDto form,
        @Schema(description = "Поля, которые заполнил ИИ (на фронте подсвечиваются)",
                example = "[\"step1.amount\", \"step2.applicant.industry\"]")
        List<String> aiFilled,
        @Schema(description = "Поля, которые клиенту нужно дозаполнить",
                example = "[\"step2.financials.existingDebt\"]")
        List<String> missingFields) {}
