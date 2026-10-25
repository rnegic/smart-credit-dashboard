package alfa.smartcredit.controller;

import alfa.smartcredit.config.OpenApiConfig;
import alfa.smartcredit.dto.ApplicationView;
import alfa.smartcredit.dto.CommentSuggestionRequest;
import alfa.smartcredit.dto.CommentSuggestionResponse;
import alfa.smartcredit.dto.DecisionRequest;
import alfa.smartcredit.service.ApplicationService;
import alfa.smartcredit.service.SessionContext;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.JsonNode;

import java.util.List;

@RestController
@RequestMapping("/api/bank")
@RequiredArgsConstructor
@Tag(name = "Кабинет банка")
@SecurityRequirement(name = OpenApiConfig.SESSION_SECURITY_SCHEME)
public class BankController {
    private final ApplicationService applicationService;
    private final SessionContext sessionContext;

    @GetMapping("/applications")
    @Operation(summary = "Все заявки",
            description = "Список заявок всех компаний для сотрудника банка.")
    public List<ApplicationView> all(HttpServletRequest request) {
        sessionContext.requireOfficer(request);
        return applicationService.allForBank();
    }

    @GetMapping("/applications/{id}")
    @Operation(summary = "Заявка по идентификатору",
            description = "Карточка заявки с результатами скоринга и рекомендацией системы.")
    public ApplicationView one(
            @Parameter(description = "Идентификатор заявки", example = "1") @PathVariable Long id,
            HttpServletRequest request) {
        sessionContext.requireOfficer(request);
        return applicationService.getForBank(id);
    }

    @PostMapping("/applications/{id}/decision")
    @Operation(summary = "Вынести решение по заявке",
            description = "Одобряет заявку, предлагает альтернативные условия или отказывает. "
                    + "Решение сотрудника фиксируется отдельно от рекомендации скоринга.")
    public ApplicationView decide(
            @Parameter(description = "Идентификатор заявки", example = "1") @PathVariable Long id,
            @Valid @RequestBody DecisionRequest body,
            HttpServletRequest request) {
        sessionContext.requireOfficer(request);
        return applicationService.decide(id, body);
    }
    @GetMapping("/applications/{id}/form")
    @Operation(summary = "Анкета заявки",
            description = "Полная анкета клиента в том виде, в котором она была подана.")
    public JsonNode form(
            @Parameter(description = "Идентификатор заявки", example = "1") @PathVariable Long id,
            HttpServletRequest request) {
        sessionContext.requireOfficer(request);
        return applicationService.getFormForBank(id);
    }
    @PostMapping("/applications/{id}/comment-suggestion")
    @Operation(summary = "Предложить комментарий к решению",
            description = "Генерирует комментарий сотрудника банка по выбранному решению. "
                    + "Если ИИ недоступен, возвращается шаблонный текст.")
    public CommentSuggestionResponse suggestComment(
            @Parameter(description = "Идентификатор заявки", example = "1") @PathVariable Long id,
            @Valid @RequestBody CommentSuggestionRequest body,
            HttpServletRequest request) {
        sessionContext.requireOfficer(request);
        return new CommentSuggestionResponse(applicationService.suggestComment(id, body));
    }
}
