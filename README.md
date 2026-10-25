# Умный кредитный кабинет предпринимателя

B2B-кредитный конвейер для ИП и ООО: React-клиент, Spring Boot API, PostgreSQL и интеграция с LLM.

[логотип]

## Продуктовое решение



## Архитектура и стек

| Слой | Технологии | Назначение |
| --- | --- | --- |
| Frontend | React 19, TypeScript 6, Vite 8, React Router 7 | SPA; организация кода по Feature-Sliced Design |
| UI | Alfa Core Components 50, Alfa Icons, SCSS Modules, Sass | Компоненты и дизайн-токены Альфа-Банка; локальные стили без CSS-in-JS |
| Данные клиента | TanStack Query 5, Zod 4, React hooks | Серверное состояние и кэш; проверка JSON-контрактов; локальное состояние интерфейса |
| Backend | Java 21, Spring Boot 4.1.1, Spring MVC, Spring Data JPA / Hibernate, Bean Validation, Spring Security, springdoc-openapi 3.2.0 | REST API, бизнес-правила, транзакции, проверки доступа и OpenAPI |
| База данных | PostgreSQL 16, Flyway | Постоянное хранение и версионируемые SQL-миграции |
| ML / LLM | Mistral Small 4; Spring RestClient, Apache HttpClient 5, Jackson 3 | Внешний инференс через OpenAI-совместимый HTTP API |
| Сборка и доставка | Node.js 20 в Docker-сборке, Yarn 1.22.22, Gradle Wrapper 9.8.1, Docker Compose, Nginx, GitHub Actions / GHCR | Сборка контейнеров, раздача SPA и проксирование API |

Версии и зависимости заданы в [frontend/package.json](frontend/package.json), [yarn.lock](frontend/yarn.lock) и [backend/SmartCredit/build.gradle](backend/SmartCredit/build.gradle).

В стандартном запуске работают три контейнера:

| Сервис Compose | Внутри контейнера | Связи |
| --- | --- | --- |
| `frontend` | Nginx, порт `80` | Раздаёт собранный SPA; проксирует `/api/` на `backend:8080` |
| `backend` | Spring Boot, порт `8080` | Обращается к `postgres:5432` и внешнему LLM API |
| `postgres` | PostgreSQL, порт `5432` | Хранит данные в именованном томе `pgdata` |

Основные каталоги:

```text
frontend/src/app, pages, widgets, features, entities, shared   # Слои FSD
backend/SmartCredit/src/main/java/alfa/smartcredit/            # Контроллеры, DTO, сервисы, модели, репозитории
backend/SmartCredit/src/main/resources/db/migration/           # Миграции Flyway
.github/workflows/deploy.yml                                 # Ручной запуск сборки и доставки через GHCR
```

### Доступ и API

Аутентификация основана на серверном `HttpSession` и cookie **`JSESSIONID`**. В сессии хранится `userId`, время неактивности ограничено двумя часами.

| Роль | Граница доступа |
| --- | --- |
| `CLIENT` | Данные своей компании; клиентские операции с заявками, черновиками, документами и LLM |
| `BANK_OFFICER` | Очередь заявок разных компаний, банковские данные, решения и подсказки сотруднику |
| Без сессии | Вход, публичный каталог демо-профилей и документация API |

Основные маршруты, не полная спецификация:

| Метод | Путь | Доступ | Назначение |
| --- | --- | --- | --- |
| `POST` | `/api/auth/login` | Без сессии | Создание новой сессии |
| `GET` | `/api/auth/me` | Любая авторизованная роль | Текущий пользователь |
| `POST` | `/api/auth/logout` | Без обязательной сессии | Завершение сессии |
| `GET` | `/api/dashboard` | `CLIENT` | Агрегированный снимок кабинета |
| `GET`, `POST` | `/api/applications` | `CLIENT` | Чтение и создание заявок |
| `GET`, `PUT`, `DELETE` | `/api/applications/draft` | `CLIENT` | Черновик компании; контроль конкурентных изменений через `revision` |
| `GET` | `/api/applications/{id}/documents` | `CLIENT` | Документы своей заявки |
| `POST` | `/api/offers/{id}/accept`, `/api/offers/{id}/sign` | `CLIENT` | Серверные переходы состояния оферты и подписи |
| `POST` | `/api/ai/prefill` | `CLIENT` | Извлечение параметров из текста |
| `POST` | `/api/assistant/messages` | `CLIENT` | Ответ LLM с контекстом текущего экрана |
| `GET` | `/api/bank/applications`, `/api/bank/applications/{id}`, `/api/bank/applications/{id}/form` | `BANK_OFFICER` | Чтение банковской проекции данных |
| `POST` | `/api/bank/applications/{id}/decision` | `BANK_OFFICER` | Регистрация решения |
| `POST` | `/api/bank/applications/{id}/comment-suggestion` | `BANK_OFFICER` | Подготовка текста комментария |

API использует JSON и HTTP-коды ошибок. Общая ошибка содержит `code`, `message`, `timestamp`. Например, отсутствие сессии возвращает `401`, недостаточная роль `403`, конфликт версии черновика `409 DRAFT_CONFLICT`. Отсутствующий черновик возвращается как `204`, а создание заявки как `201`.

[скрин "Рабочее место сотрудника банка"]

## ИИ и LLM-модели

**Конфигурация стенда использует только модели с открытыми весами (open-weight). Выбранная модель для всех LLM-вызовов: Mistral Small 4, `mistralai/mistral-small-2603`.** Префикс `OPENAI_` обозначает совместимость API, а не использование моделей OpenAI.

### Модель

| Параметр | Значение |
| --- | --- |
| Модель | Mistral Small 4, версия 26.03 |
| ID у используемого API-шлюза | `mistralai/mistral-small-2603` |
| Общие параметры | **119 млрд** |
| Активные параметры | **Около 6,5 млрд на токен** |
| Архитектура | Mixture-of-Experts: 128 экспертов, 4 активных |
| Окно контекста модели | 256 тыс. токенов; ограничения запросов приложения задаются отдельно |
| Веса | Открыто опубликованы на [Hugging Face][model-weights] |
| Лицензия весов | **Apache License 2.0** |

Apache 2.0 является свободной пермиссивной лицензией: разрешает коммерческое использование, модификацию и распространение. При распространении необходимо соблюдать её условия, в том числе сохранять текст лицензии, применимые уведомления об авторских правах и `NOTICE`, а также отмечать внесённые изменения. Полный текст: [Apache License 2.0][model-license].

### Интеграция

Все обращения выполняются **только с backend** через общий [OpenAiConfig](backend/SmartCredit/src/main/java/alfa/smartcredit/config/OpenAiConfig.java). API-ключ не передаётся браузеру. Запрос отправляется на `POST {OPENAI_BASE_URL}/chat/completions`; результат читается из `choices[0].message.content`.

| Сервис | Контекст и контракт | Поведение при недоступности LLM |
| --- | --- | --- |
| [AiExtractionService](backend/SmartCredit/src/main/java/alfa/smartcredit/service/AiExtractionService.java) | Системный промпт и пользовательский текст; извлечённые поля валидируются на backend. Данные профиля добавляются после извлечения. API возвращает `{form, aiFilled, missingFields}` | Ошибка `503 AI_UNAVAILABLE` или `502 AI_BAD_RESPONSE`; ручной ввод остаётся доступен |
| [AssistantService](backend/SmartCredit/src/main/java/alfa/smartcredit/service/AssistantService.java) | Системный промпт, свежая серверная проекция кабинета и недоверенные `message`, `history`, `screen`. Ответ `{answer, focusFieldId}`; ID проверяется по полям запроса | Явная ошибка, без имитации ответа модели |
| [AiCommentService](backend/SmartCredit/src/main/java/alfa/smartcredit/service/AiCommentService.java) | Скоринговые показатели, рекомендация и предлагаемые условия; результатом является короткий текст | Детерминированный шаблонный комментарий |

### Замена модели

Замена совместимого провайдера или модели **не требует изменения кода**. В `.env` меняются `OPENAI_BASE_URL`, `OPENAI_MODEL`, `OPENAI_API_KEY` и, при необходимости, `OPENAI_RESPONSE_FORMAT`.

- Base URL содержит префикс API, например `https://routerai.ru/api/v1`, **без** `/chat/completions` в конце.
- Имя модели зависит от провайдера. Например, прямой API Mistral использует `mistral-small-2603`, а используемый шлюз (routerai) принимает `mistralai/mistral-small-2603`.
- Провайдер должен поддерживать контракт Chat Completions: `model`, `messages`, Bearer-аутентификацию и `choices[0].message.content`.
- Для предзаполнения и помощника доступны `json_object`, `json_schema` и `text`. Режим `text` только убирает параметр `response_format`: содержимое ответа по-прежнему должно быть JSON. Автоматического переключения форматов нет.

После изменения `.env` пересоздайте backend:

```bash
docker compose up -d --force-recreate backend
```

Обычный `docker compose restart` не подхватывает новые переменные окружения.

## Конфигурация и запуск

### Требования

**Для запуска нужен только Docker с Compose v2**: Docker Desktop либо Docker Engine с Compose plugin. Node.js, Java, Gradle и PostgreSQL на хост устанавливать не требуется. Нужны доступ в интернет для первой сборки и LLM API, а также свободные порты `80`, `8080`, `5432`.

### Локальный стенд

Команды выполняются из корня проекта. Используется [docker-compose.yaml](docker-compose.yaml).

**В репозитории нет зашитых API-ключей. Скопируйте `.env.example` в `.env` и заполните пустые поля (в частности API KEY для LLM).** `.env` исключён из Git. Значения ключей нельзя помещать в `VITE_*`, исходники frontend или публикуемые логи.

```bash
cp .env.example .env
```

В PowerShell эквивалентная команда: `Copy-Item .env.example .env`.

После заполнения `.env`:

```bash
docker compose up -d
```

При первом запуске Compose собирает образы из Dockerfile. PostgreSQL проходит healthcheck, затем backend применяет миграции Flyway. Frontend собирается в статические файлы и обслуживается Nginx; Vite dev server в контейнерном запуске не используется.

`up -d` возвращает управление до полной готовности приложения. Состояние и ошибки запуска:

```bash
docker compose ps
docker compose logs --tail=100 backend
```

Проверка синтаксиса конфигурации без вывода значений окружения: `docker compose config --quiet`.

При обновлении исходников существующие образы нужно пересобрать: `docker compose up -d --build`. Остановка: `docker compose down`; том `pgdata` сохраняется. **Не добавляйте `--volumes`, если данные нужно сохранить.**

### Переменные окружения

| Переменная | Значение в `.env.example` | Назначение |
| --- | --- | --- |
| `OPENAI_API_KEY` | Пустое; заполнить для работы ИИ | Серверный ключ выбранного LLM-провайдера |
| `OPENAI_BASE_URL` | `https://routerai.ru/api/v1` | Базовый адрес OpenAI-совместимого API |
| `OPENAI_MODEL` | `mistralai/mistral-small-2603` | Общая модель для извлечения, помощника и комментариев |
| `OPENAI_RESPONSE_FORMAT` | `json_object` | Формат ответа для извлечения и помощника: `json_object`, `json_schema`, `text` |
| `OPENAI_CONNECT_TIMEOUT` | `10s` | Таймаут подключения и ожидания соединения из пула |
| `OPENAI_READ_TIMEOUT` | `100s` | HTTP-таймаут ответа провайдера; не общий deadline пользовательского действия |.

В базовом Compose параметры БД заданы непосредственно через `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`. Порты также фиксированы в `ports`; произвольные `PORT`, `BASE_URL` и `LLM_MODEL_NAME` приложение не читает. `VITE_API_BASE_URL` предусмотрен HTTP-клиентом как переменная времени сборки, но стандартный Docker-сценарий использует относительный `/api/` и не требует её настройки.

### Адреса

| Ресурс | Адрес после запуска |
| --- | --- |
| Frontend | [http://localhost](http://localhost) |
| API текущей сессии | [http://localhost:8080/api/auth/me](http://localhost:8080/api/auth/me); до входа ожидается `401` |
| Swagger UI | [http://localhost:8080/swagger-ui.html](http://localhost:8080/swagger-ui.html) |
| OpenAPI JSON | [http://localhost:8080/v3/api-docs](http://localhost:8080/v3/api-docs) |
| PostgreSQL | `localhost:5432`, БД `credit_cabinet`; это TCP, не HTTP |

Swagger уже подключён через `springdoc-openapi` в текущем коде. Для защищённых операций нужна сессия, созданная через `/api/auth/login`. Документация открывается напрямую на порту backend: Nginx проксирует `/api/`, но не `/swagger-ui.html` и `/v3/api-docs`.

### Готовые образы

[docker-compose.prod.yml](docker-compose.prod.yml) является отдельной конфигурацией для готовых образов, а не дополнением к локальному запуску. [Workflow Deploy](.github/workflows/deploy.yml) запускается вручную, публикует образы в GHCR и доставляет их по SSH.

| Дополнительная переменная | Назначение |
| --- | --- |
| `IMAGE_PREFIX` | Префикс образов, например `ghcr.io/organization/project` |
| `IMAGE_TAG` | Тег образов; по умолчанию `latest`, CI передаёт SHA коммита |
| `HTTP_PORT` | Внешний порт Nginx; по умолчанию `80`, только в prod-конфигурации |
| `POSTGRES_PASSWORD` | Пароль БД для prod-конфигурации |

Для этого режима LLM-настройки также задаются явно. Workflow получает их из GitHub Secrets; три параметра формата и таймаутов в prod-конфигурации фиксированы. Для локального запуска жюри эти дополнительные переменные не нужны.

## Тестовые данные и демо-сценарий

[МЕСТО ДЛЯ ТЕСТОВЫХ ДАННЫХ И УЧЁТНЫХ ЗАПИСЕЙ]

[МЕСТО ДЛЯ ПОШАГОВОГО ДЕМО-СЦЕНАРИЯ для ЖЮРИ]

## Дополнительные артефакты

| Артефакт | Ссылка или место для заполнения |
| --- | --- |
| Swagger / OpenAPI | [Swagger UI](http://localhost:8080/swagger-ui.html), [JSON-спецификация](http://localhost:8080/v3/api-docs) |
| Диаграмма состояний заявки | [МЕСТО ДЛЯ ССЫЛКИ НА STATE MACHINE]; переходы реализованы в [ApplicationService](backend/SmartCredit/src/main/java/alfa/smartcredit/service/ApplicationService.java) |
| Лицензии сторонних компонентов | [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) |
| Правила frontend | [frontend-rules.md](frontend/docs/frontend-rules.md); фактические зависимости фиксируются в `package.json` и `yarn.lock` |
| Материалы демонстрации | [МЕСТО ДЛЯ СКРИНШОТА_3: Подготовка заявки и контекстный помощник] |

Лицензия модели не распространяется автоматически на код приложения, UI-компоненты и остальные зависимости. Лицензии и неуточнённые условия перечислены в `THIRD_PARTY_NOTICES.md`.

[model-docs]: https://docs.mistral.ai/models/mistral-small-4-0-26-03
[model-weights]: https://huggingface.co/mistralai/Mistral-Small-4-119B-2603
[model-license]: https://www.apache.org/licenses/LICENSE-2.0.txt
