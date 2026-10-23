package alfa.smartcredit.model.enums;

/** Цветовая зона БКИ (только для UI менеджера банка): RED (<400), YELLOW (400-699), GREEN (700+). */
public enum BkiZone {
    RED, YELLOW, GREEN;

    public static BkiZone fromScore(int bkiScore) {
        if (bkiScore >= 700) return GREEN;
        if (bkiScore >= 400) return YELLOW;
        return RED;
    }
}
