package alfa.smartcredit.controller;

import alfa.smartcredit.dto.NotificationDto;
import alfa.smartcredit.service.NotificationService;
import alfa.smartcredit.service.SessionContext;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notifications;
    private final SessionContext sessionContext;

    /** Список уведомлений (polling-вариант для фронта). */
    @GetMapping
    public List<NotificationDto> list(HttpServletRequest request) {
        return notifications.list(sessionContext.requireCompanyId(request));
    }

    /** SSE-поток: фронт получает новые уведомления в реальном времени. */
    @GetMapping("/stream")
    public SseEmitter stream(HttpServletRequest request) {
        return notifications.subscribe(sessionContext.requireCompanyId(request));
    }

    @PatchMapping("/{id}/read")
    public ResponseEntity<Void> markRead(@PathVariable Long id, HttpServletRequest request) {
        notifications.markRead(sessionContext.requireCompanyId(request), id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/read-all")
    public ResponseEntity<Void> markAllRead(HttpServletRequest request) {
        notifications.markAllRead(sessionContext.requireCompanyId(request));
        return ResponseEntity.noContent().build();
    }
}