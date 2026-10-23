package alfa.smartcredit.service;

import alfa.smartcredit.model.enums.DecisionStatus;
import alfa.smartcredit.model.enums.RiskClass;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** Итоговое кредитное решение: таблица решений из ТЗ (Уровни 1-3). */
@Service
public class DecisionEngine {

    /** Шаг 5 по ТЗ: «DECLINED (или MANUAL_REVIEW)». Переключите здесь, если нужна ручная проверка. */
    private static final DecisionStatus INADEQUATE_REQUEST_STATUS = DecisionStatus.DECLINED;

    /**
     * @param finalRate итоговая ставка; null для INFO_REQUIRED / DECLINED / MANUAL_REVIEW
     * @param amount    сумма к выдаче: amount для APPROVED, min(amount, calculatedLimit) для ALTERNATIVE_OFFER; иначе null
     */
    public record Decision(DecisionStatus status, BigDecimal finalRate, BigDecimal amount, String reason) {}

    public Decision decide(BigDecimal amount, BigDecimal monthlyRevenue, ScoringService.Result s) {
        // ---- УРОВЕНЬ 1 ----
        if (!s.dataComplete())
            return stop(DecisionStatus.INFO_REQUIRED, "Не все данные заявки заполнены.");
        if (s.external().delinquencies12m() >= 2)
            return stop(DecisionStatus.DECLINED, "Две и более просрочки за 12 месяцев.");
        if (s.dtiPercent() > 70.0)
            return stop(DecisionStatus.DECLINED, "Долговая нагрузка (DTI) " + s.dtiPercent() + "% выше 70%.");
        if (s.internalScore() < 40)
            return stop(DecisionStatus.DECLINED, "Скоринговый балл " + s.internalScore() + " ниже 40.");
        if (amount.compareTo(monthlyRevenue.multiply(BigDecimal.valueOf(ProductRules.INADEQUATE_REQUEST_REVENUE_MONTHS))) > 0)
            return stop(INADEQUATE_REQUEST_STATUS, "Запрошенная сумма больше полугодовой выручки.");

        // ---- УРОВЕНЬ 2 ----
        RiskClass cls = s.riskClass();
        BigDecimal finalRate = finalRate(s.rate(), cls, s.industryRatePremium());

        // ---- УРОВЕНЬ 3 ----
        double dti = s.dtiPercent();
        boolean withinLimit = amount.compareTo(s.calculatedLimit()) <= 0;
        String base = "Скоринг " + s.internalScore() + " (класс " + cls + "), DTI " + dti + "%. ";

        if ((cls == RiskClass.A || cls == RiskClass.B) && dti <= 50 && withinLimit)
            return new Decision(DecisionStatus.APPROVED, finalRate, amount, base + "Заявка одобрена на запрошенных условиях.");

        if (cls == RiskClass.A || cls == RiskClass.B)
            return new Decision(DecisionStatus.ALTERNATIVE_OFFER, finalRate, amount.min(s.calculatedLimit()),
                    base + "Предложены другие условия: сумма ограничена расчётным лимитом.");

        if (cls == RiskClass.C && dti <= 60)
            return new Decision(DecisionStatus.ALTERNATIVE_OFFER, finalRate, amount.min(s.calculatedLimit()),
                    base + "Предложены другие условия: сумма ограничена расчётным лимитом.");

        return stop(DecisionStatus.MANUAL_REVIEW, base + "Нужна ручная проверка менеджером банка.");
    }

    /** finalRate = rate + премия за класс риска + отраслевая надбавка. Используется и при ручном APPROVE. */
    public BigDecimal finalRate(BigDecimal rate, RiskClass cls, double industryRatePremium) {
        return rate.add(ProductRules.riskPremium(cls))
                .add(BigDecimal.valueOf(industryRatePremium))
                .setScale(2, RoundingMode.HALF_UP);
    }

    private Decision stop(DecisionStatus status, String reason) {
        return new Decision(status, null, null, reason);
    }
}
