package alfa.smartcredit.controller;

import alfa.smartcredit.config.OpenApiConfig;
import alfa.smartcredit.dto.ProfileRequest;
import alfa.smartcredit.dto.ProfileView;
import alfa.smartcredit.service.ProfileService;
import alfa.smartcredit.service.SessionContext;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/profile")
@RequiredArgsConstructor
@Tag(name = "Профиль")
@SecurityRequirement(name = OpenApiConfig.SESSION_SECURITY_SCHEME)
public class ProfileController {
    private final ProfileService profileService;
    private final SessionContext sessionContext;

    @GetMapping
    @Operation(summary = "Получить профиль", description = "Имя, телефон и email текущего пользователя.")
    public ProfileView get(HttpServletRequest request) {
        return profileService.get(sessionContext.requireUser(request).getId());
    }

    @PutMapping
    @Operation(summary = "Обновить контакты",
            description = "Изменяет телефон и email. Пустая строка очищает соответствующее поле.")
    public ProfileView update(@Valid @RequestBody ProfileRequest body, HttpServletRequest request) {
        return profileService.update(sessionContext.requireUser(request).getId(), body);
    }
}
