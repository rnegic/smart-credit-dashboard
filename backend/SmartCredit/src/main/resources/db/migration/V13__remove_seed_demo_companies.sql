-- Убираем старые сид-компании из V2: Ромашка, Петрова, Вектор.
-- Все связанные данные удалятся каскадом (ON DELETE CASCADE от companies):
-- users, credit_applications, offers, loans, payments, notifications, application_drafts.
DELETE FROM companies
WHERE inn IN ('7701234567', '502912345678', '7812345678');