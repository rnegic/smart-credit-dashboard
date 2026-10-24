package alfa.smartcredit.dto;

import java.time.Instant;
import java.util.List;

/** Ответ GET /documents и POST /offers/{id}/sign. */
public record DocumentsResponse(
        Long applicationId,
        Long offerId,
        String documentVersion,
        List<DocumentDto> documents,
        boolean signingAllowed,
        Instant signedAt,
        Signer signedBy,
        boolean demo) {

    /** Снимок подписанта, сформированный сервером. */
    public record Signer(Long id, String fullName) {}
}