package alfa.smartcredit.service;

import alfa.smartcredit.dto.ApplicationFormDto;
import alfa.smartcredit.model.Company;
import alfa.smartcredit.model.enums.RevenueTrend;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Map;

/**
 * Моки внешних источников (ТЗ, Группа 2): БКИ, ФНС, ЕГРИП/ЕГРЮЛ.
 * Базовые данные определяются по ИНН; в демо-форме клиент может переопределить
 * отдельные значения для проверки скоринга.
 */
@Service
public class ExternalDataService {

    public record ExternalData(int bkiScore, int delinquencies12m, int inquiries12m, int activeLoans,
                               RevenueTrend revenueTrend, int companyAgeYears) {}

    /** Демо-профили для сидовых компаний, чтобы на демо получались разные решения. */
    private static final Map<String, int[]> DEMO = Map.ofEntries(
            Map.entry("772012345678", new int[]{780, 0, 1, 0, 0}),  // Иванов: сильный
            Map.entry("7701234567",   new int[]{640, 1, 3, 2, 1}),  // Ромашка: средний
            Map.entry("502912345678", new int[]{710, 0, 2, 1, 1}),  // Петрова
            Map.entry("7812345678",   new int[]{820, 0, 0, 1, 0}),  // Вектор
            Map.entry("772567890123", new int[]{680, 1, 4, 0, 2}),  // Орлов: слабый
            Map.entry("7712345678",   new int[]{400, 2, 6, 3, 2}),  // Маяк: отказ по просрочкам
            // --- 4 показательных сценария для жюри (см. DemoScenarioCatalog) ---
            Map.entry("772834561209", new int[]{800, 0, 1, 0, 0}),  // 1. ИП Кузнецов: идеальный -> APPROVED
            Map.entry("7708123456",   new int[]{700, 0, 1, 1, 0}),  // 2. ООО СтройРесурс -> ALTERNATIVE_OFFER
            Map.entry("502745123876", new int[]{500, 1, 4, 0, 2}),  // 3. ИП Белова: пограничный -> MANUAL_REVIEW
            Map.entry("7743987654",   new int[]{800, 0, 1, 0, 0})   // 4. ООО Нова-Софт: < 1 года -> DECLINED
    ); // {bkiScore, delinquencies12m, inquiries12m, activeLoans, trendOrdinal(GROWING=0,STABLE=1,DECLINING=2)}

    /** Возраст демо-компаний {лет, месяцев}: дата регистрации = сегодня минус этот возраст. */
    private static final Map<String, int[]> DEMO_AGE = Map.of(
            "772834561209", new int[]{5, 3},
            "7708123456",   new int[]{3, 4},
            "502745123876", new int[]{0, 8},
            "7743987654",   new int[]{0, 7}
    );

    public ExternalData fetch(Company c) {
        int[] d = DEMO.get(c.getInn());
        int age = (int) ChronoUnit.YEARS.between(registrationDate(c.getInn()), LocalDate.now());
        if (d != null) {
            return new ExternalData(d[0], d[1], d[2], d[3], RevenueTrend.values()[d[4]], age);
        }
        int h = Math.abs(c.getInn().hashCode());
        return new ExternalData(
                1 + h % 999,                       // 1..999
                h % 7 == 0 ? 2 : h % 4 == 0 ? 1 : 0,
                h % 9,
                h % 4,
                RevenueTrend.values()[h % 3],
                age);
    }

    public ExternalData fetch(Company c, ApplicationFormDto.ExternalDataOverride override) {
        ExternalData base = fetch(c);
        if (override == null) return base;
        return new ExternalData(
                override.bkiScore() != null ? override.bkiScore() : base.bkiScore(),
                override.delinquencies12m() != null ? override.delinquencies12m() : base.delinquencies12m(),
                override.inquiries12m() != null ? override.inquiries12m() : base.inquiries12m(),
                base.activeLoans(),
                override.revenueTrend() != null ? override.revenueTrend() : base.revenueTrend(),
                override.companyAgeYears() != null ? override.companyAgeYears() : base.companyAgeYears());
    }

    /** Мок ЕГРИП/ЕГРЮЛ: дата регистрации детерминирована по ИНН (для демо-сценариев задаётся возрастом). */
    public static LocalDate registrationDate(String inn) {
        int[] age = DEMO_AGE.get(inn);
        if (age != null) return LocalDate.now().minusYears(age[0]).minusMonths(age[1]);
        int h = Math.abs(inn.hashCode());
        return LocalDate.of(2008 + h % 16, 1 + h % 12, 1 + h % 28);
    }
}
