package alfa.smartcredit.controller;

import alfa.smartcredit.dto.DashboardResponse;
import alfa.smartcredit.service.DashboardService;
import alfa.smartcredit.service.SessionContext;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;
    private final SessionContext sessionContext;

    @GetMapping("/dashboard")
    public DashboardResponse dashboard(HttpServletRequest request) {
        Long companyId = sessionContext.requireCompanyId(request);
        return dashboardService.build(companyId);
    }
}
