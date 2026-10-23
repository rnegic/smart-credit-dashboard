package alfa.smartcredit.controller;

import alfa.smartcredit.dto.ProfileRequest;
import alfa.smartcredit.dto.ProfileView;
import alfa.smartcredit.service.ProfileService;
import alfa.smartcredit.service.SessionContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/profile")
@RequiredArgsConstructor
public class ProfileController {
    private final ProfileService profileService;
    private final SessionContext sessionContext;

    @GetMapping
    public ProfileView get(HttpServletRequest request) {
        return profileService.get(sessionContext.requireUser(request).getId());
    }

    @PutMapping
    public ProfileView update(@Valid @RequestBody ProfileRequest body, HttpServletRequest request) {
        return profileService.update(sessionContext.requireUser(request).getId(), body);
    }
}
