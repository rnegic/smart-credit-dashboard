ALTER TABLE credit_applications
    ADD COLUMN business_task VARCHAR(500),
    ADD COLUMN form_data     JSONB;