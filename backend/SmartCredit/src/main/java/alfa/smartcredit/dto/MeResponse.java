package alfa.smartcredit.dto;

public record MeResponse(Long userId, String fullName, String role, Long companyId, String legalForm,
                         String phone, String email) {}
