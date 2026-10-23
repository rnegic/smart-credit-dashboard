package alfa.smartcredit.service;

/** Справочник отраслевых рисков по ОКВЭД (ТЗ). */
public final class IndustryDirectory {
    private IndustryDirectory() {}

    public record Industry(double limitCoef, double ratePremium) {}

    private static final Industry IT           = new Industry(1.0, 0.00);
    private static final Industry TRADE        = new Industry(1.0, 0.25);
    private static final Industry PRODUCTION   = new Industry(1.1, 0.25);
    private static final Industry CONSTRUCTION = new Industry(1.2, 0.50);
    private static final Industry CATERING     = new Industry(1.3, 0.75);
    private static final Industry DEFAULT      = new Industry(1.0, 0.50);

    /** okved вида "47.11" или "47": берём первые два знака (класс ОКВЭД). */
    public static Industry byOkved(String okved) {
        Integer g = group(okved);
        if (g == null) return DEFAULT;
        if (g == 62 || g == 63) return IT;
        if (g >= 45 && g <= 47) return TRADE;
        if (g >= 10 && g <= 33) return PRODUCTION;
        if (g >= 41 && g <= 43) return CONSTRUCTION;
        if (g == 55 || g == 56) return CATERING;
        return DEFAULT;
    }

    private static Integer group(String okved) {
        if (okved == null) return null;
        String s = okved.trim();
        if (s.length() < 2 || !Character.isDigit(s.charAt(0)) || !Character.isDigit(s.charAt(1))) return null;
        return Integer.parseInt(s.substring(0, 2));
    }
}
