package alfa.smartcredit.controller;

import alfa.smartcredit.dto.LoginRequest;
import alfa.smartcredit.dto.MeResponse;
import alfa.smartcredit.exception.ApiException;
import alfa.smartcredit.model.Company;
import alfa.smartcredit.model.User;
import alfa.smartcredit.repository.CompanyRepository;
import alfa.smartcredit.repository.UserRepository;
import alfa.smartcredit.service.SessionContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {
    private final UserRepository userRepository;
    private final CompanyRepository companyRepository;
    private final SessionContext sessionContext;

    @PostMapping("/login")
    public MeResponse login(@Valid @RequestBody LoginRequest body, HttpServletRequest request) {
        User u = userRepository.findByLogin(body.login())
                .filter(x -> x.getPassword().equals(body.password()))
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED,
                        "BAD_CREDENTIALS", "Неверный логин или пароль"));
        sessionContext.clear(request);              // защита от session fixation
        sessionContext.bind(request, u.getId());
        return toMe(u);
    }

    @GetMapping("/me")
    public MeResponse me(HttpServletRequest request) {
        return toMe(sessionContext.requireUser(request));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request) {
        sessionContext.clear(request);
        return ResponseEntity.noContent().build();
    }

    private MeResponse toMe(User u) {
        String form = u.getCompanyId() == null ? null :
                companyRepository.findById(u.getCompanyId()).map(Company::getLegalForm).orElse(null);
        return new MeResponse(u.getId(), u.getFullName(), u.getRole().name(), u.getCompanyId(), form);
    }
}
