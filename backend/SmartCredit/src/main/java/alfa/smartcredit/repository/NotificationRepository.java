package alfa.smartcredit.repository;

import alfa.smartcredit.model.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface NotificationRepository extends JpaRepository<Notification, Long> {
    long countByCompanyIdAndReadFalse(Long companyId);

    List<Notification> findByCompanyIdOrderByCreatedAtDesc(Long companyId);

    @Modifying
    @Query("update Notification n set n.read = true where n.id = :id and n.companyId = :companyId")
    int markRead(@Param("id") Long id, @Param("companyId") Long companyId);

    @Modifying
    @Query("update Notification n set n.read = true where n.companyId = :companyId and n.read = false")
    int markAllRead(@Param("companyId") Long companyId);
}