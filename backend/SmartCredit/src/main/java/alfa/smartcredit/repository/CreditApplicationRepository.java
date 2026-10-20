package alfa.smartcredit.repository;

import alfa.smartcredit.model.CreditApplication;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CreditApplicationRepository extends JpaRepository<CreditApplication, Long> {
    Optional<CreditApplication> findFirstByCompanyIdOrderByCreatedAtDesc(Long companyId);
}