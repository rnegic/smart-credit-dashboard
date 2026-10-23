package alfa.smartcredit.service;

import alfa.smartcredit.dto.ApplicationFormDto;
import alfa.smartcredit.model.Company;
import alfa.smartcredit.model.enums.BkiZone;
import alfa.smartcredit.model.enums.RevenueTrend;
import alfa.smartcredit.model.enums.RiskClass;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.LinkedHashMap;
import java.util.Map;

/** Расчёт производных полей и internalScore (0..100) строго по ТЗ. */
@Service
@RequiredArgsConstructor
public class ScoringService {

    private final ExternalDataService externalData;

    /** Снимок скоринга: Группы 2 и 3 из ТЗ. Хранится в credit_applications.scoring_data и отдаётся в ApplicationView. */
    public record Result(
            BigDecimal rate,
            double termMonthsEquivalent,
            BigDecimal newMonthlyPayment,
            double dtiPercent,
            double amountToRevenue,
            @JsonProperty("isDataComplete") boolean dataComplete,
            int internalScore,
            RiskClass riskClass,
            BkiZone bkiZone,                       // только для UI менеджера банка
            double industryLimitCoef,
            double industryRatePremium,
            BigDecimal absoluteMaxAmount,
            BigDecimal calculatedLimit,
            ExternalDataService.ExternalData external,  // только для банка
            Map<String, Integer> points) {              // только для банка: баллы по критериям

        /** Версия для клиента: без внутренних данных банка (bkiZone, данные БКИ/ФНС, разбивка баллов). */
        public Result forClient() {
            return new Result(rate, termMonthsEquivalent, newMonthlyPayment, dtiPercent, amountToRevenue,
                    dataComplete, internalScore, riskClass, null, industryLimitCoef, industryRatePremium,
                    absoluteMaxAmount, calculatedLimit, null, null);
        }
    }

    public boolean isDataComplete(ApplicationFormDto f) {
        if (f == null || f.step1() == null || f.step2() == null || f.step2().financials() == null) return false;
        var s1 = f.step1();
        var fin = f.step2().financials();
        return s1.amount() != null && s1.amount().compareTo(ProductRules.MIN_AMOUNT) >= 0
                && s1.termDays() != null && ProductRules.TERM_DAYS.contains(s1.termDays())
                && fin.monthlyRevenue() != null && fin.monthlyRevenue().signum() > 0
                && fin.existingDebt() != null;
    }

    public Result score(Company c, ApplicationFormDto form) {
        ExternalDataService.ExternalData ext = externalData.fetch(c);
        IndustryDirectory.Industry industry = IndustryDirectory.byOkved(c.getOkved());

        if (!isDataComplete(form)) {
            // Шаг 1 DecisionEngine остановит заявку (INFO_REQUIRED); считать остальное нечем.
            return new Result(null, 0, null, 0, 0, false, 0, RiskClass.D, BkiZone.fromScore(ext.bkiScore()),
                    industry.limitCoef(), industry.ratePremium(), ProductRules.ABSOLUTE_MAX_AMOUNT, null, ext, Map.of());
        }

        BigDecimal amount = form.step1().amount();
        int termDays = form.step1().termDays();
        BigDecimal revenue = form.step2().financials().monthlyRevenue();
        BigDecimal debt = form.step2().financials().existingDebt();

        BigDecimal rate = ProductRules.baseRate(termDays);
        double termMonthsEq = termDays / (double) ProductRules.DAYS_IN_MONTH;
        BigDecimal newPayment = monthlyPayment(amount, rate, termDays);

        double dti = debt.add(newPayment).multiply(BigDecimal.valueOf(100))
                .divide(revenue, 2, RoundingMode.HALF_UP).doubleValue();
        double amountToRevenue = amount.divide(revenue.multiply(BigDecimal.valueOf(12)), 4, RoundingMode.HALF_UP)
                .doubleValue();

        Map<String, Integer> pts = new LinkedHashMap<>();
        pts.put("bkiScore", bkiPoints(ext.bkiScore()));
        pts.put("delinquencies12m", delinquencyPoints(ext.delinquencies12m()));
        pts.put("inquiries12m", inquiryPoints(ext.inquiries12m()));
        pts.put("revenueTrend", trendPoints(ext.revenueTrend()));
        pts.put("companyAgeYears", agePoints(ext.companyAgeYears()));
        pts.put("dtiPercent", dtiPoints(dti));
        pts.put("amountToRevenue", amountToRevenuePoints(amountToRevenue));
        pts.put("isDataComplete", 5);
        int score = pts.values().stream().mapToInt(Integer::intValue).sum();   // 0..100

        // calculatedLimit: см. допущение в ProductRules.LIMIT_REVENUE_MULTIPLIER
        BigDecimal limit = revenue.multiply(ProductRules.LIMIT_REVENUE_MULTIPLIER)
                .multiply(BigDecimal.valueOf(industry.limitCoef()))
                .min(ProductRules.ABSOLUTE_MAX_AMOUNT)
                .setScale(2, RoundingMode.HALF_UP);

        return new Result(rate, termMonthsEq, newPayment, dti, amountToRevenue, true, score,
                RiskClass.fromScore(score), BkiZone.fromScore(ext.bkiScore()),
                industry.limitCoef(), industry.ratePremium(), ProductRules.ABSOLUTE_MAX_AMOUNT, limit, ext, pts);
    }

    /**
     * newMonthlyPayment = amount / termMonthsEquivalent + amount * (rate/100) * (termDays/365).
     * Пример из ТЗ: 1 000 000, 30 дней, 20% → 1 016 438.36.
     */
    public BigDecimal monthlyPayment(BigDecimal amount, BigDecimal ratePercent, int termDays) {
        BigDecimal principalPerMonth = amount.multiply(BigDecimal.valueOf(ProductRules.DAYS_IN_MONTH))
                .divide(BigDecimal.valueOf(termDays), 10, RoundingMode.HALF_UP);
        BigDecimal interest = amount.multiply(ratePercent).multiply(BigDecimal.valueOf(termDays))
                .divide(BigDecimal.valueOf(100L * ProductRules.DAYS_IN_YEAR), 10, RoundingMode.HALF_UP);
        return principalPerMonth.add(interest).setScale(2, RoundingMode.HALF_UP);
    }

    // ---- таблицы баллов из ТЗ (итого максимум 100) ----

    static int bkiPoints(int s)            { return s >= 750 ? 20 : s >= 600 ? 14 : s >= 450 ? 8 : 0; }
    static int delinquencyPoints(int n)    { return n == 0 ? 15 : n == 1 ? 7 : 0; }
    static int inquiryPoints(int n)        { return n <= 2 ? 5 : n <= 5 ? 2 : 0; }
    static int trendPoints(RevenueTrend t) { return switch (t) { case GROWING -> 15; case STABLE -> 10; case DECLINING -> 3; }; }
    static int agePoints(int years)        { return years >= 3 ? 10 : years >= 1 ? 5 : 0; }
    static int dtiPoints(double dti)       { return dti < 30 ? 20 : dti <= 50 ? 14 : dti <= 70 ? 7 : 0; }
    static int amountToRevenuePoints(double r) { return r < 0.3 ? 10 : r <= 0.6 ? 5 : 0; }
}
