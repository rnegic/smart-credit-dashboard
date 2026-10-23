package alfa.smartcredit.controller;

import alfa.smartcredit.dto.ApplicationFormDto;
import alfa.smartcredit.dto.ApplicationView;
import alfa.smartcredit.dto.LegalFormRequest;
import alfa.smartcredit.service.ApplicationService;
import alfa.smartcredit.service.ProfileService;
import alfa.smartcredit.service.SessionContext;
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
public class ClientController {
    private final ApplicationService applicationService;
    private final SessionContext sessionContext;
    private final ProfileService profileService;

    @PostMapping("/company/legal-form")
    public ResponseEntity<Void> legalForm(@Valid @RequestBody LegalFormRequest body, HttpServletRequest request) {
        applicationService.setLegalForm(sessionContext.requireCompanyId(request), body.legalForm());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/applications")
    @ResponseStatus(HttpStatus.CREATED)
    public ApplicationView create(@Valid @RequestBody ApplicationFormDto body, HttpServletRequest request) {
        var user = sessionContext.requireUser(request);
        ApplicationView view = applicationService.create(sessionContext.requireCompanyId(request), body);
        // контакты из анкеты сохраняем в личный кабинет, если там их ещё нет
        var applicant = body.step2().applicant();
        profileService.fillIfEmpty(user.getId(), applicant.phone(), applicant.email());
        return view;
    }

    @GetMapping("/applications")
    public List<ApplicationView> mine(HttpServletRequest request) {
        return applicationService.forCompany(sessionContext.requireCompanyId(request));
    }

    @PostMapping("/offers/{id}/sign")
    public ResponseEntity<Void> sign(@PathVariable Long id, HttpServletRequest request) {
        applicationService.signOffer(sessionContext.requireCompanyId(request), id);
        return ResponseEntity.noContent().build();
    }
}
