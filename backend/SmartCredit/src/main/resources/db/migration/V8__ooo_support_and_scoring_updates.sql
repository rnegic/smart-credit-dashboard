-- Добавляем поля для ООО и расчетов
ALTER TABLE credit_applications
    ADD COLUMN business_scale VARCHAR(20), -- MICRO | SMALL | OUT_OF_SCOPE
    ADD COLUMN annual_revenue NUMERIC(19,2),
    ADD COLUMN average_employee_count INT;

