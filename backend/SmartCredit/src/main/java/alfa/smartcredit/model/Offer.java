package alfa.smartcredit.model;

import alfa.smartcredit.model.enums.OfferStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import tools.jackson.databind.JsonNode;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "offers")
@Getter
@Setter
@NoArgsConstructor
public class Offer {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "company_id") private Long companyId;
    @Column(name = "application_id") private Long applicationId;
    private BigDecimal amount;
    @Column(name = "term_months") private Integer termMonths;   // legacy, NOT NULL: ceil(termDays / 30)
    @Column(name = "term_days") private Integer termDays;
    @Column(name = "rate_percent") private BigDecimal ratePercent;
    @Column(name = "monthly_payment") private BigDecimal monthlyPayment;
    @Column(name = "valid_until") private LocalDate validUntil;
    @Enumerated(EnumType.STRING) private OfferStatus status;

    @JdbcTypeCode(SqlTypes.JSON)
    private JsonNode documents;

    /** Срок договора овердрафта в месяцах: 6, 12 или 24. */
    @Column(name = "contract_term_months") private Integer contractTermMonths;
    /** Надбавка прежней модели; новые транши используют сохранённую rate_percent. */
    @Column(name = "rate_spread") private BigDecimal rateSpread;
    /** Начало и конец договора: заполняются при подписании. */
    @Column(name = "contract_start") private LocalDate contractStart;
    @Column(name = "contract_end") private LocalDate contractEnd;

    @Column(name = "document_version") private String documentVersion;
    @Column(name = "signed_at") private Instant signedAt;
    @Column(name = "signed_by_id") private Long signedById;
    @Column(name = "signed_by_full_name") private String signedByFullName;
}
