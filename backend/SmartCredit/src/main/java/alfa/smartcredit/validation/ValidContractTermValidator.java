package alfa.smartcredit.validation;

import alfa.smartcredit.service.ProductRules;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

public class ValidContractTermValidator implements ConstraintValidator<ValidContractTerm, Integer> {
    @Override
    public boolean isValid(Integer value, ConstraintValidatorContext ctx) {
        return value == null || ProductRules.CONTRACT_TERM_MONTHS.contains(value);
    }
}
