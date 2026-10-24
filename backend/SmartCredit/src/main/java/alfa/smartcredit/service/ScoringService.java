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

@Service
@RequiredArgsConstructor
public class ScoringService {

    private final ExternalDataService externalData;

    public record Result(
            BigDecimal rate,
            double termMonthsEquivalent,
            BigDecimal newMonthlyPayment,
            double dtiPercent,
            double amountToRevenue,
            @JsonProperty("isDataComplete") boolean dataComplete,
            int internalScore,
            RiskClass riskClass,
            BkiZone bkiZone,
            double industryLimitCoef,
            double industryRatePremium,
            BigDecimal absoluteMaxAmount,
            BigDecimal calculatedLimit,
            ProductRules.BusinessScale businessScale, // только для ООО, у ИП null
            ExternalDataService.ExternalData external,
            Map<String, Integer> points) {

        public Result forClient() {
            return new Result(rate, termMonthsEquivalent, newMonthlyPayment, dtiPercent, amountToRevenue,
                    dataComplete, internalScore, riskClass, null, industryLimitCoef, industryRatePremium,
                    absoluteMaxAmount, calculatedLimit, businessScale, null, null);
        }
    }

    /** Совместимость со старыми вызовами: форма юрлица берётся из анкеты. */
    public boolean isDataComplete(ApplicationFormDto f) {
        boolean ooo = f != null && f.step2() != null && f.step2().applicant() != null
                && ProductRules.isOoo(f.step2().applicant().type());
        return isDataComplete(f, ooo);
    }

    public boolean isDataComplete(ApplicationFormDto f, boolean ooo) {
        if (f == null || f.step1() == null || f.step2() == null || f.step2().financials() == null) return false;
        var s1 = f.step1();
        var fin = f.step2().financials();

        // ООО: годовая выручка строго > 0 (по ней считаются масштаб и amountToRevenue) + численность.
        boolean oooComplete = !ooo || (fin.annualRevenue() != null && fin.annualRevenue().signum() > 0
                && fin.averageEmployeeCount() != null);

        return s1.amount() != null && s1.amount().compareTo(ProductRules.MIN_AMOUNT) >= 0
                && s1.termDays() != null && ProductRules.TERM_DAYS.contains(s1.termDays())
                && fin.monthlyRevenue() != null && fin.monthlyRevenue().signum() > 0
                && fin.existingDebt() != null && oooComplete;
    }

    public Result score(Company c, ApplicationFormDto form) {
        // Форма юрлица берём из компании (надёжнее, чем из анкеты, которую присылает клиент).
        final String legalForm = c.getLegalForm();
        final boolean ooo = ProductRules.isOoo(legalForm);

        var externalOverride = form == null || form.step2() == null
                ? null
                : form.step2().externalData();
        ExternalDataService.ExternalData ext = externalData.fetch(c, externalOverride);
        IndustryDirectory.Industry industry = IndustryDirectory.byOkved(c.getOkved());

        if (!isDataComplete(form, ooo)) {
            return new Result(null, 0, null, 0, 0, false, 0, RiskClass.D, BkiZone.fromScore(ext.bkiScore(), ooo),
                    industry.limitCoef(), industry.ratePremium(), ProductRules.ABSOLUTE_MAX_AMOUNT, null,
                    ooo ? ProductRules.BusinessScale.NEEDS_REVIEW : null, ext, Map.of());
        }

        var fin = form.step2().financials();
        BigDecimal amount = form.step1().amount();
        int termDays = form.step1().termDays();
        BigDecimal revenue = fin.monthlyRevenue();

        // 1. Масштаб бизнеса: только ООО (у ИП ставка от масштаба не зависит)
        ProductRules.BusinessScale scale = ooo
                ? ProductRules.calculateScale(fin.annualRevenue(), fin.averageEmployeeCount())
                : null;

        // 2. Ставка: ИП - по сроку (24.50/24.75/25.00), ООО - матрица масштаб x срок
        BigDecimal rate = ProductRules.baseRate(legalForm, scale, termDays);
        double termMonthsEq = termDays / (double) ProductRules.DAYS_IN_MONTH;
        BigDecimal newPayment = monthlyPayment(amount, rate, termDays);

        // 3. totalDebt = платежи по кредитам + иные обязательства (для ИП иных обязательств нет -> 0)
        BigDecimal other = fin.otherMonthlyObligations() == null ? BigDecimal.ZERO : fin.otherMonthlyObligations();
        BigDecimal totalDebt = fin.existingDebt().add(other);

        // 4. DTI = (totalDebt + newMonthlyPayment) / monthlyRevenue * 100
        double dti = totalDebt.add(newPayment).multiply(BigDecimal.valueOf(100))
                .divide(revenue, 2, RoundingMode.HALF_UP).doubleValue();

        // 5. amountToRevenue = amount / годовая выручка (ИП: monthlyRevenue * 12)
        BigDecimal annualRev = ooo
                ? fin.annualRevenue()
                : revenue.multiply(BigDecimal.valueOf(12));
        double amountToRevenue = amount.divide(annualRev, 4, RoundingMode.HALF_UP).doubleValue();

        Map<String, Integer> pts = new LinkedHashMap<>();
        pts.put("bkiScore", bkiPoints(ext.bkiScore()));
        pts.put("delinquencies12m", delinquencyPoints(ext.delinquencies12m()));
        pts.put("inquiries12m", inquiryPoints(ext.inquiries12m()));
        pts.put("revenueTrend", trendPoints(ext.revenueTrend()));
        pts.put("companyAgeYears", agePoints(ext.companyAgeYears()));
        pts.put("dtiPercent", dtiPoints(dti));
        pts.put("amountToRevenue", amountToRevenuePoints(amountToRevenue));
        pts.put("isDataComplete", 5);
        int score = pts.values().stream().mapToInt(Integer::intValue).sum();

        BigDecimal limit = calculatedLimit(revenue, industry.limitCoef());

        return new Result(rate, termMonthsEq, newPayment, dti, amountToRevenue, true, score,
                RiskClass.fromScore(score), BkiZone.fromScore(ext.bkiScore(), ooo),
                industry.limitCoef(), industry.ratePremium(), ProductRules.ABSOLUTE_MAX_AMOUNT, limit, scale, ext, pts);
    }

    /** calculatedLimit = min(monthlyRevenue * industryLimitCoef * 3, absoluteMaxAmount). */
    public BigDecimal calculatedLimit(BigDecimal monthlyRevenue, double industryLimitCoef) {
        return monthlyRevenue.multiply(ProductRules.LIMIT_REVENUE_MULTIPLIER)
                .multiply(BigDecimal.valueOf(industryLimitCoef))
                .min(ProductRules.ABSOLUTE_MAX_AMOUNT)
                .setScale(2, RoundingMode.HALF_UP);
    }

    /** newMonthlyPayment = amount / termMonthsEquivalent + amount * rate% * termDays / 365. */
    public BigDecimal monthlyPayment(BigDecimal amount, BigDecimal ratePercent, int termDays) {
        if (ratePercent == null) return BigDecimal.ZERO;
        BigDecimal principalPerMonth = amount.multiply(BigDecimal.valueOf(ProductRules.DAYS_IN_MONTH))
                .divide(BigDecimal.valueOf(termDays), 10, RoundingMode.HALF_UP);
        BigDecimal interest = amount.multiply(ratePercent).multiply(BigDecimal.valueOf(termDays))
                .divide(BigDecimal.valueOf(100L * ProductRules.DAYS_IN_YEAR), 10, RoundingMode.HALF_UP);
        return principalPerMonth.add(interest).setScale(2, RoundingMode.HALF_UP);
    }

    static int bkiPoints(int s)            { return s >= 750 ? 20 : s >= 600 ? 14 : s >= 450 ? 8 : 0; }
    static int delinquencyPoints(int n)    { return n == 0 ? 15 : n == 1 ? 7 : 0; }
    static int inquiryPoints(int n)        { return n <= 2 ? 5 : n <= 5 ? 2 : 0; }
    static int trendPoints(RevenueTrend t) { return switch (t) { case GROWING -> 15; case STABLE -> 10; case DECLINING -> 3; }; }
    static int agePoints(int years)        { return years >= 3 ? 10 : years >= 1 ? 5 : 0; }
    static int dtiPoints(double dti)       { return dti < 30 ? 20 : dti <= 50 ? 14 : dti <= 70 ? 7 : 0; }
    static int amountToRevenuePoints(double r) { return r < 0.3 ? 10 : r <= 0.6 ? 5 : 0; }
}
