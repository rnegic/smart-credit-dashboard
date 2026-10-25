-- Стартовые аккаунты для карточки «Новая бизнес-задача» на экране входа.
-- Фронтенд ищет их по логину и исключает из блока «Другие сценарии»,
-- но без demo_order они не попадают в /api/demo/profiles и кнопка входа заблокирована.
UPDATE users SET demo_order = 6 WHERE login = 'client_ip';
UPDATE users SET demo_order = 7 WHERE login = 'client_ooo';
