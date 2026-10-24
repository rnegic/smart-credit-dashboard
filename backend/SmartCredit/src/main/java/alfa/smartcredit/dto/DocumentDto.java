package alfa.smartcredit.dto;

/** Один документ пакета. content — обычный текст, не HTML. */
public record DocumentDto(String type, String title, String content) {}