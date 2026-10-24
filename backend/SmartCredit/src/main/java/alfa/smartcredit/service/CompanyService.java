package alfa.smartcredit.service;

import alfa.smartcredit.dto.CompanyRequest;
import alfa.smartcredit.dto.CompanyView;
import alfa.smartcredit.exception.ApiException;
import alfa.smartcredit.model.Company;
import alfa.smartcredit.repository.CompanyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CompanyService {
    private final CompanyRepository companyRepository;

    @Transactional
    public CompanyView update(Long companyId, CompanyRequest req) {
        Company company = companyRepository.findById(companyId).orElseThrow(ApiException::unauthorized);
        company.setName(req.name().trim());
        company.setInn(req.inn().trim());
        company.setOkved(blankToNull(req.okved()));
        return view(company);
    }

    private static CompanyView view(Company company) {
        return new CompanyView(company.getId(), company.getName(), company.getInn(),
                company.getOkved(), company.getLegalForm());
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
