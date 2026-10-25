package alfa.smartcredit.controller;

import alfa.smartcredit.config.OpenApiConfig;
import alfa.smartcredit.dto.ApplicationDraftRequest;
import alfa.smartcredit.dto.ApplicationDraftResponse;
import alfa.smartcredit.service.ApplicationDraftService;
import alfa.smartcredit.service.SessionContext;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/applications/draft")
@RequiredArgsConstructor
@Tag(name = "Черновик заявки")
@SecurityRequirement(name = OpenApiConfig.SESSION_SECURITY_SCHEME)
public class ApplicationDraftController {
    private final ApplicationDraftService draftService;
    private final SessionContext sessionContext;

    @GetMapping
    @Operation(summary = "Получить черновик",
            description = "Возвращает сохранённый черновик компании или 204, если черновика нет.")
    public ResponseEntity<ApplicationDraftResponse> get(HttpServletRequest request) {
        return draftService.get(sessionContext.requireCompanyId(request))
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @PutMapping
    @Operation(summary = "Сохранить черновик",
            description = "Создаёт или перезаписывает черновик анкеты. Поле revision используется "
                    + "для защиты от одновременного изменения из нескольких вкладок.")
    public ApplicationDraftResponse put(@Valid @RequestBody ApplicationDraftRequest body,
                                        HttpServletRequest request) {
        return draftService.put(sessionContext.requireCompanyId(request), body);
    }

    @DeleteMapping
    @Operation(summary = "Удалить черновик", description = "Удаляет черновик текущей компании.")
    public ResponseEntity<Void> delete(HttpServletRequest request) {
        draftService.delete(sessionContext.requireCompanyId(request));
        return ResponseEntity.noContent().build();
    }
}
