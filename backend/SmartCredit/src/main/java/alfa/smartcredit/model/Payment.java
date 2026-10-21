package alfa.smartcredit.model;

import alfa.smartcredit.model.enums.PaymentStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "payments")
@Getter
@Setter
@NoArgsConstructor
public class Payment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "loan_id") private Long loanId;
    @Column(name = "due_date") private LocalDate dueDate;
    private BigDecimal amount;
    @Enumerated(EnumType.STRING) private PaymentStatus status;
}
