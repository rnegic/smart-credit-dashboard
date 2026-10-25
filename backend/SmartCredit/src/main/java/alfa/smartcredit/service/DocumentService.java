package alfa.smartcredit.service;

import alfa.smartcredit.dto.DocumentDto;
import alfa.smartcredit.model.Company;
import alfa.smartcredit.model.CreditApplication;
import alfa.smartcredit.model.Offer;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Locale;

/**
 * Формирует два демонстрационных текста из сохранённых реквизитов и финального Offer.
 * Не придумывает отсутствующие реквизиты, не пересчитывает условия.
 */
@Service
public class DocumentService {

    public List<DocumentDto> buildDocuments(Company company, CreditApplication app, Offer offer) {
        Applicant ap = resolveApplicant(company, app);
        return List.of(
                new DocumentDto("OVERDRAFT_AGREEMENT", "Договор овердрафта",
                        buildOverdraftAgreement(app, offer, ap)),
                new DocumentDto("INDIVIDUAL_TERMS", "Индивидуальные условия",
                        buildIndividualTerms(app, offer, ap)));
    }

    private record Applicant(String name, String inn, String ogrn, String ogrnip, String kpp, String type) {}

    private Applicant resolveApplicant(Company company, CreditApplication app) {
        String type = company.getLegalForm() != null ? company.getLegalForm() : "IP";
        String name = company.getName();
        String ogrn = null, ogrnip = null, kpp = null;

        JsonNode form = app.getFormData();
        if (form != null) {
            JsonNode a = form.at("/step2_businessData/applicant");
            if (a != null && !a.isMissingNode()) {
                String apType = textOrNull(a, "type");
                if (apType != null) type = apType;
                if ("IP".equals(type)) {
                    String last = textOrNull(a, "lastName");
                    String first = textOrNull(a, "firstName");
                    String middle = textOrNull(a, "middleName");
                    StringBuilder sb = new StringBuilder("ИП");
                    if (last != null) sb.append(' ').append(last);
                    if (first != null) sb.append(' ').append(first);
                    if (middle != null) sb.append(' ').append(middle);
                    if (sb.length() > 2) name = sb.toString();
                } else {
                    String n = textOrNull(a, "companyName");
                    if (n != null) name = n;
                }
                ogrn   = textOrNull(a, "ogrn");
                ogrnip = textOrNull(a, "ogrnip");
                kpp    = textOrNull(a, "kpp");
            }
        }
        return new Applicant(name, company.getInn(), ogrn, ogrnip, kpp, type);
    }

    private String buildOverdraftAgreement(CreditApplication app, Offer offer, Applicant ap) {
        StringBuilder sb = new StringBuilder();
        sb.append("ДОГОВОР ОВЕРДРАФТА\n");
        sb.append("========================================\n\n");
        sb.append("Заявка №").append(app.getId()).append("\n");
        sb.append("Заёмщик: ").append(ap.name()).append("\n");
        sb.append("ИНН: ").append(ap.inn()).append("\n");
        if (ap.ogrn() != null)   sb.append("ОГРН: ").append(ap.ogrn()).append("\n");
        if (ap.ogrnip() != null) sb.append("ОГРНИП: ").append(ap.ogrnip()).append("\n");
        if (ap.kpp() != null)    sb.append("КПП: ").append(ap.kpp()).append("\n");
        sb.append("\nПредмет: предоставление возобновляемой кредитной линии (овердрафт).\n");
        sb.append("Сумма: ").append(money(offer.getAmount())).append("\n");
        sb.append("Срок транша: ").append(termDays(offer)).append(" дней\n");
        sb.append("Ставка: ").append(pct(offer.getRatePercent())).append("% годовых\n");
        sb.append("Ежемесячный платёж: ").append(money(offer.getMonthlyPayment())).append("\n");
        if (offer.getValidUntil() != null)
            sb.append("Предложение действует до: ").append(offer.getValidUntil()).append("\n");
        sb.append("\nНастоящий документ является демонстрационным и не имеет юридической силы. ")
                .append("Электронная подпись имитируется.\n");
        return sb.toString();
    }

    private String buildIndividualTerms(CreditApplication app, Offer offer, Applicant ap) {
        StringBuilder sb = new StringBuilder();
        sb.append("ИНДИВИДУАЛЬНЫЕ УСЛОВИЯ\n");
        sb.append("=============================================\n\n");
        sb.append("Заявка №").append(app.getId()).append("\n");
        sb.append("Заёмщик: ").append(ap.name()).append("\n");
        sb.append("ИНН: ").append(ap.inn()).append("\n\n");
        sb.append("Индивидуальные условия по продукту «Овердрафт»:\n");
        sb.append(" - Сумма лимита: ").append(money(offer.getAmount())).append("\n");
        sb.append(" - Срок транша: ").append(termDays(offer)).append(" дней\n");
        sb.append(" - Процентная ставка: ").append(pct(offer.getRatePercent())).append("% годовых\n");
        sb.append(" - Ежемесячный платёж: ").append(money(offer.getMonthlyPayment())).append("\n");
        sb.append("\nЗаёмщик подтверждает ознакомление с условиями и принимает их. ")
                .append("Документ является демонстрационным, юридической силы не имеет.\n");
        return sb.toString();
    }

    private static Integer termDays(Offer o) {
        if (o.getTermDays() != null) return o.getTermDays();
        return o.getTermMonths() == null ? null : o.getTermMonths() * 30;
    }

    private static String textOrNull(JsonNode n, String field) {
        JsonNode v = n.path(field);
        if (v.isMissingNode() || v.isNull()) return null;
        String s = v.asText();
        return s == null || s.isBlank() ? null : s;
    }

    private static String money(BigDecimal v) {
        return v == null ? "—"
                : String.format(Locale.forLanguageTag("ru-RU"), "%,.2f ₽", v);
    }

    private static String pct(BigDecimal v) {
        return v == null ? "—" : v.setScale(2, RoundingMode.HALF_UP).toPlainString();
    }
}