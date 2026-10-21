package alfa.smartcredit.repository;

import alfa.smartcredit.model.Payment;
import alfa.smartcredit.model.enums.PaymentStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PaymentRepository extends JpaRepository<Payment, Long> {
    Optional<Payment> findFirstByLoanIdAndStatusOrderByDueDateAsc(Long loanId, PaymentStatus status);
}
