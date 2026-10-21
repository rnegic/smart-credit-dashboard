ALTER TABLE companies ADD COLUMN legal_form VARCHAR(10);   -- IP | OOO | NULL

ALTER TABLE credit_applications
    ADD COLUMN risk_score      INT,
    ADD COLUMN risk_class      VARCHAR(2),
    ADD COLUMN ai_comment      VARCHAR(1000),
    ADD COLUMN officer_comment VARCHAR(1000);

CREATE TABLE users (
                       id          BIGSERIAL PRIMARY KEY,
                       login       VARCHAR(50) NOT NULL UNIQUE,
                       password    VARCHAR(100) NOT NULL,       -- демо: пароль открытый, его видно
                       role        VARCHAR(20) NOT NULL,        -- CLIENT | BANK_OFFICER
                       full_name   VARCHAR(200) NOT NULL,
                       description VARCHAR(300),
                       company_id  BIGINT REFERENCES companies(id) ON DELETE CASCADE
);

--  seed: компании
INSERT INTO companies (profile_id, name, inn, okved, legal_form) VALUES
                                                                     ('seed', 'ИП Иванов Алексей Сергеевич', '772012345678', '47.11', NULL),
                                                                     ('seed', 'ООО «Ромашка»',               '7701234567',   '56.10', 'OOO'),
                                                                     ('seed', 'ИП Петрова Мария Ивановна',   '502912345678', '47.91', 'IP'),
                                                                     ('seed', 'ООО «Вектор»',                '7812345678',   '62.01', 'OOO');

-- seed: пользователи
INSERT INTO users (login, password, role, full_name, description, company_id) VALUES
                                                                                  ('ivanov',  'demo123', 'CLIENT', 'Иванов Алексей', 'Новый клиент, заявок нет, форма не выбрана (покажется модалка ИП/ООО)',
                                                                                   (SELECT id FROM companies WHERE inn = '772012345678')),
                                                                                  ('romashka','demo123', 'CLIENT', 'Директор Ромашки', 'Заявка на рассмотрении у банка',
                                                                                   (SELECT id FROM companies WHERE inn = '7701234567')),
                                                                                  ('petrova', 'demo123', 'CLIENT', 'Петрова Мария', 'Банк одобрил, предложение ждёт подписи',
                                                                                   (SELECT id FROM companies WHERE inn = '502912345678')),
                                                                                  ('vektor',  'demo123', 'CLIENT', 'Директор Вектора', 'Действующий кредит',
                                                                                   (SELECT id FROM companies WHERE inn = '7812345678')),
                                                                                  ('officer', 'bank123', 'BANK_OFFICER', 'Сидоров Пётр', 'Сотрудник банка: видит все заявки', NULL);

-- seed: заявки
INSERT INTO credit_applications (company_id, amount, term_months, purpose, status, risk_score, risk_class, ai_comment)
SELECT id, 1500000, 24, 'Оборотные средства', 'IN_REVIEW', 62, 'B',
       'Средний риск: бизнес стабилен, но долговая нагрузка выше среднего.'
FROM companies WHERE inn = '7701234567';

INSERT INTO credit_applications (company_id, amount, term_months, purpose, status, risk_score, risk_class, ai_comment, officer_comment)
SELECT id, 3000000, 36, 'Оборудование', 'OFFER_READY', 66, 'B',
       'Средний риск: сумма выше комфортной по выручке, рекомендована меньшая.',
       'Одобрено с уменьшенной суммой.'
FROM companies WHERE inn = '502912345678';

INSERT INTO credit_applications (company_id, amount, term_months, purpose, status, risk_score, risk_class, ai_comment)
SELECT id, 2000000, 12, 'Оборотные средства', 'ACCEPTED', 84, 'A', 'Низкий риск.'
FROM companies WHERE inn = '7812345678';

INSERT INTO offers (company_id, application_id, amount, term_months, rate_percent, monthly_payment, valid_until, status)
SELECT a.company_id, a.id, 2500000, 36, 16.50, 88400, CURRENT_DATE + 14, 'ACTIVE'
FROM credit_applications a JOIN companies c ON c.id = a.company_id
WHERE c.inn = '502912345678';

--  seed: действующий кредит Вектора
INSERT INTO loans (company_id, principal, rate_percent, term_months, monthly_payment, remaining_balance, start_date, status)
SELECT id, 2000000, 15.00, 12, 180500, 1380000, CURRENT_DATE - INTERVAL '4 months', 'ACTIVE'
FROM companies WHERE inn = '7812345678';

INSERT INTO payments (loan_id, due_date, amount, status)
SELECT l.id, (l.start_date + (g || ' months')::interval)::date, l.monthly_payment,
       CASE WHEN g <= 4 THEN 'PAID' ELSE 'PENDING' END
FROM loans l, generate_series(1, 12) g;