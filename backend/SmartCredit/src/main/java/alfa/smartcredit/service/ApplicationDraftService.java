package alfa.smartcredit.service;

import alfa.smartcredit.dto.ApplicationDraftRequest;
import alfa.smartcredit.dto.ApplicationDraftResponse;
import alfa.smartcredit.dto.ApplicationFormDto;
import alfa.smartcredit.exception.ApiException;
import alfa.smartcredit.model.ApplicationDraft;
import alfa.smartcredit.model.Company;
import alfa.smartcredit.repository.ApplicationDraftRepository;
import alfa.smartcredit.repository.CompanyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

import java.time.Instant;
import java.util.Objects;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ApplicationDraftService {
    private final ApplicationDraftRepository draftRepository;
    private final CompanyRepository companyRepository;
    private final ObjectMapper mapper;

    @Transactional(readOnly = true)
    public Optional<ApplicationDraftResponse> get(Long companyId) {
        Company company = companyRepository.findById(companyId).orElseThrow(ApiException::unauthorized);
        return draftRepository.findById(companyId).map(draft -> toResponse(draft, company));
    }

    @Transactional
    public ApplicationDraftResponse put(Long companyId, ApplicationDraftRequest request) {
        Company company = companyRepository.findById(companyId).orElseThrow(ApiException::unauthorized);
        if (company.getLegalForm() == null)
            throw new ApiException(HttpStatus.CONFLICT, "LEGAL_FORM_REQUIRED", "Select IP or OOO first");

        validateForm(request.form());
        int lastStep = "IP".equals(company.getLegalForm()) ? 3 : 2;
        if (request.currentStep() == null || request.currentStep() < 0 || request.currentStep() > lastStep)
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Invalid currentStep for legal form");

        ApplicationDraft draft = draftRepository.findForUpdate(companyId).orElse(null);
        if (!Objects.equals(request.revision(), draft == null ? null : draft.getRevision()))
            throw conflict();

        Instant now = Instant.now();
        if (draft == null) {
            draft = new ApplicationDraft();
            draft.setCompanyId(companyId);
            draft.setCreatedAt(now);
            draft.setRevision(0L);
        } else {
            draft.setRevision(draft.getRevision() + 1);
        }
        ObjectNode form = mapper.valueToTree(request.form());
        normalize(form, company, draft.getCreatedAt());
        draft.setFormData(form);
        draft.setCurrentStep(request.currentStep());
        draft.setAiFilled(request.aiFilled());
        draft.setMissingFields(request.missingFields());
        draft.setUpdatedAt(now);

        try {
            draft = draftRepository.saveAndFlush(draft);
        } catch (DataIntegrityViolationException e) {
            throw conflict();
        }
        return toResponse(draft, company);
    }

    @Transactional
    public void delete(Long companyId) {
        draftRepository.deleteByCompanyId(companyId);
    }

    private void validateForm(ApplicationFormDto form) {
        if (form == null || form.step1() == null || form.step2() == null
                || form.step2().applicant() == null || form.step2().financials() == null
                || form.step3() == null || form.step3().consents() == null)
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR",
                    "Draft requires step1, step2 with applicant and financials, and step3 with consents");

        if ((form.step1().businessTask() != null && form.step1().businessTask().length() > 500)
                || (form.step1().purpose() != null && form.step1().purpose().length() > 100))
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Form text exceeds submission limits");
    }

    private void normalize(ObjectNode form, Company company, Instant createdAt) {
        ApplicationFormService.applyCompanyIdentity(form, company);
        form.putNull("applicationId");
        form.put("status", "DRAFT");
        form.put("createdAt", createdAt.toString());
    }

    private ApplicationDraftResponse toResponse(ApplicationDraft draft, Company company) {
        ObjectNode form = (ObjectNode) draft.getFormData().deepCopy();
        normalize(form, company, draft.getCreatedAt());
        return new ApplicationDraftResponse(mapper.treeToValue(form, ApplicationFormDto.class),
                draft.getCurrentStep(), draft.getAiFilled(), draft.getMissingFields(),
                draft.getRevision(), draft.getUpdatedAt());
    }

    private ApiException conflict() {
        return new ApiException(HttpStatus.CONFLICT, "DRAFT_CONFLICT", "Draft changed; reload before saving");
    }
}
