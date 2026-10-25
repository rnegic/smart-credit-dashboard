package alfa.smartcredit.config;

import alfa.smartcredit.dto.ErrorResponse;
import io.swagger.v3.core.converter.ModelConverters;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.responses.ApiResponse;
import io.swagger.v3.oas.models.responses.ApiResponses;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.tags.Tag;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;

import java.util.List;

@Configuration
public class OpenApiConfig {

    public static final String SESSION_SECURITY_SCHEME = "sessionCookie";

    @Bean
    OpenAPI smartCreditOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("SmartCredit API")
                        .version("1.0.0")
                        .description("""
                                REST API кредитного кабинета SmartCredit для ИП и ООО.

                                **Авторизация.** API использует серверную сессию и cookie `JSESSIONID`.
                                Чтобы выполнить защищённые запросы из Swagger UI:
                                1. Вызовите `POST /api/auth/login` с демо-учётными данными
                                   (их список доступен в `GET /api/demo/profiles`).
                                2. Браузер сохранит сессионную cookie автоматически — дальше можно
                                   вызывать остальные методы, в том числе методы кабинета банка.

                                **Роли.** Клиент работает со своими заявками, черновиком и офертами.
                                Сотрудник банка (`BANK_OFFICER`) видит заявки всех компаний и выносит решения.
                                """))
                .components(new Components().addSecuritySchemes(SESSION_SECURITY_SCHEME,
                        new SecurityScheme()
                                .type(SecurityScheme.Type.APIKEY)
                                .in(SecurityScheme.In.COOKIE)
                                .name("JSESSIONID")
                                .description("Сессионная cookie, которая устанавливается после "
                                        + "POST /api/auth/login. Вводить её вручную не нужно: "
                                        + "браузер отправит cookie автоматически — просто сначала выполните вход.")))
                .tags(List.of(
                        new Tag().name("Аутентификация").description("Вход, текущий пользователь и выход."),
                        new Tag().name("Демо").description("Учётные записи для демонстрации сценариев."),
                        new Tag().name("Заявки клиента").description("Создание заявок, оферты и подписание документов."),
                        new Tag().name("Черновик заявки").description("Автосохранение незаполненной анкеты."),
                        new Tag().name("Дашборд").description("Сводная информация личного кабинета клиента."),
                        new Tag().name("Профиль").description("Контакты пользователя и реквизиты компании."),
                        new Tag().name("Уведомления").description("Лента уведомлений и SSE-поток."),
                        new Tag().name("ИИ-помощник").description("Заполнение анкеты по свободному тексту."),
                        new Tag().name("Кабинет банка").description("Просмотр заявок и решения сотрудника банка.")));
    }

    /**
     * Добавляет единые ответы об ошибках ко всем операциям: формат тела всегда {@link ErrorResponse}.
     * Ответы 401/403 добавляются только к защищённым операциям.
     */
    @Bean
    OpenApiCustomizer errorResponsesCustomizer() {
        return openApi -> {
            if (openApi.getComponents() == null) {
                openApi.setComponents(new Components());
            }
            Schema<?> errorSchema = ModelConverters.getInstance()
                    .readAllAsResolvedSchema(ErrorResponse.class).schema;
            errorSchema.setType("object");
            openApi.getComponents().addSchemas("ErrorResponse", errorSchema);

            openApi.getPaths().values().forEach(path -> path.readOperations().forEach(operation -> {
                if (operation.getResponses() == null) {
                    operation.setResponses(new ApiResponses());
                }
                ApiResponses responses = operation.getResponses();
                responses.addApiResponse("400", error("Некорректный запрос или ошибка валидации"));
                responses.addApiResponse("500", error("Внутренняя ошибка сервера"));
                boolean secured = operation.getSecurity() != null && !operation.getSecurity().isEmpty();
                if (secured) {
                    responses.addApiResponse("401", error("Пользователь не авторизован"));
                    responses.addApiResponse("403", error("Недостаточно прав"));
                }
            }));
        };
    }

    private static ApiResponse error(String description) {
        return new ApiResponse()
                .description(description)
                .content(new Content().addMediaType(MediaType.APPLICATION_JSON_VALUE,
                        new io.swagger.v3.oas.models.media.MediaType()
                                .schema(new Schema<>().$ref("#/components/schemas/ErrorResponse"))));
    }
}
