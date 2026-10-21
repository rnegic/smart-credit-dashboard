package alfa.smartcredit.repository;

import alfa.smartcredit.model.Offer;
import alfa.smartcredit.model.enums.OfferStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface OfferRepository extends JpaRepository<Offer, Long> {
    List<Offer> findByCompanyIdAndStatus(Long companyId, OfferStatus status);
    Optional<Offer> findFirstByApplicationIdOrderByIdDesc(Long applicationId);
}
