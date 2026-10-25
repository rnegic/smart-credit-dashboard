package alfa.smartcredit.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

/** Bounded, untrusted conversation and the currently rendered client screen. */
public record AssistantRequest(
        @NotBlank @Size(max = 1000) String message,
        @NotNull @Size(max = 12) List<@NotNull @Valid Message> history,
        @NotNull @Valid Screen screen) {

    /** Only conversational roles are accepted; history never becomes provider instructions. */
    public record Message(
            @NotNull @Pattern(regexp = "user|assistant") String role,
            @NotBlank @Size(max = 6000) String content) {}

    /** Screen values may be unsaved and are not authoritative application data. */
    public record Screen(
            @NotNull @Size(max = 200) String path,
            @NotNull @Size(max = 300) String title,
            @Size(max = 160) String step,
            @Size(max = 200) String product,
            @NotNull @Size(max = 12000) String text,
            @Size(max = 160) String focusedFieldId,
            @NotNull @Size(max = 40) List<@NotNull @Valid Field> fields) {}

    /** Field metadata supports explanation and optional focus, never mutation. */
    public record Field(
            @NotNull @Size(max = 160) String id,
            @NotNull @Size(max = 200) String label,
            @NotNull @Size(max = 600) String hint,
            @Size(max = 300) String value,
            @NotNull Boolean filled,
            @NotNull Boolean required,
            @NotNull Boolean invalid,
            @NotNull Boolean readOnly) {}

    /** Limits the aggregate history in addition to per-message constraints. */
    @JsonIgnore
    @AssertTrue(message = "Суммарная длина истории не должна превышать 24000 символов")
    public boolean isHistoryWithinLimit() {
        return history == null || history.stream()
                .filter(item -> item != null && item.content() != null)
                .mapToLong(item -> item.content().length()).sum() <= 24000;
    }
}
