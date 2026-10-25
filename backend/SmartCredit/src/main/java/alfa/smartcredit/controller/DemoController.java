package alfa.smartcredit.controller;

import alfa.smartcredit.dto.*;
import alfa.smartcredit.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class DemoController {
    private final UserRepository userRepository;

    /** Только 4 показательных сценария (+ сотрудник банка), остальные аккаунты скрыты. */
    @GetMapping("/demo/profiles")
    public List<DemoAccountDto> profiles() {
        return userRepository.findByDemoOrderIsNotNullOrderByDemoOrderAsc().stream()
                .map(u -> new DemoAccountDto(u.getLogin(), u.getPassword(), u.getRole().name(),
                        u.getFullName(), u.getDescription()))
                .toList();
    }
}
