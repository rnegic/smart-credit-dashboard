package alfa.smartcredit.service;

import alfa.smartcredit.dto.ApplicationFormDto;
import alfa.smartcredit.dto.PrefillResponse;
import alfa.smartcredit.exception.ApiException;
import alfa.smartcredit.model.Company;
import alfa.smartcredit.repository.CompanyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.node.ObjectNode;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ApplicationFormService {

    private final CompanyRepository companyRepository;
    private final AiExtractionService ai;

    @Transactional(readOnly = true)
    public PrefillResponse prefill(Long companyId, String phone, String email, String text) {
        Company c = companyRepository.findById(companyId).orElseThrow(ApiException::unauthorized);
        if (c.getLegalForm() == null)
            throw new ApiException(HttpStatus.CONFLICT, "LEGAL_FORM_REQUIRED", "Сначала выберите ИП или ООО");

        AiExtractionService.Extracted x = ai.extract(text);
        boolean ip = "IP".equals(c.getLegalForm());

        // ВАЖНО: передаем null для annualRevenue, averageEmployeeCount и otherMonthlyObligations,
        // так как ИИ их пока не извлекает. Фронт или пользователь заполнит их на шаге 2.
        ApplicationFormDto form = new ApplicationFormDto(
                null, Instant.now(), "DRAFT",
                new ApplicationFormDto.Step1(x.businessTask(), x.amount(), x.termDays(), x.contractTermMonths(), null, x.purpose()),
                new ApplicationFormDto.Step2(
                        registryMock(c, x, phone, email),
                        new ApplicationFormDto.Financials(
                                x.monthlyRevenue(),
                                x.existingDebt(),
                                null, // annualRevenue
                                null, // averageEmployeeCount
                                null  // otherMonthlyObligations
                        ),
                        null),
                new ApplicationFormDto.Prefilled(ip ? "EGRIP_MOCK" : "EGRUL_MOCK", Instant.now(), false),
                new ApplicationFormDto.Step3(new ApplicationFormDto.Consents(false, false, false, null)),
                new ApplicationFormDto.Meta("1.3", List.of("form_started")));

        String s1 = "step1_financingParameters.", s2 = "step2_businessData.";
        List<String> filled = new ArrayList<>(), missing = new ArrayList<>();
        track(x.businessTask() != null, s1 + "businessTask", filled, missing);
        track(x.amount() != null,       s1 + "amount", filled, missing);
        track(x.termDays() != null,     s1 + "termDays", filled, missing);
        track(x.contractTermMonths() != null, s1 + "contractTermMonths", filled, missing);
        track(x.purpose() != null,      s1 + "purpose", filled, missing);
        track(x.monthlyRevenue() != null, s2 + "financials.monthlyRevenue", filled, missing);
        track(x.existingDebt() != null, s2 + "financials.existingDebt", filled, missing);

        // Контакты берём из личного кабинета (БД); если их там нет, клиент заполнит сам
        track(phone != null, s2 + "applicant.phone", filled, missing);
        track(email != null, s2 + "applicant.email", filled, missing);
        if (x.industry() != null) filled.add(s2 + "applicant.industry");
        if (x.taxSystem() != null) filled.add(s2 + "applicant.taxSystem");

        return new PrefillResponse(form, filled, missing);
    }

    public static void applyCompanyIdentity(ObjectNode form, Company company) {
        ObjectNode applicant = (ObjectNode) form.at("/step2_businessData/applicant");
        applicant.put("type", company.getLegalForm());
        applicant.put("inn", company.getInn());
        applicant.put("companyName", company.getName());
        applicant.put("mainOkved", company.getOkved());
        applicant.put("registrationDate", ExternalDataService.registrationDate(company.getInn()).toString());
    }

    private static String blankToNull(String s) { return s == null || s.isBlank() ? null : s; }

    private void track(boolean ok, String path, List<String> filled, List<String> missing) {
        (ok ? filled : missing).add(path);
    }

    /** Мок реестра ЕГРИП/ЕГРЮЛ: детерминированный по ИНН. */
    private ApplicationFormDto.Applicant registryMock(Company c, AiExtractionService.Extracted x,
                                                      String phone, String email) {
        boolean ip = "IP".equals(c.getLegalForm());
        LocalDate reg = ExternalDataService.registrationDate(c.getInn());

        String first = null, last = null, middle = null;
        if (ip) {
            String[] p = c.getName().replaceFirst("^ИП\\s+", "").split("\\s+");
            last = p.length > 0 ? p[0] : null;
            first = p.length > 1 ? p[1] : null;
            middle = p.length > 2 ? p[2] : null;
        }

        String ogrnip = ip ? ("3" + c.getInn().repeat(3)).substring(0, 15) : null;
        String ogrn = ip ? null : ("1" + c.getInn().repeat(3)).substring(0, 13);
        // Мок КПП для ООО
        String kpp = ip ? null : "770101001";

        // Передаем kpp в правильном порядке (после ogrn)
        return new ApplicationFormDto.Applicant(
                c.getLegalForm(), c.getName(), c.getInn(), x.taxSystem(),
                first, last, middle,
                ogrnip, ogrn, kpp,
                reg, c.getOkved(),
                x.industry(), blankToNull(phone), blankToNull(email), "г. Москва (данные реестра, демо)");
    }
}
