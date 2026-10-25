package alfa.smartcredit.service;

import alfa.smartcredit.model.enums.RiskClass;

import java.math.BigDecimal;
import java.util.Set;

public final class ProductRules {
    private ProductRules() {}

    public static final BigDecimal MIN_AMOUNT = new BigDecimal("50000");
    public static final BigDecimal ABSOLUTE_MAX_AMOUNT = new BigDecimal("20000000");
    public static final Set<Integer> TERM_DAYS = Set.of(30, 60, 90);
    /** Срок договора овердрафта (рамочного договора), месяцев. Внутри договора клиент берёт транши на 30/60/90 дней. */
    public static final Set<Integer> CONTRACT_TERM_MONTHS = Set.of(6, 12, 24);
    /** Минимальная сумма одного транша, ₽ (транш может быть на любую сумму в пределах доступного лимита). */
    public static final BigDecimal MIN_TRANCHE_AMOUNT = new BigDecimal("1000");
    /**
     * false: лимит договора расходуется нарастающим итогом (лимит 500 000 = максимум 5 траншей по 100 000,
     * погашение лимит НЕ возвращает). true: лимит возобновляется после погашения (учитываются только открытые транши).
     */
    public static final boolean LIMIT_REVOLVING = false;
    public static final int DAYS_IN_YEAR = 365;
    public static final int DAYS_IN_MONTH = 30;

    public static final int INADEQUATE_REQUEST_REVENUE_MONTHS = 6;

    /** calculatedLimit = min(monthlyRevenue * industryLimitCoef * 3, absoluteMaxAmount). */
    public static final BigDecimal LIMIT_REVENUE_MULTIPLIER = new BigDecimal("3");

    public enum BusinessScale {
        MICRO, SMALL, OUT_OF_SCOPE, NEEDS_REVIEW
    }

    public static boolean isOoo(String legalForm) {
        return "OOO".equals(legalForm);
    }

    /** Масштаб бизнеса (только ООО): годовая выручка + численность. */
    public static BusinessScale calculateScale(BigDecimal annualRevenue, Integer employeeCount) {
        if (annualRevenue == null || employeeCount == null) return BusinessScale.NEEDS_REVIEW;
        if (annualRevenue.compareTo(new BigDecimal("120000000")) <= 0 && employeeCount <= 15) {
            return BusinessScale.MICRO;
        }
        if (annualRevenue.compareTo(new BigDecimal("800000000")) <= 0 && employeeCount <= 100) {
            return BusinessScale.SMALL;
        }
        return BusinessScale.OUT_OF_SCOPE;
    }

    /** Ставка rate для ИП: зависит только от срока транша (ТЗ для ИП). */
    public static BigDecimal ipRate(Integer termDays) {
        if (termDays == null) return null;
        return switch (termDays) {
            case 30 -> new BigDecimal("24.50");
            case 60 -> new BigDecimal("24.75");
            case 90 -> new BigDecimal("25.00");
            default -> null;
        };
    }

    /** Матрица baseRate для ООО: масштаб + срок (ТЗ для ООО). */
    public static BigDecimal oooBaseRate(BusinessScale scale, Integer termDays) {
        if (termDays == null || scale == null) return null;
        if (scale == BusinessScale.MICRO) {
            return switch (termDays) {
                case 30 -> new BigDecimal("20.00");
                case 60 -> new BigDecimal("22.00");
                case 90 -> new BigDecimal("24.00");
                default -> null;
            };
        }
        if (scale == BusinessScale.SMALL) {
            return switch (termDays) {
                case 30 -> new BigDecimal("19.00");
                case 60 -> new BigDecimal("21.00");
                case 90 -> new BigDecimal("23.00");
                default -> null;
            };
        }
        return null;
    }

    /** Единая точка: ИП -> ставка по сроку, ООО -> матрица по масштабу и сроку. */
    public static BigDecimal baseRate(String legalForm, BusinessScale scale, Integer termDays) {
        return isOoo(legalForm) ? oooBaseRate(scale, termDays) : ipRate(termDays);
    }

    /**
     * Надбавка за класс риска, применяется ТОЛЬКО в ALTERNATIVE_OFFER: A +0.10, B +0.25, C +0.50.
     * В APPROVED надбавка за класс не добавляется (rate + industryRatePremium).
     */
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
