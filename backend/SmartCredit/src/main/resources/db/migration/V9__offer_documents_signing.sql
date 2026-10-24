-- Документы и подпись (этап 5). Храним тексты, версию и снимок подписанта.
ALTER TABLE offers
    ADD COLUMN documents            JSONB,
    ADD COLUMN document_version     VARCHAR(20),
    ADD COLUMN signed_at            TIMESTAMPTZ,
    ADD COLUMN signed_by_id         BIGINT,
    ADD COLUMN signed_by_full_name  VARCHAR(200);