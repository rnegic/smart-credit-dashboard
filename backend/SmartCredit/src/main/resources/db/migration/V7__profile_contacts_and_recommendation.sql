-- Контакты пользователя в личном кабинете
ALTER TABLE users
    ADD COLUMN phone VARCHAR(20),
    ADD COLUMN email VARCHAR(255);

-- Рекомендация системы (DecisionEngine) для сотрудника банка: {decision, finalRate, amount, reason}.
-- Итоговое решение (credit_applications.decision) теперь выносит только человек.
ALTER TABLE credit_applications
    ADD COLUMN recommendation JSONB;

-- Демо-контакты (у client_ip намеренно пусто, чтобы проверить сценарий «в БД ничего нет»)
UPDATE users SET phone = '+79991110001', email = 'ivanov@example.com'   WHERE login = 'ivanov';
UPDATE users SET phone = '+79991110002', email = 'romashka@example.com' WHERE login = 'romashka';
UPDATE users SET phone = '+79991110003', email = 'petrova@example.com'  WHERE login = 'petrova';
UPDATE users SET phone = '+79991110004', email = 'vektor@example.com'   WHERE login = 'vektor';
UPDATE users SET phone = '+79991110006', email = 'ooo@example.com'      WHERE login = 'client_ooo';

-- Заявки, ожидающие сотрудника, не имеют итогового решения (в V6 демо-строке ошибочно проставлено MANUAL_REVIEW)
UPDATE credit_applications SET decision = NULL WHERE status = 'IN_REVIEW';
