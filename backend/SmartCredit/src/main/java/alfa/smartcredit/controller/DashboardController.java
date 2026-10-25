package alfa.smartcredit.controller;

import alfa.smartcredit.config.OpenApiConfig;
import alfa.smartcredit.dto.DashboardResponse;
import alfa.smartcredit.service.DashboardService;
import alfa.smartcredit.service.SessionContext;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@Tag(name = "Дашборд")
@SecurityRequirement(name = OpenApiConfig.SESSION_SECURITY_SCHEME)
public class DashboardController {

    private final DashboardService dashboardService;
    private final SessionContext sessionContext;

    @GetMapping("/dashboard")
    @Operation(summary = "Сводка личного кабинета",
            description = "Компания, текущая заявка, этапы, оферты, действующий кредит, "
                    + "ближайший платёж и число непрочитанных уведомлений.")
    public DashboardResponse dashboard(HttpServletRequest request) {
        Long companyId = sessionContext.requireCompanyId(request);
        return dashboardService.build(companyId);
    }
}
