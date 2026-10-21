package alfa.smartcredit.controller;

import alfa.smartcredit.dto.ApplicationView;
import alfa.smartcredit.dto.DecisionRequest;
import alfa.smartcredit.service.ApplicationService;
import alfa.smartcredit.service.SessionContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/bank")
@RequiredArgsConstructor
public class BankController {
    private final ApplicationService applicationService;
    private final SessionContext sessionContext;

    @GetMapping("/applications")
    public List<ApplicationView> all(HttpServletRequest request) {
        sessionContext.requireOfficer(request);
        return applicationService.allForBank();
    }

    @GetMapping("/applications/{id}")
    public ApplicationView one(@PathVariable Long id, HttpServletRequest request) {
        sessionContext.requireOfficer(request);
        return applicationService.getForBank(id);
    }

    @PostMapping("/applications/{id}/decision")
    public ApplicationView decide(@PathVariable Long id, @Valid @RequestBody DecisionRequest body,
                                  HttpServletRequest request) {
        sessionContext.requireOfficer(request);
        return applicationService.decide(id, body);
    }
}
