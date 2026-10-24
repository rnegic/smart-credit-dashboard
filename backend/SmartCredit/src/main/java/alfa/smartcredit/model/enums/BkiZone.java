package alfa.smartcredit.model.enums;

/**
 * Цветовая зона БКИ (только для UI менеджера банка).
 * ИП:  RED (<400), YELLOW (400-699), GREEN (700+).
 * ООО: RED (<450), YELLOW (450-699), GREEN (700+).
 */
public enum BkiZone {
    RED, YELLOW, GREEN;

    public static BkiZone fromScore(int bkiScore, boolean ooo) {
        int yellowFrom = ooo ? 450 : 400;
        if (bkiScore >= 700) return GREEN;
        if (bkiScore >= yellowFrom) return YELLOW;
        return RED;
    }
}
