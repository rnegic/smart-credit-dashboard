package alfa.smartcredit.repository;

import alfa.smartcredit.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByLogin(String login);

    /** Демо-профили для жюри: только пользователи с заданным demo_order, по порядку. */
    List<User> findByDemoOrderIsNotNullOrderByDemoOrderAsc();
}
