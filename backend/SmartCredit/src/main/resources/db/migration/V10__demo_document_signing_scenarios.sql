-- Четыре демонстрационных сценария подписания документов.
-- Миграция идемпотентна: если пользователи docs_1..docs_4 уже есть, сценарии не пересоздаются.
-- Логины и пароли одинаковы для всех сценариев: docs_N / demo123.

-- ---------- Сценарий 1: предложение активно, документы ещё не сформированы ----------
DO $$
DECLARE
    v_company_id BIGINT;
    v_app_id     BIGINT;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM users WHERE login = 'docs_1') THEN
        INSERT INTO companies (profile_id, name, inn, okved, legal_form)
        VALUES ('demo-docs-1', 'ООО «Старт»', '7709000001', '62.01', 'OOO')
        RETURNING id INTO v_company_id;

        INSERT INTO users (login, password, role, full_name, description, company_id, phone, email)
        VALUES ('docs_1', 'demo123', 'CLIENT', 'Сценарий 1 — принять предложение',
                'Предложение активно, документы ещё не сформированы. Проверка принятия условий.',
                v_company_id, '+79992220001', 'docs1@example.com');

        INSERT INTO credit_applications
            (company_id, amount, term_months, term_days, purpose, status,
             risk_score, risk_class, rate, final_rate, decision, officer_comment)
        VALUES (v_company_id, 1800000.00, 3, 90, 'Оборудование', 'OFFER_READY',
                72, 'B', 22.00, 22.00, 'APPROVED',
                'Одобрено: проверьте условия и примите предложение.')
        RETURNING id INTO v_app_id;

        INSERT INTO offers
            (company_id, application_id, amount, term_months, term_days, rate_percent,
             monthly_payment, valid_until, status)
        VALUES (v_company_id, v_app_id, 1800000.00, 3, 90, 22.00,
                697643.84, CURRENT_DATE + 14, 'ACTIVE');
    END IF;
END $$;

-- ---------- Сценарий 2: документы сформированы, ожидают подписания ----------
DO $$
DECLARE
    v_company_id BIGINT;
    v_app_id     BIGINT;
    v_docs       JSONB;
    v_valid      DATE;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM users WHERE login = 'docs_2') THEN
        INSERT INTO companies (profile_id, name, inn, okved, legal_form)
        VALUES ('demo-docs-2', 'ООО «Прогресс»', '7709000002', '46.90', 'OOO')
        RETURNING id INTO v_company_id;

        INSERT INTO users (login, password, role, full_name, description, company_id, phone, email)
        VALUES ('docs_2', 'demo123', 'CLIENT', 'Сценарий 2 — подписать документы',
                'Документы сформированы: договор овердрафта и индивидуальные условия ждут подписания.',
                v_company_id, '+79992220002', 'docs2@example.com');

        INSERT INTO credit_applications
            (company_id, amount, term_months, term_days, purpose, status,
             risk_score, risk_class, rate, final_rate, decision, officer_comment)
        VALUES (v_company_id, 2200000.00, 2, 60, 'Пополнение оборотных средств', 'SIGNATURE_PENDING',
                78, 'B', 20.50, 20.50, 'APPROVED',
                'Одобрено. Документы подготовлены к подписанию.')
        RETURNING id INTO v_app_id;

        v_valid := CURRENT_DATE + 14;
        v_docs := jsonb_build_array(
            jsonb_build_object(
                'type', 'OVERDRAFT_AGREEMENT',
                'title', 'Договор овердрафта',
                'content', format(E'ДОГОВОР ОВЕРДРАФТА (демонстрационный текст)\n========================================\n\nЗаявка №%s\nЗаёмщик: ООО «Прогресс»\nИНН: 7709000002\n\nПредмет: предоставление возобновляемой кредитной линии (овердрафт).\nСумма: 2 200 000,00 ₽\nСрок транша: 60 дней\nСтавка: 20.50%% годовых\nЕжемесячный платёж: 1 174 136,99 ₽\nПредложение действует до: %s\n\nНастоящий документ является демонстрационным и не имеет юридической силы. Электронная подпись имитируется.\n', v_app_id, v_valid)
            ),
            jsonb_build_object(
                'type', 'INDIVIDUAL_TERMS',
                'title', 'Индивидуальные условия',
                'content', format(E'ИНДИВИДУАЛЬНЫЕ УСЛОВИЯ (демонстрационный текст)\n=============================================\n\nЗаявка №%s\nЗаёмщик: ООО «Прогресс»\nИНН: 7709000002\n\nИндивидуальные условия по продукту «Овердрафт»:\n - Сумма лимита: 2 200 000,00 ₽\n - Срок транша: 60 дней\n - Процентная ставка: 20.50%% годовых\n - Ежемесячный платёж: 1 174 136,99 ₽\n\nЗаёмщик подтверждает ознакомление с условиями и принимает их. Документ является демонстрационным, юридической силы не имеет.\n', v_app_id)
            )
        );

        INSERT INTO offers
            (company_id, application_id, amount, term_months, term_days, rate_percent,
             monthly_payment, valid_until, status, documents, document_version)
        VALUES (v_company_id, v_app_id, 2200000.00, 2, 60, 20.50,
                1174136.99, v_valid, 'ACCEPTED', v_docs, '1');

        INSERT INTO notifications (company_id, text, is_read)
        VALUES (v_company_id,
                format('Предложение по заявке №%s принято. Подпишите документы.', v_app_id),
                false);
    END IF;
END $$;

-- ---------- Сценарий 3: документы подписаны ----------
DO $$
DECLARE
    v_company_id BIGINT;
    v_user_id    BIGINT;
    v_app_id     BIGINT;
    v_docs       JSONB;
    v_valid      DATE;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM users WHERE login = 'docs_3') THEN
        INSERT INTO companies (profile_id, name, inn, okved, legal_form)
        VALUES ('demo-docs-3', 'ООО «Финиш»', '7709000003', '56.10', 'OOO')
        RETURNING id INTO v_company_id;

        INSERT INTO users (login, password, role, full_name, description, company_id, phone, email)
        VALUES ('docs_3', 'demo123', 'CLIENT', 'Сценарий 3 — документы подписаны',
                'Подписание завершено: показаны дата подписания и подписант, заявка перешла в ACCEPTED.',
                v_company_id, '+79992220003', 'docs3@example.com')
        RETURNING id INTO v_user_id;

        INSERT INTO credit_applications
            (company_id, amount, term_months, term_days, purpose, status,
             risk_score, risk_class, rate, final_rate, decision, officer_comment)
        VALUES (v_company_id, 2500000.00, 3, 90, 'Оборудование', 'ACCEPTED',
                81, 'A', 19.00, 19.00, 'APPROVED',
                'Одобрено. Проверьте подписанные документы.')
        RETURNING id INTO v_app_id;

        v_valid := CURRENT_DATE + 14;
        v_docs := jsonb_build_array(
            jsonb_build_object(
                'type', 'OVERDRAFT_AGREEMENT',
                'title', 'Договор овердрафта',
                'content', format(E'ДОГОВОР ОВЕРДРАФТА (демонстрационный текст)\n========================================\n\nЗаявка №%s\nЗаёмщик: ООО «Финиш»\nИНН: 7709000003\n\nПредмет: предоставление возобновляемой кредитной линии (овердрафт).\nСумма: 2 500 000,00 ₽\nСрок транша: 90 дней\nСтавка: 19.00%% годовых\nЕжемесячный платёж: 950 456,62 ₽\nПредложение действует до: %s\n\nНастоящий документ является демонстрационным и не имеет юридической силы. Электронная подпись имитируется.\n', v_app_id, v_valid)
            ),
            jsonb_build_object(
                'type', 'INDIVIDUAL_TERMS',
                'title', 'Индивидуальные условия',
                'content', format(E'ИНДИВИДУАЛЬНЫЕ УСЛОВИЯ (демонстрационный текст)\n=============================================\n\nЗаявка №%s\nЗаёмщик: ООО «Финиш»\nИНН: 7709000003\n\nИндивидуальные условия по продукту «Овердрафт»:\n - Сумма лимита: 2 500 000,00 ₽\n - Срок транша: 90 дней\n - Процентная ставка: 19.00%% годовых\n - Ежемесячный платёж: 950 456,62 ₽\n\nЗаёмщик подтверждает ознакомление с условиями и принимает их. Документ является демонстрационным, юридической силы не имеет.\n', v_app_id)
            )
        );

        INSERT INTO offers
            (company_id, application_id, amount, term_months, term_days, rate_percent,
             monthly_payment, valid_until, status, documents, document_version,
             signed_at, signed_by_id, signed_by_full_name)
        VALUES (v_company_id, v_app_id, 2500000.00, 3, 90, 19.00,
                950456.62, v_valid, 'ACCEPTED', v_docs, '1',
                CURRENT_TIMESTAMP - INTERVAL '1 hour', v_user_id, 'Сценарий 3 — документы подписаны');

        INSERT INTO notifications (company_id, text, is_read)
        VALUES
            (v_company_id,
             format('Предложение по заявке №%s принято. Подпишите документы.', v_app_id),
             true),
            (v_company_id,
             format('Документы по заявке №%s подписаны. Кредит будет оформлен.', v_app_id),
             false);
    END IF;
END $$;

-- ---------- Сценарий 4: срок предложения истёк, подписание недоступно ----------
DO $$
DECLARE
    v_company_id BIGINT;
    v_app_id     BIGINT;
    v_docs       JSONB;
    v_valid      DATE;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM users WHERE login = 'docs_4') THEN
        INSERT INTO companies (profile_id, name, inn, okved, legal_form)
        VALUES ('demo-docs-4', 'ООО «Просрочка»', '7709000004', '47.11', 'OOO')
        RETURNING id INTO v_company_id;

        INSERT INTO users (login, password, role, full_name, description, company_id, phone, email)
        VALUES ('docs_4', 'demo123', 'CLIENT', 'Сценарий 4 — срок предложения истёк',
                'Документы сформированы, но срок предложения истёк — подписание недоступно.',
                v_company_id, '+79992220004', 'docs4@example.com');

        INSERT INTO credit_applications
            (company_id, amount, term_months, term_days, purpose, status,
             risk_score, risk_class, rate, final_rate, decision, officer_comment)
        VALUES (v_company_id, 1500000.00, 1, 30, 'Закупка сырья', 'SIGNATURE_PENDING',
                69, 'B', 23.00, 23.00, 'APPROVED',
                'Одобрено, но предложение уже истекло.')
        RETURNING id INTO v_app_id;

        v_valid := CURRENT_DATE - 1;
        v_docs := jsonb_build_array(
            jsonb_build_object(
                'type', 'OVERDRAFT_AGREEMENT',
                'title', 'Договор овердрафта',
                'content', format(E'ДОГОВОР ОВЕРДРАФТА (демонстрационный текст)\n========================================\n\nЗаявка №%s\nЗаёмщик: ООО «Просрочка»\nИНН: 7709000004\n\nПредмет: предоставление возобновляемой кредитной линии (овердрафт).\nСумма: 1 500 000,00 ₽\nСрок транша: 30 дней\nСтавка: 23.00%% годовых\nЕжемесячный платёж: 1 528 356,16 ₽\nПредложение действует до: %s\n\nНастоящий документ является демонстрационным и не имеет юридической силы. Электронная подпись имитируется.\n', v_app_id, v_valid)
            ),
            jsonb_build_object(
                'type', 'INDIVIDUAL_TERMS',
                'title', 'Индивидуальные условия',
                'content', format(E'ИНДИВИДУАЛЬНЫЕ УСЛОВИЯ (демонстрационный текст)\n=============================================\n\nЗаявка №%s\nЗаёмщик: ООО «Просрочка»\nИНН: 7709000004\n\nИндивидуальные условия по продукту «Овердрафт»:\n - Сумма лимита: 1 500 000,00 ₽\n - Срок транша: 30 дней\n - Процентная ставка: 23.00%% годовых\n - Ежемесячный платёж: 1 528 356,16 ₽\n\nЗаёмщик подтверждает ознакомление с условиями и принимает их. Документ является демонстрационным, юридической силы не имеет.\n', v_app_id)
            )
        );

        INSERT INTO offers
            (company_id, application_id, amount, term_months, term_days, rate_percent,
             monthly_payment, valid_until, status, documents, document_version)
        VALUES (v_company_id, v_app_id, 1500000.00, 1, 30, 23.00,
                1528356.16, v_valid, 'ACCEPTED', v_docs, '1');

        INSERT INTO notifications (company_id, text, is_read)
        VALUES (v_company_id,
                format('Срок предложения по заявке №%s истёк. Подписание документов недоступно.', v_app_id),
                false);
    END IF;
END $$;
