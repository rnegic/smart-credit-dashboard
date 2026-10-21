package alfa.smartcredit.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "companies")
@Getter
@Setter
@NoArgsConstructor
public class Company {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "profile_id") private String profileId;
    private String name;
    private String inn;
    private String okved;
    @Column(name = "created_at")
    private Instant createdAt = Instant.now();
    @Column(name = "legal_form")
    private String legalForm;   // "IP" | "OOO" | null
}
