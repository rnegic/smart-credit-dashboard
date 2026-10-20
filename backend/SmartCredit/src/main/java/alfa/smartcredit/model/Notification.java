package alfa.smartcredit.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "notifications")
@Getter
@Setter
@NoArgsConstructor
public class Notification {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "company_id") private Long companyId;
    private String text;
    @Column(name = "is_read") private boolean read;
    @Column(name = "created_at") private Instant createdAt = Instant.now();
}
