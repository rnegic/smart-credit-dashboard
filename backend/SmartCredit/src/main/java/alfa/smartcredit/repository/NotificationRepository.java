package alfa.smartcredit.repository;

import alfa.smartcredit.model.Notification;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificationRepository extends JpaRepository<Notification, Long> {
    long countByCompanyIdAndReadFalse(Long companyId);
}