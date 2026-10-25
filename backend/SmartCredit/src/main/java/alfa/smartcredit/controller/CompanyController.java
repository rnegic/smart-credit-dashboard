package alfa.smartcredit.controller;

import alfa.smartcredit.config.OpenApiConfig;
import alfa.smartcredit.dto.CompanyRequest;
import alfa.smartcredit.dto.CompanyView;
import alfa.smartcredit.service.CompanyService;
import alfa.smartcredit.service.SessionContext;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/company")
@RequiredArgsConstructor
@Tag(name = "Профиль")
@SecurityRequirement(name = OpenApiConfig.SESSION_SECURITY_SCHEME)
public class CompanyController {
    private final CompanyService companyService;
    private final SessionContext sessionContext;

    @PutMapping
    @Operation(summary = "Обновить реквизиты компании",
            description = "Изменяет название, ИНН и ОКВЭД компании текущего клиента.")
    public CompanyView update(@Valid @RequestBody CompanyRequest body, HttpServletRequest request) {
        return companyService.update(sessionContext.requireCompanyId(request), body);
    }
}
