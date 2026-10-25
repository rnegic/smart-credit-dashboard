# Third-Party Notices

## ML-модель

**В конфигурации стенда используется одна модель с открытыми весами.**

| Модель | Правообладатель | Лицензия и источник |
| --- | --- | --- |
| Mistral Small 4, `mistralai/mistral-small-2603`; 119 млрд общих параметров, около 6,5 млрд активных на токен | Mistral AI | **Apache-2.0**; [карточка модели](https://docs.mistral.ai/models/mistral-small-4-0-26-03), [открытые веса](https://huggingface.co/mistralai/Mistral-Small-4-119B-2603), [лицензия](https://www.apache.org/licenses/LICENSE-2.0.txt) |

Веса не включены в приложение или Docker-образы: модель вызывается через API. Apache 2.0 допускает коммерческое использование, изменение и распространение с соблюдением условий лицензии.

## Frontend

Все 23 прямые зависимости из [package.json](frontend/package.json), включая инструменты разработки. Указаны установленные версии; полный граф зафиксирован в [yarn.lock](frontend/yarn.lock).

| Пакеты | Версии | Лицензия / источник |
| --- | --- | --- |
| `react`, `react-dom` | 19.3.1 | [MIT](https://github.com/facebook/react/blob/main/LICENSE) |
| `react-router-dom` | 7.18.4 | [MIT](https://github.com/remix-run/react-router) |
| `@tanstack/react-query` | 5.104.4 | [MIT](https://github.com/TanStack/query) |
| `zod` | 4.6.7 | [MIT](https://github.com/colinhacks/zod) |
| `@alfalab/core-components` | 50.36.0 | [MIT](https://github.com/core-ds/core-components) |
| `@alfalab/core-components-config`, `@alfalab/core-components-stack-context`, `@alfalab/core-components-vars` | 1.1.0; 1.0.1; 11.4.1 | [MIT](https://github.com/core-ds/core-components) |
| `@alfalab/icons` | 3.510.0 | [MIT](https://github.com/core-ds/icons) |
| `typescript` | 6.0.3 | [Apache-2.0](https://github.com/microsoft/TypeScript) |
| `vite`, `@vitejs/plugin-react` | 8.3.4; 6.1.2 | MIT; [Vite](https://github.com/vitejs/vite), [plugin-react](https://github.com/vitejs/vite-plugin-react) |
| `sass` | 1.105.2 | [MIT](https://github.com/sass/dart-sass) |
| `eslint`, `@eslint/js` | 10.13.0; 10.0.1 | [MIT](https://github.com/eslint/eslint) |
| `typescript-eslint` | 8.71.2 | [MIT](https://github.com/typescript-eslint/typescript-eslint) |
| `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh` | 7.1.1; 0.5.7 | MIT; [React](https://github.com/facebook/react), [react-refresh](https://github.com/ArnaudBarre/eslint-plugin-react-refresh) |
| `globals` | 17.13.0 | [MIT](https://github.com/sindresorhus/globals) |
| `@types/node`, `@types/react`, `@types/react-dom` | 24.19.2; 19.3.0; 19.3.0 | [MIT](https://github.com/DefinitelyTyped/DefinitelyTyped) |


## Backend

Все 19 различных зависимостей из [build.gradle](backend/SmartCredit/build.gradle). Для строк Spring Boot используется группа `org.springframework.boot`; версии остальных компонентов разрешены через Gradle.

| Артефакты | Версия | Лицензия / источник |
| --- | --- | --- |
| `spring-boot-starter-data-jpa`, `spring-boot-starter-flyway`, `spring-boot-starter-security`, `spring-boot-starter-validation`, `spring-boot-starter-webmvc`, `spring-boot-starter-web` | 4.1.1 | [Apache-2.0](https://github.com/spring-projects/spring-boot) |
| `spring-boot-devtools`, `spring-boot-docker-compose` (разработка) | 4.1.1 | Apache-2.0 |
| `spring-boot-starter-data-jpa-test`, `spring-boot-starter-flyway-test`, `spring-boot-starter-security-test`, `spring-boot-starter-validation-test`, `spring-boot-starter-webmvc-test` (тесты) | 4.1.1 | Apache-2.0 |
| `org.springdoc:springdoc-openapi-starter-webmvc-ui` | 3.2.0 | [Apache-2.0](https://github.com/springdoc/springdoc-openapi) |
| `org.apache.httpcomponents.client5:httpclient5` | 5.6.4 | [Apache-2.0](https://github.com/apache/httpcomponents-client/blob/rel/v5.6.4/LICENSE.txt); встроенный Public Suffix List отдельно под MPL-2.0 |
| `org.flywaydb:flyway-database-postgresql` | 12.4.0 | [Apache-2.0](https://github.com/flyway/flyway) |
| `org.postgresql:postgresql` (JDBC) | 42.7.13 | [BSD-2-Clause](https://github.com/pgjdbc/pgjdbc/blob/master/LICENSE) |
| `org.projectlombok:lombok` (компиляция и тесты) | 1.18.46 | [MIT](https://github.com/projectlombok/lombok) |
| `org.junit.platform:junit-platform-launcher` (тесты) | 6.0.3 | [EPL-2.0](https://github.com/junit-team/junit-framework) |

Плагины `java` из Gradle 9.8.1, `org.springframework.boot` 4.1.1 и `io.spring.dependency-management` 1.1.7 распространяются под Apache-2.0.

## Сборка и доставка

| Компонент | Лицензия основного ПО |
| --- | --- |
| `node:20-alpine` | [Node.js: MIT](https://github.com/nodejs/node/blob/v20.x/LICENSE), плюс лицензии встроенных компонентов |
| Yarn 1.22.22 | [BSD-2-Clause](https://github.com/yarnpkg/yarn/blob/master/LICENSE) |
| `gradle:8-jdk21`; фактически запускается Gradle Wrapper 9.8.1 | [Gradle: Apache-2.0](https://github.com/gradle/gradle/blob/master/LICENSE); JDK лицензируется отдельно |
| `eclipse-temurin:21-jre-jammy` | [OpenJDK: GPL-2.0 с применимыми исключениями](https://adoptium.net/about/#licenses), включая Classpath Exception |
| `postgres:16` | [PostgreSQL License](https://www.postgresql.org/about/licence/); отличается от лицензии JDBC-драйвера |
| `nginx:stable-alpine` | [BSD-2-Clause](https://github.com/nginx/nginx/blob/master/LICENSE) |
| Docker Compose | [Apache-2.0](https://github.com/docker/compose/blob/main/LICENSE) |
| `actions/checkout@v4` | [MIT](https://github.com/actions/checkout/blob/v4/LICENSE) |
| `docker/setup-buildx-action@v3`, `docker/login-action@v3`, `docker/build-push-action@v6` | Apache-2.0; лицензии соответствующих проектов [Docker Actions](https://github.com/docker) |
| `appleboy/scp-action@v0.1.7`, `appleboy/ssh-action@v1.2.0` | MIT; [scp-action](https://github.com/appleboy/scp-action/blob/v0.1.7/LICENSE), [ssh-action](https://github.com/appleboy/ssh-action/blob/v1.2.0/LICENSE) |


## API и сервисы

| Сервис | Использование | Условия |
| --- | --- | --- |
| [RouterAI](https://routerai.ru) | Внешний инференс, `https://routerai.ru/api/v1/chat/completions` | Российский провайдер ИИ; [пользовательское соглашение](https://routerai.ru/terms), [политика конфиденциальности](https://routerai.ru/terms/privacy). |
| [Hugging Face](https://huggingface.co/mistralai/Mistral-Small-4-119B-2603) | Публикация весов и карточки модели | Не вызывается приложением; лицензия конкретных весов указана выше |
| [GitHub / GHCR](https://github.com/features/packages) | CI, исходники и хранение контейнерных образов | [Условия GitHub](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service); не runtime-зависимость кабинета |