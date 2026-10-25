package alfa.smartcredit.controller;

import alfa.smartcredit.config.OpenApiConfig;
import alfa.smartcredit.dto.NotificationDto;
import alfa.smartcredit.service.NotificationService;
import alfa.smartcredit.service.SessionContext;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
@Tag(name = "Уведомления")
@SecurityRequirement(name = OpenApiConfig.SESSION_SECURITY_SCHEME)
public class NotificationController {

    private final NotificationService notifications;
    private final SessionContext sessionContext;

    /** Список уведомлений (polling-вариант для фронта). */
    @GetMapping
    @Operation(summary = "Список уведомлений",
            description = "Уведомления компании, отсортированные от новых к старым.")
    public List<NotificationDto> list(HttpServletRequest request) {
        return notifications.list(sessionContext.requireCompanyId(request));
    }

    /** SSE-поток: фронт получает новые уведомления в реальном времени. */
    @GetMapping("/stream")
    @Operation(summary = "Поток уведомлений (SSE)",
            description = "Долгоживущее соединение Server-Sent Events для получения новых уведомлений в реальном времени.",
            responses = @ApiResponse(responseCode = "200", description = "Поток событий",
                    content = @Content(mediaType = org.springframework.http.MediaType.TEXT_EVENT_STREAM_VALUE)))
    public SseEmitter stream(HttpServletRequest request) {
        return notifications.subscribe(sessionContext.requireCompanyId(request));
    }

    @PatchMapping("/{id}/read")
    @Operation(summary = "Отметить уведомление прочитанным")
    public ResponseEntity<Void> markRead(
            @Parameter(description = "Идентификатор уведомления", example = "1") @PathVariable Long id,
            HttpServletRequest request) {
        notifications.markRead(sessionContext.requireCompanyId(request), id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/read-all")
    @Operation(summary = "Отметить все уведомления прочитанными")
    public ResponseEntity<Void> markAllRead(HttpServletRequest request) {
        notifications.markAllRead(sessionContext.requireCompanyId(request));
        return ResponseEntity.noContent().build();
    }
}