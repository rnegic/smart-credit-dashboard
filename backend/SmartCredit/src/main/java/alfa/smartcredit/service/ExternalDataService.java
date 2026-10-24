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
    private static final Map<String, int[]> DEMO = Map.of(
            "772012345678", new int[]{780, 0, 1, 0, 0},  // Иванов: сильный
            "7701234567",   new int[]{640, 1, 3, 2, 1},  // Ромашка: средний
            "502912345678", new int[]{710, 0, 2, 1, 1},  // Петрова
            "7812345678",   new int[]{820, 0, 0, 1, 0},  // Вектор
            "772567890123", new int[]{680, 1, 4, 0, 2},  // Орлов: слабый
            "7712345678",   new int[]{400, 2, 6, 3, 2}   // Маяк: отказ по просрочкам
    ); // {bkiScore, delinquencies12m, inquiries12m, activeLoans, trendOrdinal(GROWING=0,STABLE=1,DECLINING=2)}

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

    /** Мок ЕГРИП/ЕГРЮЛ: дата регистрации детерминирована по ИНН. */
    public static LocalDate registrationDate(String inn) {
        int h = Math.abs(inn.hashCode());
        return LocalDate.of(2008 + h % 16, 1 + h % 12, 1 + h % 28);
    }
}
