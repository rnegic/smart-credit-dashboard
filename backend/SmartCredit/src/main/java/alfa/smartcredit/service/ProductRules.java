package alfa.smartcredit.service;

import alfa.smartcredit.model.enums.RiskClass;

import java.math.BigDecimal;
import java.util.Set;

/** Константы и простые правила продукта «овердрафт» из ТЗ. */
public final class ProductRules {
    private ProductRules() {}

    public static final BigDecimal MIN_AMOUNT = new BigDecimal("50000");
    /** absoluteMaxAmount: абсолютный максимум по продукту. */
    public static final BigDecimal ABSOLUTE_MAX_AMOUNT = new BigDecimal("20000000");
    public static final Set<Integer> TERM_DAYS = Set.of(30, 60, 90);
    public static final int DAYS_IN_YEAR = 365;
    public static final int DAYS_IN_MONTH = 30;

    /**
     * ВНИМАНИЕ: в ТЗ нет формулы calculatedLimit (написано только «Формула», &gt; 0).
     * Принято допущение: limit = monthlyRevenue * LIMIT_REVENUE_MULTIPLIER * industryLimitCoef,
     * но не больше ABSOLUTE_MAX_AMOUNT. Поменяйте множитель/формулу в одном месте здесь и в ScoringService.
     */
    public static final BigDecimal LIMIT_REVENUE_MULTIPLIER = new BigDecimal("3");

    /** Шаг 5 таблицы решений: amount > monthlyRevenue * 6. */
    public static final int INADEQUATE_REQUEST_REVENUE_MONTHS = 6;

    /** Базовая ставка rate по сроку транша; null, если срок недопустим. */
    public static BigDecimal baseRate(Integer termDays) {
        if (termDays == null) return null;
        return switch (termDays) {
            case 30 -> new BigDecimal("24.50");
            case 60 -> new BigDecimal("24.75");
            case 90 -> new BigDecimal("25.00");
            default -> null;
        };
    }

    /** Премия за класс риска: A = +0.00, B = +0.25, C = +0.50 (D в авто-решении не доходит до этого шага). */
    public static BigDecimal riskPremium(RiskClass cls) {
        return switch (cls) {
            case A -> new BigDecimal("0.00");
            case B -> new BigDecimal("0.25");
            case C, D -> new BigDecimal("0.50");
        };
    }

    public static int termMonthsRoundedUp(int termDays) {
        return (int) Math.ceil(termDays / (double) DAYS_IN_MONTH);
    }
}
