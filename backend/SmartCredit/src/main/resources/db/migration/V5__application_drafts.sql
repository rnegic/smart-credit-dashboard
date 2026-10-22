CREATE TABLE application_drafts (
    company_id     BIGINT PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
    form_data      JSONB NOT NULL CHECK (jsonb_typeof(form_data) = 'object'),
    current_step   INT NOT NULL CHECK (current_step BETWEEN 0 AND 3),
    ai_filled      JSONB NOT NULL CHECK (jsonb_typeof(ai_filled) = 'array'),
    missing_fields JSONB NOT NULL CHECK (jsonb_typeof(missing_fields) = 'array'),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    revision       BIGINT NOT NULL DEFAULT 0
);
