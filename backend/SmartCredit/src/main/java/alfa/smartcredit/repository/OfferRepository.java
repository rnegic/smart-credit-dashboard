package alfa.smartcredit.repository;

import alfa.smartcredit.model.Offer;
import alfa.smartcredit.model.enums.OfferStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface OfferRepository extends JpaRepository<Offer, Long> {
    List<Offer> findByCompanyIdAndStatus(Long companyId, OfferStatus status);
}
