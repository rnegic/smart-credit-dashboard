-- Скоринг и итоговое кредитное решение по ТЗ (срок в днях, ставка, решение DecisionEngine)
ALTER TABLE credit_applications
    ADD COLUMN term_days        INT,
    ADD COLUMN rate             NUMERIC(5,2),    -- базовая ставка по сроку транша
    ADD COLUMN final_rate       NUMERIC(5,2),    -- итоговая ставка (rate + премия класса + отраслевая)
    ADD COLUMN decision         VARCHAR(30),     -- INFO_REQUIRED | DECLINED | APPROVED | ALTERNATIVE_OFFER | MANUAL_REVIEW
    ADD COLUMN calculated_limit NUMERIC(19,2),
    ADD COLUMN scoring_data     JSONB,           -- полный снимок скоринга (входы, производные поля, баллы)
    ADD CONSTRAINT chk_apps_term_days CHECK (term_days IS NULL OR term_days IN (30, 60, 90));

ALTER TABLE offers
    ADD COLUMN term_days INT,
    ADD CONSTRAINT chk_offers_term_days CHECK (term_days IS NULL OR term_days IN (30, 60, 90));

-- Демо-данные приводим к допустимым значениям ТЗ (срок 30/60/90 дней)
UPDATE credit_applications
SET term_days = 90, term_months = 3, rate = 25.00,
    decision = CASE status WHEN 'IN_REVIEW' THEN 'MANUAL_REVIEW'
                           WHEN 'DECLINED'  THEN 'DECLINED'
                           ELSE 'ALTERNATIVE_OFFER' END
WHERE term_days IS NULL;

UPDATE offers
SET term_days = 90, term_months = 3, rate_percent = 25.00,
    monthly_payment = ROUND(amount / 3 + amount * 0.25 * 90 / 365, 2)
WHERE term_days IS NULL;
