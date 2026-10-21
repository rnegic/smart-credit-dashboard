package alfa.smartcredit.controller;

import alfa.smartcredit.dto.*;
import alfa.smartcredit.model.User;
import alfa.smartcredit.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Comparator;
import java.util.List;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class DemoController {
    private final UserRepository userRepository;

    @GetMapping("/demo/profiles")
    public List<DemoAccountDto> profiles() {
        return userRepository.findAll().stream()
                .sorted(Comparator.comparing(User::getId))
                .map(u -> new DemoAccountDto(u.getLogin(), u.getPassword(), u.getRole().name(),
                        u.getFullName(), u.getDescription()))
                .toList();
    }
}
