package alfa.smartcredit.model;

import alfa.smartcredit.model.enums.TrancheStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/** Один овердрафт (транш) внутри действующего договора. */
@Entity
@Table(name = "tranches")
@Getter
@Setter
@NoArgsConstructor
public class Tranche {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "company_id") private Long companyId;
    /** Договор = подписанная оферта. */
    @Column(name = "offer_id") private Long offerId;
    @Column(name = "application_id") private Long applicationId;
    private BigDecimal amount;
    @Column(name = "term_days") private Integer termDays;
    @Column(name = "rate_percent") private BigDecimal ratePercent;
    @Column(name = "issued_at") private LocalDate issuedAt;
    @Column(name = "due_date") private LocalDate dueDate;
    @Enumerated(EnumType.STRING) private TrancheStatus status;
    @Column(name = "repaid_at") private LocalDate repaidAt;
    @Column(name = "interest_paid") private BigDecimal interestPaid;
    @Column(name = "created_at") private Instant createdAt = Instant.now();
}
