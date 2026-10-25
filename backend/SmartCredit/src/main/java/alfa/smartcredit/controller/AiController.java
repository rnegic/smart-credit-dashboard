package alfa.smartcredit.controller;

import alfa.smartcredit.config.OpenApiConfig;
import alfa.smartcredit.dto.PrefillRequest;
import alfa.smartcredit.dto.PrefillResponse;
import alfa.smartcredit.service.ApplicationFormService;
import alfa.smartcredit.service.SessionContext;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
@Tag(name = "ИИ-помощник")
@SecurityRequirement(name = OpenApiConfig.SESSION_SECURITY_SCHEME)
public class AiController {
    private final ApplicationFormService formService;
    private final SessionContext sessionContext;

    @PostMapping("/prefill")
    @Operation(summary = "Заполнить анкету по описанию",
            description = "Извлекает поля анкеты из свободного текста, дополняет уже известные данные "
                    + "компании и возвращает список заполненных и недостающих полей.")
    public PrefillResponse prefill(@Valid @RequestBody PrefillRequest body, HttpServletRequest request) {
        var user = sessionContext.requireUser(request);
        return formService.prefill(sessionContext.requireCompanyId(request), user.getPhone(), user.getEmail(), body.text());
    }
}
