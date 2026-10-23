package alfa.smartcredit.service;

import alfa.smartcredit.dto.NotificationDto;
import alfa.smartcredit.event.ApplicationStatusChangedEvent;
import alfa.smartcredit.model.Notification;
import alfa.smartcredit.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationService {

    private final NotificationRepository repo;

    /** companyId -> активные SSE-подписки. */
    private final Map<Long, CopyOnWriteArrayList<SseEmitter>> emitters = new ConcurrentHashMap<>();

    /** Слушает смену статуса и шлёт уведомление ТОЛЬКО после успешного commit транзакции. */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onApplicationStatusChanged(ApplicationStatusChangedEvent e) {
        try {
            notify(e.companyId(), e.message());
        } catch (Exception ex) {
            log.error("Не удалось создать уведомление по заявке {}", e.applicationId(), ex);
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public NotificationDto notify(Long companyId, String text) {
        Notification n = new Notification();
        n.setCompanyId(companyId);
        n.setText(text);
        n.setRead(false);
        n.setCreatedAt(Instant.now());
        n = repo.save(n);
        NotificationDto dto = toDto(n);
        push(companyId, dto);
        return dto;
    }

    public SseEmitter subscribe(Long companyId) {
        SseEmitter emitter = new SseEmitter(30 * 60 * 1000L); // 30 минут
        CopyOnWriteArrayList<SseEmitter> list =
                emitters.computeIfAbsent(companyId, k -> new CopyOnWriteArrayList<>());
        list.add(emitter);

        Runnable cleanup = () -> list.remove(emitter);
        emitter.onCompletion(cleanup);
        emitter.onTimeout(cleanup);
        emitter.onError(err -> cleanup.run());

        try {
            emitter.send(SseEmitter.event().name("connected").data("ok"));
        } catch (Exception ignored) {
            cleanup.run();
        }
        return emitter;
    }

    private void push(Long companyId, NotificationDto dto) {
        var list = emitters.get(companyId);
        if (list == null) return;
        for (SseEmitter e : list) {
            try {
                e.send(SseEmitter.event().name("notification").data(dto));
            } catch (Exception ex) {
                e.completeWithError(ex);
                list.remove(e);
            }
        }
    }

    @Transactional(readOnly = true)
    public List<NotificationDto> list(Long companyId) {
        return repo.findByCompanyIdOrderByCreatedAtDesc(companyId).stream()
                .map(this::toDto).toList();
    }

    @Transactional
    public void markRead(Long companyId, Long id) {
        repo.markRead(id, companyId);
    }

    @Transactional
    public void markAllRead(Long companyId) {
        repo.markAllRead(companyId);
    }

    private NotificationDto toDto(Notification n) {
        return new NotificationDto(n.getId(), n.getText(), n.isRead(), n.getCreatedAt());
    }
}