package alfa.smartcredit.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.*;

/** Срок договора овердрафта в месяцах: только 6, 12 или 24. null допускается (проверяйте @NotNull отдельно). */
@Documented
@Constraint(validatedBy = ValidContractTermValidator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT, ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
public @interface ValidContractTerm {
    String message() default "contractTermMonths должен быть 6, 12 или 24";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}
