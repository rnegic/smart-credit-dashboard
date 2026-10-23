package alfa.smartcredit.controller;

import alfa.smartcredit.dto.PrefillRequest;
import alfa.smartcredit.dto.PrefillResponse;
import alfa.smartcredit.service.ApplicationFormService;
import alfa.smartcredit.service.SessionContext;
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
public class AiController {
    private final ApplicationFormService formService;
    private final SessionContext sessionContext;

    @PostMapping("/prefill")
    public PrefillResponse prefill(@Valid @RequestBody PrefillRequest body, HttpServletRequest request) {
        return formService.prefill(sessionContext.requireCompanyId(request), body.text());
    }
}
