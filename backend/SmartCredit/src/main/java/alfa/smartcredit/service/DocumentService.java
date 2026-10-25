package alfa.smartcredit.service;

import alfa.smartcredit.dto.DocumentDto;
import alfa.smartcredit.model.Company;
import alfa.smartcredit.model.CreditApplication;
import alfa.smartcredit.model.Offer;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Формирует два демонстрационных текста из сохранённых реквизитов и финального Offer.
 * Не придумывает отсутствующие реквизиты, не пересчитывает условия.
 */
@Service
public class DocumentService {

    public List<DocumentDto> buildDocuments(Company company, CreditApplication app, Offer offer) {
        Applicant ap = resolveApplicant(company, app);
        Map<Integer, BigDecimal> rates = trancheRates(company, app, offer);
        return List.of(
                new DocumentDto("OVERDRAFT_AGREEMENT", "Договор овердрафта",
                        buildOverdraftAgreement(app, offer, ap, rates)),
                new DocumentDto("INDIVIDUAL_TERMS", "Индивидуальные условия",
                        buildIndividualTerms(app, offer, ap, rates)));
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

    private String buildOverdraftAgreement(CreditApplication app, Offer offer, Applicant ap, Map<Integer, BigDecimal> rates) {
        StringBuilder sb = new StringBuilder();
        sb.append("ДОГОВОР ОВЕРДРАФТА\n");
        sb.append("========================================\n\n");
        sb.append("Заявка №").append(app.getId()).append("\n");
        sb.append("Заёмщик: ").append(ap.name()).append("\n");
        sb.append("ИНН: ").append(ap.inn()).append("\n");
        if (ap.ogrn() != null)   sb.append("ОГРН: ").append(ap.ogrn()).append("\n");
        if (ap.ogrnip() != null) sb.append("ОГРНИП: ").append(ap.ogrnip()).append("\n");
        if (ap.kpp() != null)    sb.append("КПП: ").append(ap.kpp()).append("\n");
        sb.append("\nПредмет: предоставление кредитной линии (овердрафт) с выдачей отдельных траншей.\n");
        sb.append("Срок договора: ").append(contractTerm(offer)).append(" мес. с даты подписания\n");
        sb.append("Лимит договора: ").append(money(offer.getAmount())).append("\n");
        sb.append(LIMIT_RULE).append("\n");
        sb.append("Срок каждого транша: 30, 60 или 90 дней, выбирается Заёмщиком при получении транша\n");
        sb.append("Сумма транша: любая, от ").append(money(ProductRules.MIN_TRANCHE_AMOUNT))
                .append(" до доступного остатка лимита\n");
        sb.append("Транш погашается не позднее даты окончания его срока; срок транша не может выходить за срок договора\n");
        sb.append("Ставка по траншу (годовых): ").append(ratesLine(rates)).append("\n");
        sb.append("Ставка фиксируется на дату получения транша и действует до его погашения\n");
        if (offer.getValidUntil() != null)
            sb.append("Предложение действует до: ").append(offer.getValidUntil()).append("\n");
        sb.append("\nНастоящий документ является демонстрационным и не имеет юридической силы. ")
                .append("Электронная подпись имитируется.\n");
        return sb.toString();
    }

    private String buildIndividualTerms(CreditApplication app, Offer offer, Applicant ap, Map<Integer, BigDecimal> rates) {
        StringBuilder sb = new StringBuilder();
        sb.append("ИНДИВИДУАЛЬНЫЕ УСЛОВИЯ\n");
        sb.append("=============================================\n\n");
        sb.append("Заявка №").append(app.getId()).append("\n");
        sb.append("Заёмщик: ").append(ap.name()).append("\n");
        sb.append("ИНН: ").append(ap.inn()).append("\n\n");
        sb.append("Индивидуальные условия по продукту «Овердрафт»:\n");
        sb.append(" - Лимит договора: ").append(money(offer.getAmount())).append("\n");
        sb.append(" - Срок договора: ").append(contractTerm(offer)).append(" мес.\n");
        sb.append(" - Количество траншей: не ограничено, пока не исчерпан лимит\n");
        sb.append(" - Срок транша: 30, 60 или 90 дней (на выбор Заёмщика)\n");
        sb.append(" - Сумма транша: от ").append(money(ProductRules.MIN_TRANCHE_AMOUNT))
                .append(" до доступного остатка лимита\n");
        sb.append(" - Процентная ставка по траншу (годовых): ").append(ratesLine(rates)).append("\n");
        sb.append(" - Расчёт процентов: сумма транша × ставка × фактическое число дней / 365\n");
        sb.append(" - ").append(LIMIT_RULE).append("\n");
        if (offer.getAmount() != null && offer.getRatePercent() != null && termDays(offer) != null)
            sb.append(" - Пример платежа при получении всего лимита одним траншем на ").append(termDays(offer))
                    .append(" дн.: ").append(money(offer.getMonthlyPayment())).append("\n");
        sb.append("\nЗаёмщик подтверждает ознакомление с условиями и принимает их. ")
                .append("Документ является демонстрационным, юридической силы не имеет.\n");
        return sb.toString();
    }

    private static final String LIMIT_RULE = ProductRules.LIMIT_REVOLVING
            ? "Использование лимита: после погашения транша его сумма снова становится доступной"
            : "Использование лимита: сумма всех выданных траншей за срок договора не может превышать лимит; "
                    + "погашение транша лимит не восстанавливает";

    /** Ставка транша на каждый срок: базовая ставка по сроку + надбавка договора. */
    private Map<Integer, BigDecimal> trancheRates(Company company, CreditApplication app, Offer offer) {
        Map<Integer, BigDecimal> res = new LinkedHashMap<>();
        BigDecimal spread = offer.getRateSpread() == null ? BigDecimal.ZERO : offer.getRateSpread();
        for (int d : ProductRules.TERM_DAYS.stream().sorted().toList()) {
            BigDecimal base = ProductRules.baseRate(company.getLegalForm(), app.getBusinessScale(), d);
            res.put(d, base == null ? null : base.add(spread).max(BigDecimal.ZERO));
        }
        return res;
    }

    private static String ratesLine(Map<Integer, BigDecimal> rates) {
        return rates.entrySet().stream()
                .map(e -> e.getKey() + " дн. - " + (e.getValue() == null ? "—" : pct(e.getValue()) + "%"))
                .collect(Collectors.joining("; "));
    }

    private static Integer contractTerm(Offer o) {
        return o.getContractTermMonths() != null ? o.getContractTermMonths() : 12;
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
