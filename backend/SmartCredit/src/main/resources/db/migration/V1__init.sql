CREATE TABLE companies (
                           id          BIGSERIAL PRIMARY KEY,
                           profile_id  VARCHAR(50)  NOT NULL,
                           name        VARCHAR(200) NOT NULL,
                           inn         VARCHAR(12)  NOT NULL,
                           okved       VARCHAR(20),
                           created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE credit_applications (
                                     id          BIGSERIAL PRIMARY KEY,
                                     company_id  BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
                                     amount      NUMERIC(19,2) NOT NULL,
                                     term_months INT NOT NULL,
                                     purpose     VARCHAR(100),
                                     status      VARCHAR(30) NOT NULL,
                                     created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE offers (
                        id              BIGSERIAL PRIMARY KEY,
                        company_id      BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
                        application_id  BIGINT NOT NULL REFERENCES credit_applications(id) ON DELETE CASCADE,
                        amount          NUMERIC(19,2) NOT NULL,
                        term_months     INT NOT NULL,
                        rate_percent    NUMERIC(5,2) NOT NULL,
                        monthly_payment NUMERIC(19,2) NOT NULL,
                        valid_until     DATE NOT NULL,
                        status          VARCHAR(30) NOT NULL
);

CREATE TABLE loans (
                       id                BIGSERIAL PRIMARY KEY,
                       company_id        BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
                       principal         NUMERIC(19,2) NOT NULL,
                       rate_percent      NUMERIC(5,2) NOT NULL,
                       term_months       INT NOT NULL,
                       monthly_payment   NUMERIC(19,2) NOT NULL,
                       remaining_balance NUMERIC(19,2) NOT NULL,
                       start_date        DATE NOT NULL,
                       status            VARCHAR(30) NOT NULL
);

CREATE TABLE payments (
                          id        BIGSERIAL PRIMARY KEY,
                          loan_id   BIGINT NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
                          due_date  DATE NOT NULL,
                          amount    NUMERIC(19,2) NOT NULL,
                          status    VARCHAR(30) NOT NULL
);

CREATE TABLE notifications (
                               id          BIGSERIAL PRIMARY KEY,
                               company_id  BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
                               text        VARCHAR(500) NOT NULL,
                               is_read     BOOLEAN NOT NULL DEFAULT FALSE,
                               created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_apps_company     ON credit_applications(company_id);
CREATE INDEX idx_offers_company   ON offers(company_id);
CREATE INDEX idx_loans_company    ON loans(company_id);
CREATE INDEX idx_payments_loan    ON payments(loan_id);
CREATE INDEX idx_notif_company    ON notifications(company_id);