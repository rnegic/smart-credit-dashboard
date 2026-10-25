package alfa.smartcredit.service;

import alfa.smartcredit.dto.ApplicationFormDto;
import alfa.smartcredit.dto.TrancheRequest;
import alfa.smartcredit.exception.ApiException;
import alfa.smartcredit.model.Company;
import alfa.smartcredit.model.CreditApplication;
import alfa.smartcredit.model.Offer;
import alfa.smartcredit.model.Tranche;
import alfa.smartcredit.model.enums.BkiZone;
import alfa.smartcredit.model.enums.DecisionStatus;
import alfa.smartcredit.model.enums.OfferStatus;
import alfa.smartcredit.model.enums.RevenueTrend;
import alfa.smartcredit.model.enums.RiskClass;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;
import alfa.smartcredit.repository.CompanyRepository;
import alfa.smartcredit.repository.OfferRepository;
import alfa.smartcredit.repository.TrancheRepository;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Сценарии из ТЗ (ИП и ООО). Кладётся в src/test/java/alfa/smartcredit/service/. */
class ScoringScenariosTest {

    private final DecisionEngine engine = new DecisionEngine();

    private static BigDecimal bd(String s) { return new BigDecimal(s); }

    private ScoringService scoring(ExternalDataService.ExternalData ext) {
        return new ScoringService(new ExternalDataService() {
            @Override public ExternalData fetch(Company c) { return ext; }
        });
    }

    private static Company company(String legalForm, String okved) {
        Company c = new Company();
        c.setInn("0000000000");
        c.setLegalForm(legalForm);
        c.setOkved(okved);
        return c;
    }

    private static ApplicationFormDto form(String type, String amount, int termDays, String monthlyRevenue,
                                           String debt, String other, String annualRevenue, Integer employees) {
        return form(type, amount, termDays, monthlyRevenue, debt, other, annualRevenue, employees, null);
    }

    private static ApplicationFormDto form(String type, String amount, int termDays, String monthlyRevenue,
                                           String debt, String other, String annualRevenue, Integer employees,
                                           ApplicationFormDto.ExternalDataOverride externalData) {
        var s1 = new ApplicationFormDto.Step1("task", bd(amount), termDays, 12, null, "purpose");
        var applicant = new ApplicationFormDto.Applicant(type, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null);
        var fin = new ApplicationFormDto.Financials(bd(monthlyRevenue), bd(debt),
                annualRevenue == null ? null : bd(annualRevenue), employees, bd(other));
        return new ApplicationFormDto(null, null, null, s1,
                new ApplicationFormDto.Step2(applicant, fin, externalData), null, null, null);
    }

    private DecisionEngine.Decision run(String legalForm, String okved, ExternalDataService.ExternalData ext,
                                        ApplicationFormDto f, ScoringService.Result[] out) {
        ScoringService.Result r = scoring(ext).score(company(legalForm, okved), f);
        out[0] = r;
        return engine.decide(f.step1().amount(), f.step2().financials().monthlyRevenue(), r, legalForm);
    }

    // ---------------- ИП ----------------

    @Test void ip1_idealClient_approved() {
        var out = new ScoringService.Result[1];
        var d = run("IP", "62.01", new ExternalDataService.ExternalData(800, 0, 1, 0, RevenueTrend.GROWING, 5),
                form("IP", "500000", 60, "1000000", "10000", "0", null, null), out);
        assertEquals(100, out[0].internalScore());
        assertEquals(RiskClass.A, out[0].riskClass());
        assertEquals(DecisionStatus.APPROVED, d.status());
        assertEquals(bd("24.75"), d.finalRate());
    }

    @Test void ip2_requestAboveLimit_alternative() {
        var out = new ScoringService.Result[1];
        var d = run("IP", "41.20", new ExternalDataService.ExternalData(700, 0, 3, 0, RevenueTrend.STABLE, 2),
                form("IP", "6000000", 30, "10000000", "0", "0", null, null), out);
        assertEquals(68, out[0].internalScore());
        assertEquals(RiskClass.B, out[0].riskClass());
        assertEquals(DecisionStatus.ALTERNATIVE_OFFER, d.status());
        // лимит = 10 млн * 1.2 * 3 = 36 млн -> 20 млн, сумма 6 млн остаётся как есть
        assertEquals(0, bd("6000000").compareTo(d.amount()));
        assertEquals(bd("25.25"), d.finalRate());
    }

    @Test void ip3_borderline_manualReview() {
        var out = new ScoringService.Result[1];
        var d = run("IP", "99", new ExternalDataService.ExternalData(500, 1, 4, 0, RevenueTrend.DECLINING, 0),
                form("IP", "100000", 30, "200000", "20000", "0", null, null), out);
        assertEquals(42, out[0].internalScore());
        assertEquals(RiskClass.C, out[0].riskClass());
        assertEquals(DecisionStatus.MANUAL_REVIEW, d.status());
    }

    @Test void ip4_delinquencies_declined() {
        var out = new ScoringService.Result[1];
        var d = run("IP", "62.01", new ExternalDataService.ExternalData(800, 2, 1, 0, RevenueTrend.GROWING, 5),
                form("IP", "500000", 60, "1000000", "0", "0", null, null), out);
        assertEquals(DecisionStatus.DECLINED, d.status());
    }

    @Test void ip5_dti_declined() {
        var out = new ScoringService.Result[1];
        var d = run("IP", "62.01", new ExternalDataService.ExternalData(800, 0, 1, 0, RevenueTrend.STABLE, 5),
                form("IP", "1000000", 30, "100000", "0", "0", null, null), out);
        assertTrue(out[0].dtiPercent() > 70);
        assertEquals(DecisionStatus.DECLINED, d.status());
    }

    @Test void ip_rateDependsOnlyOnTerm() {
        assertEquals(bd("24.50"), ProductRules.baseRate("IP", null, 30));
        assertEquals(bd("24.75"), ProductRules.baseRate("IP", null, 60));
        assertEquals(bd("25.00"), ProductRules.baseRate("IP", null, 90));
    }

    // ---------------- ООО ----------------

    @Test void ooo1_idealMicro_approved() {
        var out = new ScoringService.Result[1];
        var d = run("OOO", "62.01", new ExternalDataService.ExternalData(800, 0, 1, 0, RevenueTrend.GROWING, 5),
                form("OOO", "500000", 60, "1000000", "10000", "0", "12000000", 5), out);
        assertEquals(ProductRules.BusinessScale.MICRO, out[0].businessScale());
        assertEquals(100, out[0].internalScore());
        assertEquals(DecisionStatus.APPROVED, d.status());
        assertEquals(bd("22.00"), d.finalRate());
    }

    @Test void ooo2_smallRequestAboveLimit_alternative() {
        // В таблице ТЗ для ООО нет inquiries/revenueTrend - взяты 1 и GROWING (итого 81, класс A)
        var out = new ScoringService.Result[1];
        var d = run("OOO", "41.20", new ExternalDataService.ExternalData(700, 0, 1, 0, RevenueTrend.GROWING, 3),
                form("OOO", "15000000", 90, "10000000", "100000", "50000", "120000000", 30), out);
        assertEquals(ProductRules.BusinessScale.SMALL, out[0].businessScale());
        assertEquals(RiskClass.A, out[0].riskClass());
        assertEquals(DecisionStatus.ALTERNATIVE_OFFER, d.status());
        assertEquals(bd("23.60"), d.finalRate()); // 23.00 + 0.10 (A, альтернатива) + 0.50 (строительство)
    }

    @Test void ooo4_youngCompany_hardStop() {
        var out = new ScoringService.Result[1];
        var d = run("OOO", "62.01", new ExternalDataService.ExternalData(800, 0, 1, 0, RevenueTrend.GROWING, 0),
                form("OOO", "500000", 60, "1000000", "0", "0", "12000000", 5), out);
        assertEquals(DecisionStatus.DECLINED, d.status());
        assertTrue(d.reason().contains("1 года"));
    }

    @Test void ooo5_dti_declined() {
        var out = new ScoringService.Result[1];
        var d = run("OOO", "62.01", new ExternalDataService.ExternalData(800, 0, 1, 0, RevenueTrend.GROWING, 5),
                form("OOO", "1000000", 30, "100000", "0", "0", "1200000", 5), out);
        assertEquals(DecisionStatus.DECLINED, d.status());
    }

    @Test void ooo_baseRateMatrix() {
        assertEquals(bd("20.00"), ProductRules.baseRate("OOO", ProductRules.BusinessScale.MICRO, 30));
        assertEquals(bd("24.00"), ProductRules.baseRate("OOO", ProductRules.BusinessScale.MICRO, 90));
        assertEquals(bd("19.00"), ProductRules.baseRate("OOO", ProductRules.BusinessScale.SMALL, 30));
        assertEquals(bd("23.00"), ProductRules.baseRate("OOO", ProductRules.BusinessScale.SMALL, 90));
    }

    @Test void externalOverrides_replaceOnlyProvidedFields() {
        Company c = company("IP", "62.01");
        c.setInn("772567890123");
        ExternalDataService service = new ExternalDataService();
        ExternalDataService.ExternalData base = service.fetch(c);

        ExternalDataService.ExternalData resolved = service.fetch(c,
                new ApplicationFormDto.ExternalDataOverride(900, null, 0, RevenueTrend.GROWING, 20));

        assertEquals(900, resolved.bkiScore());
        assertEquals(base.delinquencies12m(), resolved.delinquencies12m());
        assertEquals(0, resolved.inquiries12m());
        assertEquals(RevenueTrend.GROWING, resolved.revenueTrend());
        assertEquals(20, resolved.companyAgeYears());
    }

    @Test void scoringAndDecision_useExternalOverrides() {
        var overrides = new ApplicationFormDto.ExternalDataOverride(900, 2, 0, RevenueTrend.GROWING, 10);
        var f = form("IP", "50000", 30, "200000", "60000", "0", null, null, overrides);
        ScoringService.Result r = new ScoringService(new ExternalDataService())
                .score(company("IP", "62.01"), f);
        var d = engine.decide(f.step1().amount(), f.step2().financials().monthlyRevenue(), r, "IP");

        assertEquals(900, r.external().bkiScore());
        assertEquals(2, r.external().delinquencies12m());
        assertEquals(RevenueTrend.GROWING, r.external().revenueTrend());
        assertEquals(10, r.external().companyAgeYears());
        assertEquals(0, r.points().get("delinquencies12m"));
        assertEquals(20, r.points().get("bkiScore"));
        assertEquals(15, r.points().get("revenueTrend"));
        assertEquals(DecisionStatus.DECLINED, d.status());
        assertTrue(d.reason().contains("12"));
    }

    // ---------------- общие формулы ----------------

    @Test void newMonthlyPayment_examples() {
        var s = scoring(null);
        // ООО: 1 млн, 60 дней, 22% -> 536 164 ₽ (пример из ТЗ)
        assertEquals(0, bd("536164.38").compareTo(s.monthlyPayment(bd("1000000"), bd("22.00"), 60)));
    }

    @Test void bkiZone_thresholdsDifferForIpAndOoo() {
        assertEquals(BkiZone.YELLOW, BkiZone.fromScore(420, false)); // ИП: жёлтая от 400
        assertEquals(BkiZone.RED,    BkiZone.fromScore(420, true));  // ООО: красная до 450
        assertEquals(BkiZone.GREEN,  BkiZone.fromScore(700, true));
    }

    @Test void riskPremium() {
        assertEquals(bd("0.10"), ProductRules.riskPremium(RiskClass.A));
        assertEquals(bd("0.25"), ProductRules.riskPremium(RiskClass.B));
        assertEquals(bd("0.50"), ProductRules.riskPremium(RiskClass.C));
    }

    @Test void issuedTrancheAndDocumentsUseFixedApprovedTerms() {
        Offer offer = signedOffer();
        var issued = contracts(offer).issue(1L, offer.getId(), new TrancheRequest(bd("1000.01")));
        assertEquals(60, issued.termDays());
        assertEquals(issued.issuedAt().plusDays(60), issued.dueDate());
        assertEquals(bd("19.50"), issued.ratePercent());
        assertEquals(bd("1000.01"), issued.amount());

        Company company = company("OOO", "62.01");
        company.setName("Тестовая компания");
        CreditApplication app = new CreditApplication();
        app.setId(offer.getApplicationId());
        app.setTermDays(60);
        for (var document : new DocumentService().buildDocuments(company, app, offer)) {
            assertTrue(document.content().contains("Срок каждого транша: 60 дней"));
            assertTrue(document.content().contains("19.50%"));
            assertFalse(document.content().contains("на выбор"));
            assertFalse(document.content().contains("30, 60 или 90"));
        }
    }

    @Test void fixedSixtyDayTrancheIsBlockedWithFortyFiveDaysLeftInContract() {
        Offer offer = signedOffer();
        offer.setContractEnd(LocalDate.now().plusDays(45));
        ContractService service = contracts(offer);
        var view = service.toView(offer);
        assertEquals(60, view.trancheTerms().termDays());
        assertFalse(view.trancheTerms().available());
        assertFalse(view.canIssueTranche());
        assertEquals("CONTRACT_ENDING", view.issueBlockedReason());
        ApiException error = assertThrows(ApiException.class,
                () -> service.issue(1L, offer.getId(), new TrancheRequest(bd("1000"))));
        assertEquals("TRANCHE_EXCEEDS_CONTRACT", error.getCode());
    }

    @Test void missingContractRateBlocksIssueInsteadOfUsingCurrentRateMatrix() {
        Offer offer = signedOffer();
        offer.setRatePercent(null);
        ContractService service = contracts(offer);
        assertEquals("RATE_UNAVAILABLE", service.toView(offer).issueBlockedReason());
        ApiException error = assertThrows(ApiException.class,
                () -> service.issue(1L, offer.getId(), new TrancheRequest(bd("1000"))));
        assertEquals("RATE_UNAVAILABLE", error.getCode());
    }

    private Offer signedOffer() {
        Offer offer = new Offer();
        offer.setId(9L);
        offer.setCompanyId(1L);
        offer.setApplicationId(7L);
        offer.setAmount(bd("500000"));
        offer.setTermDays(60);
        offer.setTermMonths(2);
        offer.setContractTermMonths(12);
        offer.setContractStart(LocalDate.now());
        offer.setContractEnd(LocalDate.now().plusMonths(12));
        offer.setSignedAt(Instant.now());
        offer.setStatus(OfferStatus.ACCEPTED);
        offer.setRatePercent(bd("19.50"));
        offer.setRateSpread(bd("10.00"));
        return offer;
    }

    private ContractService contracts(Offer offer) {
        OfferRepository offers = mock(OfferRepository.class);
        TrancheRepository tranches = mock(TrancheRepository.class);
        when(offers.findForUpdate(offer.getId())).thenReturn(Optional.of(offer));
        when(tranches.findByOfferIdOrderByIdDesc(offer.getId())).thenReturn(List.of());
        when(tranches.save(any(Tranche.class))).thenAnswer(invocation -> {
            Tranche tranche = invocation.getArgument(0);
            tranche.setId(71L);
            return tranche;
        });
        return new ContractService(offers, tranches, mock(CompanyRepository.class),
                mock(ApplicationEventPublisher.class));
    }
}
