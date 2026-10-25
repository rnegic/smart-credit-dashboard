package alfa.smartcredit.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Комментарий сотрудника банка, сгенерированный ИИ")
public record CommentSuggestionResponse(
        @Schema(description = "Текст комментария",
                example = "Одобрено на запрошенных условиях: высокий кредитный рейтинг, "
                        + "растущая выручка и низкая долговая нагрузка.")
        String comment) {}
