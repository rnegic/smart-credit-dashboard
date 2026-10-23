package alfa.smartcredit.controller;

import alfa.smartcredit.dto.ApplicationDraftRequest;
import alfa.smartcredit.dto.ApplicationDraftResponse;
import alfa.smartcredit.service.ApplicationDraftService;
import alfa.smartcredit.service.SessionContext;
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
public class ApplicationDraftController {
    private final ApplicationDraftService draftService;
    private final SessionContext sessionContext;

    @GetMapping
    public ResponseEntity<ApplicationDraftResponse> get(HttpServletRequest request) {
        return draftService.get(sessionContext.requireCompanyId(request))
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @PutMapping
    public ApplicationDraftResponse put(@Valid @RequestBody ApplicationDraftRequest body,
                                        HttpServletRequest request) {
        return draftService.put(sessionContext.requireCompanyId(request), body);
    }

    @DeleteMapping
    public ResponseEntity<Void> delete(HttpServletRequest request) {
        draftService.delete(sessionContext.requireCompanyId(request));
        return ResponseEntity.noContent().build();
    }
}
