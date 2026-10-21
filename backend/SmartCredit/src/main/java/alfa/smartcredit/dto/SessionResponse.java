package alfa.smartcredit.dto;

public record SessionResponse(boolean authenticated, Long companyId, String companyName, String profileId) {}
