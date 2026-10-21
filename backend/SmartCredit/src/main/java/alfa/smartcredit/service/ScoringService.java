package alfa.smartcredit.service;

import alfa.smartcredit.model.Company;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;

@Service
public class ScoringService {

    public record Result(int score, String riskClass, String comment) {}

    public Result score(Company c, BigDecimal amount, int termMonths) {
        int digits = c.getInn().chars().map(ch -> ch - '0').sum();
        int score = 45 + (digits * 3) % 41;                       // 45..85, стабильно для одного ИНН
        if (amount.compareTo(new BigDecimal("3000000")) > 0) score -= 15;
        if (termMonths > 48) score -= 5;
        score = Math.max(0, Math.min(100, score));

        String cls = score >= 80 ? "A" : score >= 60 ? "B" : score >= 40 ? "C" : "D";
        String comment = switch (cls) {
            case "A" -> "Низкий риск: можно выдавать на запрошенных условиях.";
            case "B" -> "Средний риск: рекомендуется выдача, возможно со сниженной суммой.";
            case "C" -> "Повышенный риск: стоит предложить альтернативные условия.";
            default  -> "Высокий риск: рекомендуется отказ.";
        };
        return new Result(score, cls, comment);
    }
}
