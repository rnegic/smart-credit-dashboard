package alfa.smartcredit.repository;

import alfa.smartcredit.model.Offer;
import alfa.smartcredit.model.enums.OfferStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface OfferRepository extends JpaRepository<Offer, Long> {
    /** Serialize acceptance and signature writes for the same offer. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from Offer o where o.id = :id")
    Optional<Offer> findForUpdate(@Param("id") Long id);

    List<Offer> findByCompanyIdAndStatus(Long companyId, OfferStatus status);
    Optional<Offer> findFirstByApplicationIdOrderByIdDesc(Long applicationId);
}
