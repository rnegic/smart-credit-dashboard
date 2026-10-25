package alfa.smartcredit.controller;

import alfa.smartcredit.config.OpenApiConfig;
import alfa.smartcredit.dto.ContractView;
import alfa.smartcredit.dto.TrancheRequest;
import alfa.smartcredit.dto.TrancheView;
import alfa.smartcredit.service.ContractService;
import alfa.smartcredit.service.SessionContext;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@Tag(name = "Договоры и транши")
@SecurityRequirement(name = OpenApiConfig.SESSION_SECURITY_SCHEME)
public class ContractController {
    private final ContractService contractService;
    private final SessionContext sessionContext;

    @GetMapping("/contracts")
    @Operation(summary = "Договоры компании",
            description = "Подписанные договоры овердрафта: срок, лимит, использованный и доступный лимит, транши.")
    public List<ContractView> contracts(HttpServletRequest request) {
        return contractService.list(sessionContext.requireCompanyId(request));
    }

    @GetMapping("/contracts/{id}")
    @Operation(summary = "Договор по идентификатору")
    public ContractView contract(
            @Parameter(description = "Идентификатор договора (= id оферты)", example = "3") @PathVariable Long id,
            HttpServletRequest request) {
        return contractService.get(sessionContext.requireCompanyId(request), id);
    }

    @PostMapping("/contracts/{id}/tranches")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Получить транш (овердрафт)",
            description = "Клиент указывает только сумму в пределах доступного лимита. "
                    + "Срок каждого транша выбран на первом шаге заявки и вместе со ставкой зафиксирован в договоре.")
    public TrancheView issue(
            @Parameter(description = "Идентификатор договора (= id оферты)", example = "3") @PathVariable Long id,
            @Valid @RequestBody TrancheRequest body,
            HttpServletRequest request) {
        return contractService.issue(sessionContext.requireCompanyId(request), id, body);
    }

    @PostMapping("/tranches/{id}/repay")
    @Operation(summary = "Погасить транш",
            description = "Полное погашение: основной долг и проценты за фактические дни пользования. Идемпотентно.")
    public TrancheView repay(
            @Parameter(description = "Идентификатор транша", example = "1") @PathVariable Long id,
            HttpServletRequest request) {
        return contractService.repay(sessionContext.requireCompanyId(request), id);
    }
}
