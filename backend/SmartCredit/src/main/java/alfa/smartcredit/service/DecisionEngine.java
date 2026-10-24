package alfa.smartcredit.service;

import alfa.smartcredit.model.enums.DecisionStatus;
import alfa.smartcredit.model.enums.RiskClass;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Service
public class DecisionEngine {

    private static final DecisionStatus INADEQUATE_REQUEST_STATUS = DecisionStatus.DECLINED;

    public record Decision(DecisionStatus status, BigDecimal finalRate, BigDecimal amount, String reason) {}

    public Decision decide(BigDecimal amount, BigDecimal monthlyRevenue, ScoringService.Result s) {
        // УРОВЕНЬ 1
        if (!s.dataComplete())
            return stop(DecisionStatus.INFO_REQUIRED, "Не все данные заявки заполнены.");
        if (s.external().delinquencies12m() >= 2)
            return stop(DecisionStatus.DECLINED, "Две и более просрочки за 12 месяцев.");
        if (s.dtiPercent() > 70.0)
            return stop(DecisionStatus.DECLINED, "Долговая нагрузка (DTI) " + s.dtiPercent() + "% выше 70%.");
        if (s.internalScore() < 40)
            return stop(DecisionStatus.DECLINED, "Скоринговый балл " + s.internalScore() + " ниже 40.");
        if (s.businessScale() == ProductRules.BusinessScale.OUT_OF_SCOPE)
            return stop(DecisionStatus.DECLINED, "Бизнес не проходит по масштабу (OUT_OF_SCOPE).");
        if (amount.compareTo(monthlyRevenue.multiply(BigDecimal.valueOf(ProductRules.INADEQUATE_REQUEST_REVENUE_MONTHS))) > 0)
            return stop(INADEQUATE_REQUEST_STATUS, "Запрошенная сумма больше полугодовой выручки.");

        // УРОВЕНЬ 2
        RiskClass cls = s.riskClass();
        BigDecimal industryPremium = BigDecimal.valueOf(s.industryRatePremium());

        // Для APPROVED: базовая ставка + отраслевая премия (без премии за класс)
        BigDecimal approvedRate = s.rate().add(industryPremium).setScale(2, RoundingMode.HALF_UP);
        // Для ALTERNATIVE: базовая + премия класса + отраслевая
        BigDecimal alternativeRate = finalRate(s.rate(), cls, s.industryRatePremium());

        // УРОВЕНЬ 3
        double dti = s.dtiPercent();
        boolean withinLimit = amount.compareTo(s.calculatedLimit()) <= 0;
        String base = "Скоринг " + s.internalScore() + " (класс " + cls + "), DTI " + dti + "%. ";

        if ((cls == RiskClass.A || cls == RiskClass.B) && dti <= 50 && withinLimit)
            return new Decision(DecisionStatus.APPROVED, approvedRate, amount, base + "Заявка одобрена на запрошенных условиях.");

        if (cls == RiskClass.A || cls == RiskClass.B)
            return new Decision(DecisionStatus.ALTERNATIVE_OFFER, alternativeRate, amount.min(s.calculatedLimit()),
                    base + "Предложены другие условия: сумма ограничена расчётным лимитом.");

        if (cls == RiskClass.C && dti <= 60)
            return new Decision(DecisionStatus.ALTERNATIVE_OFFER, alternativeRate, amount.min(s.calculatedLimit()),
                    base + "Предложены другие условия: сумма ограничена расчётным лимитом.");

        return stop(DecisionStatus.MANUAL_REVIEW, base + "Нужна ручная проверка менеджером банка.");
    }

    public BigDecimal finalRate(BigDecimal rate, RiskClass cls, double industryRatePremium) {
        if (rate == null) return null;
        return rate.add(ProductRules.riskPremium(cls))
                .add(BigDecimal.valueOf(industryRatePremium))
                .setScale(2, RoundingMode.HALF_UP);
    }

    private Decision stop(DecisionStatus status, String reason) {
        return new Decision(status, null, null, reason);
    }
}