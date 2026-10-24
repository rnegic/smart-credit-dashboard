package alfa.smartcredit.controller;

import alfa.smartcredit.dto.CompanyRequest;
import alfa.smartcredit.dto.CompanyView;
import alfa.smartcredit.service.CompanyService;
import alfa.smartcredit.service.SessionContext;
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
public class CompanyController {
    private final CompanyService companyService;
    private final SessionContext sessionContext;

    @PutMapping
    public CompanyView update(@Valid @RequestBody CompanyRequest body, HttpServletRequest request) {
        return companyService.update(sessionContext.requireCompanyId(request), body);
    }
}
