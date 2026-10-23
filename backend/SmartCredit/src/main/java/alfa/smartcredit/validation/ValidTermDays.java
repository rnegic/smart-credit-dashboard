package alfa.smartcredit.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.*;

/** Срок транша в днях: только 30, 60 или 90. null допускается (проверяйте @NotNull отдельно). */
@Documented
@Constraint(validatedBy = ValidTermDaysValidator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT, ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
public @interface ValidTermDays {
    String message() default "termDays должен быть 30, 60 или 90";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}
