-- Демонстрационные финансовые и регистрационные данные для сценариев docs_1..docs_4.
-- Заполняет анкету, которую показывает карточка заявки сотруднику банка.
-- Миграция идемпотентна: повторный запуск просто перезаписывает те же значения.

WITH scenario_data(
    inn, company_name, ogrn, kpp, registration_date, main_okved, industry,
    phone, email, registration_address, tax_system, business_task,
    amount, term_days, rate, purpose,
    monthly_revenue, existing_debt, annual_revenue, employee_count, other_obligations
) AS (
    VALUES
        ('7709000001', 'ООО «Старт»', '1157709000001', '770901001',
         '2019-04-15', '62.01', 'IT, связь (62, 63)',
         '+7 499 900-00-01', 'docs1@example.com', 'г. Москва, ул. Тверская, д. 1',
         'OSNO', 'Покупка производственного оборудования для расширения линии',
         1800000.00, 90, 22.00, 'Оборудование',
         1250000.00, 85000.00, 15000000.00, 18, 45000.00),

        ('7709000002', 'ООО «Прогресс»', '1177709000002', '770901001',
         '2017-09-12', '46.90', 'Торговля (45–47)',
         '+7 499 900-00-02', 'docs2@example.com', 'г. Москва, ул. Ленинская Слобода, д. 19',
         'OSNO', 'Закупка сырья и материалов для выполнения контрактов',
         2200000.00, 60, 20.50, 'Пополнение оборотных средств',
         2000000.00, 120000.00, 24000000.00, 32, 80000.00),

        ('7709000003', 'ООО «Финиш»', '1167709000003', '770901001',
         '2016-02-20', '56.10', 'Общепит, гостиницы (55, 56)',
         '+7 499 900-00-03', 'docs3@example.com', 'г. Москва, Кутузовский проспект, д. 12',
         'OSNO', 'Модернизация производственного парка и обновление оборудования',
         2500000.00, 90, 19.00, 'Оборудование',
         3000000.00, 250000.00, 36000000.00, 45, 150000.00),

        ('7709000004', 'ООО «Просрочка»', '1187709000004', '770901001',
         '2020-11-05', '47.11', 'Торговля (45–47)',
         '+7 499 900-00-04', 'docs4@example.com', 'г. Москва, ул. Арбат, д. 5',
         'USN', 'Срочная закупка сырья для сезонного заказа',
         1500000.00, 30, 23.00, 'Закупка сырья',
         900000.00, 60000.00, 10800000.00, 12, 30000.00)
)
UPDATE credit_applications a
SET form_data = jsonb_build_object(
        'applicationId', format('app_2026_%s', lpad(a.id::text, 4, '0')),
        'createdAt', to_jsonb(a.created_at),
        'status', 'SUBMITTED',
        'prefilled', jsonb_build_object(
                'source', 'EGRUL_MOCK',
                'fetchedAt', to_jsonb(a.created_at),
                'confirmedByUser', true
        ),
        'step1_financingParameters', jsonb_build_object(
                'businessTask', d.business_task,
                'amount', d.amount,
                'termDays', d.term_days,
                'rate', d.rate,
                'purpose', d.purpose
        ),
        'step2_businessData', jsonb_build_object(
                'applicant', jsonb_build_object(
                        'type', 'OOO',
                        'companyName', d.company_name,
                        'inn', d.inn,
                        'taxSystem', d.tax_system,
                        'firstName', NULL,
                        'lastName', NULL,
                        'middleName', NULL,
                        'ogrnip', NULL,
                        'ogrn', d.ogrn,
                        'kpp', d.kpp,
                        'registrationDate', d.registration_date,
                        'mainOkved', d.main_okved,
                        'industry', d.industry,
                        'phone', d.phone,
                        'email', d.email,
                        'registrationAddress', d.registration_address
                ),
                'financials', jsonb_build_object(
                        'monthlyRevenue', d.monthly_revenue,
                        'existingDebt', d.existing_debt,
                        'annualRevenue', d.annual_revenue,
                        'averageEmployeeCount', d.employee_count,
                        'otherMonthlyObligations', d.other_obligations
                ),
                'externalData', NULL
        ),
        'step3_verification', jsonb_build_object(
                'consents', jsonb_build_object(
                        'personalData', true,
                        'bkiRequest', true,
                        'fnsRequest', true,
                        'acceptedAt', to_jsonb(a.created_at)
                )
        ),
        'meta', jsonb_build_object(
                'formVersion', '1.3',
                'events', jsonb_build_array('submitted')
        )
),
    annual_revenue = d.annual_revenue,
    average_employee_count = d.employee_count,
    business_scale = CASE
        WHEN d.annual_revenue <= 120000000 AND d.employee_count <= 15 THEN 'MICRO'
        WHEN d.annual_revenue <= 800000000 AND d.employee_count <= 100 THEN 'SMALL'
        ELSE 'OUT_OF_SCOPE'
    END
FROM scenario_data d
JOIN companies c ON c.inn = d.inn
WHERE a.company_id = c.id;
