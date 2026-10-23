package alfa.smartcredit.model;

import alfa.smartcredit.model.enums.ApplicationStatus;
import alfa.smartcredit.model.enums.DecisionStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import tools.jackson.databind.JsonNode;

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

    @Column(name = "risk_score")
    private Integer riskScore;
    @Column(name = "risk_class")
    private String riskClass;
    @Column(name = "ai_comment")
    private String aiComment;
    @Column(name = "officer_comment")
    private String officerComment;
    @Column(name = "business_task") private String businessTask;

    @Column(name = "term_days") private Integer termDays;               // 30 | 60 | 90
    private BigDecimal rate;                                            // базовая ставка по сроку
    @Column(name = "final_rate") private BigDecimal finalRate;          // итоговая ставка (DecisionEngine)
    @Enumerated(EnumType.STRING) private DecisionStatus decision;       // решение DecisionEngine
    @Column(name = "calculated_limit") private BigDecimal calculatedLimit;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "scoring_data")
    private JsonNode scoringData;                                       // снимок скоринга

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "form_data")
    private JsonNode formData;
}
