package alfa.smartcredit.model;

import alfa.smartcredit.model.enums.ApplicationStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "credit_applications")
@Getter
@Setter
@NoArgsConstructor
public class CreditApplication {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "company_id") private Long companyId;
    private BigDecimal amount;
    @Column(name = "term_months") private Integer termMonths;
    private String purpose;
    @Enumerated(EnumType.STRING) private ApplicationStatus status;
    @Column(name = "created_at") private Instant createdAt = Instant.now();
}
