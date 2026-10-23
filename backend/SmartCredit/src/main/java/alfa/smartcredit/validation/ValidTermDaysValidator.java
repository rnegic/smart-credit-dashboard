package alfa.smartcredit.validation;

import alfa.smartcredit.service.ProductRules;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

public class ValidTermDaysValidator implements ConstraintValidator<ValidTermDays, Integer> {
    @Override
    public boolean isValid(Integer value, ConstraintValidatorContext ctx) {
        return value == null || ProductRules.TERM_DAYS.contains(value);
    }
}
