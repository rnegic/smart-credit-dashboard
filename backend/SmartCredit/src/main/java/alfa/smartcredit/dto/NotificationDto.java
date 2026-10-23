package alfa.smartcredit.dto;

import java.time.Instant;

public record NotificationDto(Long id, String text, boolean read, Instant createdAt) {}
