package alfa.smartcredit.controller;

import alfa.smartcredit.dto.*;
import alfa.smartcredit.repository.UserRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@Tag(name = "Демо")
public class DemoController {
    private final UserRepository userRepository;

    /** Только 4 показательных сценария (+ сотрудник банка), остальные аккаунты скрыты. */
    @GetMapping("/demo/profiles")
    @Operation(summary = "Демо-учётные записи",
            description = "Логины и пароли четырёх клиентских сценариев и сотрудника банка. "
                    + "Используются для входа через POST /api/auth/login.")
    public List<DemoAccountDto> profiles() {
        return userRepository.findByDemoOrderIsNotNullOrderByDemoOrderAsc().stream()
                .map(u -> new DemoAccountDto(u.getLogin(), u.getPassword(), u.getRole().name(),
                        u.getFullName(), u.getDescription()))
                .toList();
    }
}
