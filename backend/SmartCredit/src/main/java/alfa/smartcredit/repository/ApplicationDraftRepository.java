package alfa.smartcredit.repository;

import alfa.smartcredit.model.ApplicationDraft;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface ApplicationDraftRepository extends JpaRepository<ApplicationDraft, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from ApplicationDraft d where d.companyId = :companyId")
    Optional<ApplicationDraft> findForUpdate(@Param("companyId") Long companyId);

    @Modifying
    @Query("delete from ApplicationDraft d where d.companyId = :companyId")
    void deleteByCompanyId(@Param("companyId") Long companyId);
}
