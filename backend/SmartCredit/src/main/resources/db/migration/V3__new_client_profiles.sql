INSERT INTO companies (profile_id, name, inn, okved, legal_form) VALUES
    ('seed', 'ИП Орлов Сергей Андреевич', '772567890123', '47.11', 'IP'),
    ('seed', 'ООО «Маяк»', '7712345678', '46.90', 'OOO');

INSERT INTO users (login, password, role, full_name, description, company_id) VALUES
    ('client_ip', 'demo123', 'CLIENT', 'Новый предприниматель', 'ИП без заявок и кредитов. Начните с задачи бизнеса.',
     (SELECT id FROM companies WHERE inn = '772567890123')),
    ('client_ooo', 'demo123', 'CLIENT', 'Руководитель компании', 'ООО без заявок и кредитов. Начните с задачи бизнеса.',
     (SELECT id FROM companies WHERE inn = '7712345678'));
