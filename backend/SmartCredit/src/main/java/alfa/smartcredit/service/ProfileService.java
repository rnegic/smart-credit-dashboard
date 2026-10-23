package alfa.smartcredit.service;

import alfa.smartcredit.dto.ProfileRequest;
import alfa.smartcredit.dto.ProfileView;
import alfa.smartcredit.exception.ApiException;
import alfa.smartcredit.model.User;
import alfa.smartcredit.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Контакты (телефон, почта) в личном кабинете пользователя. */
@Service
@RequiredArgsConstructor
public class ProfileService {
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public ProfileView get(Long userId) {
        return view(find(userId));
    }

    @Transactional
    public ProfileView update(Long userId, ProfileRequest req) {
        User u = find(userId);
        u.setPhone(blankToNull(req.phone()));
        u.setEmail(blankToNull(req.email()));
        return view(u);
    }

    /** При отправке заявки: если в кабинете контактов ещё нет, сохраняем те, что клиент указал в анкете. */
    @Transactional
    public void fillIfEmpty(Long userId, String phone, String email) {
        User u = find(userId);
        if (isBlank(u.getPhone()) && !isBlank(phone)) u.setPhone(phone.trim());
        if (isBlank(u.getEmail()) && !isBlank(email)) u.setEmail(email.trim());
    }

    private User find(Long userId) {
        return userRepository.findById(userId).orElseThrow(ApiException::unauthorized);
    }

    private ProfileView view(User u) {
        return new ProfileView(u.getId(), u.getFullName(), u.getPhone(), u.getEmail());
    }

    private static boolean isBlank(String s) { return s == null || s.isBlank(); }
    private static String blankToNull(String s) { return isBlank(s) ? null : s.trim(); }
}
