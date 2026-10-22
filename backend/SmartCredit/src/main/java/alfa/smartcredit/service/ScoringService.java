package alfa.smartcredit.service;

import alfa.smartcredit.dto.ApplicationFormDto;
import alfa.smartcredit.model.Company;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

@Service
public class ScoringService {

    public record Result(int score, String riskClass, String comment) {}

    public Result score(Company c, ApplicationFormDto form) {
        BigDecimal amount = form.step1().amount();
        int term = form.step1().termMonths();
        BigDecimal revenue = form.step2().financials().monthlyRevenue();
        BigDecimal debt = form.step2().financials().existingMonthlyDebtPayment();

        // грубая оценка нового платежа: тело кредита + ~18% годовых равномерно
        BigDecimal newPayment = amount.multiply(new BigDecimal("1.18"))
                .divide(BigDecimal.valueOf(term), 2, RoundingMode.HALF_UP);
        double dti = debt.add(newPayment).multiply(BigDecimal.valueOf(100))
                .divide(revenue, 1, RoundingMode.HALF_UP).doubleValue();

        int score = 50;
        List<String> notes = new ArrayList<>();

        if (dti <= 30)      { score += 25; notes.add("низкая долговая нагрузка (" + dti + "%)"); }
        else if (dti <= 50) { score += 10; notes.add("умеренная долговая нагрузка (" + dti + "%)"); }
        else if (dti <= 70) { score -= 10; notes.add("высокая долговая нагрузка (" + dti + "%)"); }
        else                { score -= 30; notes.add("очень высокая долговая нагрузка (" + dti + "%)"); }

        LocalDate reg = form.step2().applicant().registrationDate();
        long years = reg == null ? 0 : ChronoUnit.YEARS.between(reg, LocalDate.now());
        if (years > 5)      { score += 15; notes.add("бизнесу больше 5 лет"); }
        else if (years > 2) { score += 8;  notes.add("бизнесу от 2 до 5 лет"); }
        else                { notes.add("молодой бизнес"); }

        score = Math.max(0, Math.min(100, score));
        String cls = score >= 80 ? "A" : score >= 60 ? "B" : score >= 40 ? "C" : "D";
        String verdict = switch (cls) {
            case "A" -> "Низкий риск, можно выдавать на запрошенных условиях.";
            case "B" -> "Средний риск, возможна выдача, при необходимости со сниженной суммой.";
            case "C" -> "Повышенный риск, стоит предложить альтернативные условия.";
            default  -> "Высокий риск, рекомендуется отказ.";
        };
        return new Result(score, cls, verdict + " Факторы: " + String.join(", ", notes) + ".");
    }
}
