package alfa.smartcredit.controller;

import alfa.smartcredit.config.OpenApiConfig;
import alfa.smartcredit.dto.*;
import alfa.smartcredit.service.ApplicationService;
import alfa.smartcredit.service.ProfileService;
import alfa.smartcredit.service.SessionContext;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@Tag(name = "Заявки клиента")
@SecurityRequirement(name = OpenApiConfig.SESSION_SECURITY_SCHEME)
public class ClientController {
    private final ApplicationService applicationService;
    private final SessionContext sessionContext;
    private final ProfileService profileService;

    @PostMapping("/company/legal-form")
    @Operation(summary = "Выбрать правовую форму",
            description = "Сохраняет форму ИП или ООО в профиле компании текущего клиента.")
    public ResponseEntity<Void> legalForm(@Valid @RequestBody LegalFormRequest body, HttpServletRequest request) {
        applicationService.setLegalForm(sessionContext.requireCompanyId(request), body.legalForm());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/applications")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Подать заявку на кредит",
            description = "Создаёт заявку из заполненной анкеты, запускает скоринг и формирует рекомендацию. "
                    + "Контакты из анкеты сохраняются в профиль, если там они ещё не заполнены.")
    public ApplicationView create(@Valid @RequestBody ApplicationFormDto body, HttpServletRequest request) {
        var user = sessionContext.requireUser(request);
        ApplicationView view = applicationService.create(sessionContext.requireCompanyId(request), body);
        // контакты из анкеты сохраняем в личный кабинет, если там их ещё нет
        var applicant = body.step2().applicant();
        profileService.fillIfEmpty(user.getId(), applicant.phone(), applicant.email());
        return view;
    }

    @GetMapping("/applications")
    @Operation(summary = "Заявки текущего клиента",
            description = "Возвращает все заявки компании, доступные авторизованному клиенту.")
    public List<ApplicationView> mine(HttpServletRequest request) {
        return applicationService.forCompany(sessionContext.requireCompanyId(request));
    }

    @PostMapping("/offers/{id}/accept")
    @Operation(summary = "Принять предложение банка",
            description = "Переводит заявку на этап подписания документов по оферте.")
    public ApplicationView accept(
            @Parameter(description = "Идентификатор оферты", example = "1") @PathVariable Long id,
            HttpServletRequest request) {
        return applicationService.acceptOffer(sessionContext.requireCompanyId(request), id);
    }

    @GetMapping("/applications/{id}/documents")
    @Operation(summary = "Документы по заявке",
            description = "Возвращает пакет документов, статус подписания и данные подписанта.")
    public DocumentsResponse documents(
            @Parameter(description = "Идентификатор заявки", example = "1") @PathVariable Long id,
            HttpServletRequest request) {
        return applicationService.getDocuments(sessionContext.requireCompanyId(request), id);
    }

    @PostMapping("/offers/{id}/sign")
    @Operation(summary = "Подписать документы по оферте",
            description = "Фиксирует версию документов и подтверждение клиента. "
                    + "ФИО и время подписания определяет сервер.")
    public DocumentsResponse sign(
            @Parameter(description = "Идентификатор оферты", example = "1") @PathVariable Long id,
            @Valid @RequestBody SignRequest body,
            HttpServletRequest request) {
        var user = sessionContext.requireUser(request);
        return applicationService.signOffer(
                sessionContext.requireCompanyId(request), user.getId(), id, body);
    }
}
