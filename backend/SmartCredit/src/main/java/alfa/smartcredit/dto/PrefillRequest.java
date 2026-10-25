package alfa.smartcredit.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(description = "Запрос на заполнение анкеты по свободному тексту")
public record PrefillRequest(
        @Schema(description = "Описание бизнеса и параметров кредита в свободной форме",
                example = "ИП, IT-разработка, выручка 1 млн ₽ в месяц, нужен кредит 500 000 ₽ на 60 дней")
        @NotBlank @Size(max = 2000) String text) {}
