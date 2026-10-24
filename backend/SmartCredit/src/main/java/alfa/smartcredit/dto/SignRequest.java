package alfa.smartcredit.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/** Тело POST /offers/{id}/sign. ФИО и время клиент не передаёт. */
public record SignRequest(
        @NotBlank String documentVersion,
        @NotNull Boolean confirmed) {}