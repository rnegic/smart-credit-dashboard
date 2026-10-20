package alfa.smartcredit.repository;

import alfa.smartcredit.model.Loan;
import alfa.smartcredit.model.enums.LoanStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface LoanRepository extends JpaRepository<Loan, Long> {
    Optional<Loan> findFirstByCompanyIdAndStatus(Long companyId, LoanStatus status);
}