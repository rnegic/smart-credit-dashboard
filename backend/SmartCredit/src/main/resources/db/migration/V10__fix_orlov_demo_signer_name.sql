-- V3 seeded a display label in place of the entrepreneur's actual name.
-- Restrict the repair to that exact demo account and company.
UPDATE users u
SET full_name = 'Орлов Сергей Андреевич'
FROM companies c
WHERE u.company_id = c.id
  AND u.login = 'client_ip'
  AND u.role = 'CLIENT'
  AND u.full_name = 'Новый предприниматель'
  AND c.inn = '772567890123';

-- Repair only the same incorrect display label in existing demo signatures.
-- Signer IDs, timestamps, document texts and versions remain unchanged.
UPDATE offers o
SET signed_by_full_name = u.full_name
FROM users u
JOIN companies c ON c.id = u.company_id
WHERE o.signed_by_id = u.id
  AND o.company_id = c.id
  AND o.signed_at IS NOT NULL
  AND o.signed_by_full_name = 'Новый предприниматель'
  AND u.login = 'client_ip'
  AND u.role = 'CLIENT'
  AND u.full_name = 'Орлов Сергей Андреевич'
  AND c.inn = '772567890123';
