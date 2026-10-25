package alfa.smartcredit.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.flyway.autoconfigure.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Полный сброс демо-базы при каждом запуске приложения.
 * Flyway удаляет все объекты схемы, заново применяет миграции,
 * после чего DemoDataSeeder создаёт актуальные демо-сценарии.
 */
@Configuration
@Slf4j
public class DatabaseResetConfig {

    @Bean
    FlywayMigrationStrategy resetAndMigrate(
            @Value("${app.demo.reset-db-on-startup:true}") boolean resetDatabase) {
        return flyway -> {
            if (resetDatabase) {
                log.warn("Сброс демо-базы включён: удаляю все данные перед миграциями");
                flyway.clean();
            }
            flyway.migrate();
        };
    }
}
