-- Порядок показа в /api/demo/profiles. NULL = аккаунт скрыт из списка демо-профилей (но остаётся рабочим).
-- Четыре клиента-сценария (demo_order 1..4) создаёт DemoDataSeeder при старте приложения.
ALTER TABLE users ADD COLUMN demo_order INT;

-- Сотрудник банка нужен жюри, чтобы довести до решения сценарии 2 и 3 (заявки в статусе IN_REVIEW)
UPDATE users SET demo_order = 5 WHERE login = 'officer';
