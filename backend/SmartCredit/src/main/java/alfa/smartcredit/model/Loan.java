package alfa.smartcredit.model;

import alfa.smartcredit.model.enums.LoanStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "loans")
@Getter
@Setter
@NoArgsConstructor
public class Loan {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "company_id") private Long companyId;
    private BigDecimal principal;
    @Column(name = "rate_percent") private BigDecimal ratePercent;
    @Column(name = "term_months") private Integer termMonths;
    @Column(name = "monthly_payment") private BigDecimal monthlyPayment;
    @Column(name = "remaining_balance") private BigDecimal remainingBalance;
    @Column(name = "start_date") private LocalDate startDate;
    @Enumerated(EnumType.STRING) private LoanStatus status;
}
