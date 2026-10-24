package alfa.smartcredit.service;

import alfa.smartcredit.model.enums.RiskClass;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Set;

public final class ProductRules {
    private ProductRules() {}

    public static final BigDecimal MIN_AMOUNT = new BigDecimal("50000");
    public static final BigDecimal ABSOLUTE_MAX_AMOUNT = new BigDecimal("20000000");
    public static final Set<Integer> TERM_DAYS = Set.of(30, 60, 90);
    public static final int DAYS_IN_YEAR = 365;
    public static final int DAYS_IN_MONTH = 30;

    public static final BigDecimal LIMIT_REVENUE_MULTIPLIER = new BigDecimal("3");
    public static final int INADEQUATE_REQUEST_REVENUE_MONTHS = 6;

    public enum BusinessScale {
        MICRO, SMALL, OUT_OF_SCOPE, NEEDS_REVIEW
    }

    /** Расчет масштаба бизнеса по ТЗ (Годовая выручка + Численность) */
    public static BusinessScale calculateScale(BigDecimal annualRevenue, Integer employeeCount) {
        if (annualRevenue == null || employeeCount == null) return BusinessScale.NEEDS_REVIEW;

        // MICRO: выручка <= 120 млн, сотрудников <= 15
        if (annualRevenue.compareTo(new BigDecimal("120000000")) <= 0 && employeeCount <= 15) {
            return BusinessScale.MICRO;
        }
        // SMALL: выручка <= 800 млн, сотрудников <= 100
        if (annualRevenue.compareTo(new BigDecimal("800000000")) <= 0 && employeeCount <= 100) {
            return BusinessScale.SMALL;
        }
        return BusinessScale.OUT_OF_SCOPE;
    }

    /** Базовая ставка rate для ООО (масштаб + срок) */
    public static BigDecimal baseRate(BusinessScale scale, Integer termDays) {
        if (termDays == null || scale == null) return null;

        if (scale == BusinessScale.MICRO) {
            return switch (termDays) {
                case 30 -> new BigDecimal("20.00");
                case 60 -> new BigDecimal("22.00");
                case 90 -> new BigDecimal("24.00");
                default -> null;
            };
        } else if (scale == BusinessScale.SMALL) {
            return switch (termDays) {
                case 30 -> new BigDecimal("19.00");
                case 60 -> new BigDecimal("21.00");
                case 90 -> new BigDecimal("23.00");
                default -> null;
            };
        }
        // Для OUT_OF_SCOPE ставка не рассчитывается
        return null;
    }

    public static BigDecimal riskPremium(RiskClass cls) {
        return switch (cls) {
            case A -> new BigDecimal("0.10");
            case B -> new BigDecimal("0.25");
            case C, D -> new BigDecimal("0.50");
        };
    }

    public static int termMonthsRoundedUp(int termDays) {
        return (int) Math.ceil(termDays / (double) DAYS_IN_MONTH);
    }
}