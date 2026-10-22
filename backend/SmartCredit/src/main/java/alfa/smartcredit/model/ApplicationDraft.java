package alfa.smartcredit.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import tools.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.List;

@Entity
@Table(name = "application_drafts")
@Getter
@Setter
@NoArgsConstructor
public class ApplicationDraft {
    @Id
    @Column(name = "company_id")
    private Long companyId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "form_data", nullable = false)
    private JsonNode formData;

    @Column(name = "current_step", nullable = false)
    private int currentStep;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "ai_filled", nullable = false)
    private List<String> aiFilled;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "missing_fields", nullable = false)
    private List<String> missingFields;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "revision", nullable = false)
    private Long revision;
}
