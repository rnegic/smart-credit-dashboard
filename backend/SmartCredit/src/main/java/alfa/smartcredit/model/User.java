package alfa.smartcredit.model;

import alfa.smartcredit.model.enums.Role;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String login;
    private String password;
    @Enumerated(EnumType.STRING) private Role role;
    @Column(name = "full_name") private String fullName;
    private String description;
    @Column(name = "company_id") private Long companyId;
    private String phone;
    private String email;
    /** Порядок в списке демо-профилей; null = в списке не показывать. */
    @Column(name = "demo_order") private Integer demoOrder;
}
