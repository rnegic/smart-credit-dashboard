package alfa.smartcredit.service;

import alfa.smartcredit.exception.ApiException;
import alfa.smartcredit.model.User;
import alfa.smartcredit.model.enums.Role;
import alfa.smartcredit.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
@RequiredArgsConstructor
public class SessionContext {
    private static final String USER_ID = "userId";
    private final UserRepository userRepository;

    public void bind(HttpServletRequest request, Long userId) {
        request.getSession(true).setAttribute(USER_ID, userId);
    }

    public User requireUser(HttpServletRequest request) {
        HttpSession s = request.getSession(false);
        if (s == null || s.getAttribute(USER_ID) == null) throw ApiException.unauthorized();
        return userRepository.findById((Long) s.getAttribute(USER_ID))
                .orElseThrow(ApiException::unauthorized);
    }

    public Long requireCompanyId(HttpServletRequest request) {
        User u = requireUser(request);
        if (u.getRole() != Role.CLIENT || u.getCompanyId() == null) throw ApiException.forbidden();
        return u.getCompanyId();
    }

    public User requireOfficer(HttpServletRequest request) {
        User u = requireUser(request);
        if (u.getRole() != Role.BANK_OFFICER) throw ApiException.forbidden();
        return u;
    }

    public void clear(HttpServletRequest request) {
        HttpSession s = request.getSession(false);
        if (s != null) s.invalidate();
    }
}
