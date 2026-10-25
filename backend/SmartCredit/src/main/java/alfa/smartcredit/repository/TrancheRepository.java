package alfa.smartcredit.repository;

import alfa.smartcredit.model.Tranche;
import alfa.smartcredit.model.enums.TrancheStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface TrancheRepository extends JpaRepository<Tranche, Long> {
    List<Tranche> findByOfferIdOrderByIdDesc(Long offerId);

    List<Tranche> findByCompanyIdAndStatus(Long companyId, TrancheStatus status);

    /** Сериализует погашение одного и того же транша. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from Tranche t where t.id = :id")
    Optional<Tranche> findForUpdate(@Param("id") Long id);
}
