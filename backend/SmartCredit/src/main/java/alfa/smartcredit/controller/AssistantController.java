package alfa.smartcredit.controller;

import alfa.smartcredit.dto.AssistantRequest;
import alfa.smartcredit.dto.AssistantResponse;
import alfa.smartcredit.service.AssistantService;
import alfa.smartcredit.service.SessionContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Client-only, stateless contextual assistant endpoint. */
@RestController
@RequestMapping("/api/assistant")
@RequiredArgsConstructor
public class AssistantController {
    private final AssistantService assistantService;
    private final SessionContext sessionContext;

    /** Authorizes the company before reading its dashboard or contacting the provider. */
    @PostMapping("/messages")
    public AssistantResponse message(@Valid @RequestBody AssistantRequest body, HttpServletRequest request) {
        Long companyId = sessionContext.requireCompanyId(request);
        return assistantService.answer(companyId, body);
    }
}
