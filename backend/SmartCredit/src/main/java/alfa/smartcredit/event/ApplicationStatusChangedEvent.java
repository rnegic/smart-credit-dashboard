package alfa.smartcredit.event;

/** Публикуется в момент смены статуса заявки; уведомление создаётся только после commit. */
public record ApplicationStatusChangedEvent(
        Long companyId,
        Long applicationId,
        String status,
        String message
) {}