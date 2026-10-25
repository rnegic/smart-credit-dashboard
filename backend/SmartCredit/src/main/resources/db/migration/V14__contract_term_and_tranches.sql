-- Срок договора овердрафта (6/12/24 мес.) и транши внутри договора.
-- Договор = подписанная оферта (offers). Лимит договора = offers.amount.
-- Внутри договора клиент берёт несколько траншей (tranches) на 30/60/90 дней на любую сумму,
-- пока не исчерпан лимит (см. ProductRules.LIMIT_REVOLVING).

ALTER TABLE credit_applications
    ADD COLUMN contract_term_months INT,
    ADD CONSTRAINT chk_apps_contract_term
        CHECK (contract_term_months IS NULL OR contract_term_months IN (6, 12, 24));

ALTER TABLE offers
    ADD COLUMN contract_term_months INT,
    ADD COLUMN rate_spread          NUMERIC(5,2),   -- итоговая ставка минус базовая ставка по сроку; переносится на каждый транш
    ADD COLUMN contract_start       DATE,           -- заполняется при подписании
    ADD COLUMN contract_end         DATE,           -- contract_start + contract_term_months
    ADD CONSTRAINT chk_offers_contract_term
        CHECK (contract_term_months IS NULL OR contract_term_months IN (6, 12, 24));

-- Демо-данные из старых миграций: годовой договор, надбавка = итоговая ставка - базовая ставка заявки
UPDATE credit_applications SET contract_term_months = 12 WHERE contract_term_months IS NULL;

UPDATE offers o
SET contract_term_months = 12,
    rate_spread = COALESCE(o.rate_percent - a.rate, 0)
FROM credit_applications a
WHERE a.id = o.application_id AND o.contract_term_months IS NULL;

CREATE TABLE tranches (
    id            BIGSERIAL PRIMARY KEY,
    company_id    BIGINT        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    offer_id      BIGINT        NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
    application_id BIGINT       NOT NULL REFERENCES credit_applications(id) ON DELETE CASCADE,
    amount        NUMERIC(19,2) NOT NULL CHECK (amount > 0),
    term_days     INT           NOT NULL CHECK (term_days IN (30, 60, 90)),
    rate_percent  NUMERIC(5,2)  NOT NULL,           -- ставка, зафиксированная на момент получения транша
    issued_at     DATE          NOT NULL,
    due_date      DATE          NOT NULL,
    status        VARCHAR(20)   NOT NULL CHECK (status IN ('ACTIVE', 'REPAID')),
    repaid_at     DATE,
    interest_paid NUMERIC(19,2),                    -- проценты, уплаченные при погашении
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_tranches_offer   ON tranches(offer_id);
CREATE INDEX idx_tranches_company ON tranches(company_id);
