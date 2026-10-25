package alfa.smartcredit.model.enums;

/**
 * Статус транша в БД. «Просрочен» отдельно не хранится: это ACTIVE с dueDate раньше сегодняшней даты
 * (в API отдаётся как status = OVERDUE).
 */
public enum TrancheStatus {
    ACTIVE, REPAID
}
