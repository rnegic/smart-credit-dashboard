package alfa.smartcredit.dto;

import java.util.List;

public record PrefillResponse(
        ApplicationFormDto form,
        List<String> aiFilled,        // что заполнил ИИ (подсветить как «предложено ИИ»)
        List<String> missingFields) {} // что клиенту нужно дозаполнить
