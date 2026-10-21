package alfa.smartcredit.repository;

import alfa.smartcredit.model.Company;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

public interface CompanyRepository extends JpaRepository<Company, Long> {
    @Modifying
    @Transactional
    @Query("delete from Company c where c.createdAt < :before")
    int deleteOlderThan(@Param("before") Instant before);
}
