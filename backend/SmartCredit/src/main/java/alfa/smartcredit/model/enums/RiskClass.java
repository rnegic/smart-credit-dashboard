package alfa.smartcredit.model.enums;

/** Класс риска по internalScore: A (80+), B (60-79), C (40-59), D (<40). */
public enum RiskClass {
    A, B, C, D;

    public static RiskClass fromScore(int score) {
        if (score >= 80) return A;
        if (score >= 60) return B;
        if (score >= 40) return C;
        return D;
    }

    public static RiskClass parse(String value) {
        return value == null ? D : valueOf(value);
    }
}
