package alfa.smartcredit.service;

import alfa.smartcredit.dto.ApplicationFormDto;
import alfa.smartcredit.model.Company;
import alfa.smartcredit.model.enums.DecisionStatus;
import alfa.smartcredit.model.enums.RiskClass;
import org.junit.jupiter.api.Test;

import java.lang.reflect.RecordComponent;
import java.math.BigDecimal;
import java.util.HashSet;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** Проверяет, что каждый демо-сценарий для жюри действительно даёт заявленное решение и заполнен целиком. */
class DemoScenariosTest {

    private final ScoringService scoring = new ScoringService(new ExternalDataService());
    private final DecisionEngine engine = new DecisionEngine();
    private final List<alfa.smartcredit.service.DemoScenarioCatalog.Scenario> scenarios = alfa.smartcredit.service.DemoScenarioCatalog.all();

    private record Outcome(ScoringService.Result r, DecisionEngine.Decision d) {}

    private Outcome run(alfa.smartcredit.service.DemoScenarioCatalog.Scenario s) {
        Company c = new Company();
        c.setInn(s.inn());
        c.setName(s.companyName());
        c.setOkved(s.okved());
        c.setLegalForm(s.legalForm());
        var r = scoring.score(c, s.form());
        return new Outcome(r, engine.decide(s.form().step1().amount(),
                s.form().step2().financials().monthlyRevenue(), r, s.legalForm()));
    }

    private Outcome byLogin(String login) {
        return run(scenarios.stream().filter(s -> s.login().equals(login)).findFirst().orElseThrow());
    }

    @Test void fourScenarios_oneForEachOutcome() {
        assertEquals(4, scenarios.size());
        assertEquals(4, scenarios.stream().map(alfa.smartcredit.service.DemoScenarioCatalog.Scenario::expected).distinct().count());
        assertEquals(4, new HashSet<>(scenarios.stream().map(alfa.smartcredit.service.DemoScenarioCatalog.Scenario::login).toList()).size());
        assertEquals(4, new HashSet<>(scenarios.stream().map(alfa.smartcredit.service.DemoScenarioCatalog.Scenario::inn).toList()).size());
        for (var s : scenarios) assertEquals(s.expected(), run(s).d().status(), s.login());
    }

    @Test void ipApproved() {
        var o = byLogin("demo_ip_approved");
        assertEquals(100, o.r().internalScore());
        assertEquals(RiskClass.A, o.r().riskClass());
        assertEquals(new BigDecimal("24.75"), o.d().finalRate());
    }

    @Test void oooAlternative() {
        var o = byLogin("demo_ooo_alternative");
        assertEquals(RiskClass.A, o.r().riskClass());
        assertEquals(new BigDecimal("23.60"), o.d().finalRate()); // 23.00 + 0.10 (A) + 0.50 (строительство)
    }

    @Test void ipManualReview() {
        var o = byLogin("demo_ip_manual");
        assertEquals(42, o.r().internalScore());
        assertEquals(RiskClass.C, o.r().riskClass());
        assertEquals(DecisionStatus.MANUAL_REVIEW, o.d().status());
    }

    @Test void oooDeclinedByCompanyAge() {
        var o = byLogin("demo_ooo_declined");
        assertEquals(100, o.r().internalScore());
        assertTrue(o.d().reason().contains("1 года"));
    }

    @Test void externalDataComesFromDemoTables_notFromHash() {
        // возраст в мок-реестре согласован со сценарием (важно для карточки «возраст компании» у сотрудника)
        assertEquals(0, byLogin("demo_ooo_declined").r().external().companyAgeYears());
        assertEquals(5, byLogin("demo_ip_approved").r().external().companyAgeYears());
    }

    @Test void allFormFieldsAreFilled() throws Exception {
        for (var s : scenarios) {
            assertFalse(s.description().isBlank(), s.login());
            assertFalse(s.phone().isBlank(), s.login());
            var f = s.form();
            boolean ip = "IP".equals(s.legalForm());
            for (Object part : new Object[]{f.step1(), f.step2().financials(), f.step2().externalData(),
                    f.prefilled(), f.meta(), f.step3().consents()})
                assertAllNonNull(part, s.login());
            // у ИП нет ОГРН/КПП, у ООО нет ФИО/ОГРНИП: остальные поля анкеты обязаны быть заполнены
            var a = f.step2().applicant();
            assertNotNull(a.type()); assertNotNull(a.companyName()); assertNotNull(a.inn());
            assertNotNull(a.taxSystem()); assertNotNull(a.registrationDate()); assertNotNull(a.mainOkved());
            assertNotNull(a.industry()); assertNotNull(a.phone()); assertNotNull(a.email());
            assertNotNull(a.registrationAddress());
            if (ip) { assertNotNull(a.firstName()); assertNotNull(a.lastName()); assertNotNull(a.middleName());
                      assertNotNull(a.ogrnip()); }
            else    { assertNotNull(a.ogrn()); assertNotNull(a.kpp()); }
            // номер телефона проходит валидацию анкеты
            assertTrue(a.phone().matches("^\\+7[\\s()\\-]*(?:\\d[\\s()\\-]*){10}$"));
        }
    }

    // step1.rate заполняет бэкенд, поэтому его в проверке пропускаем
    private static void assertAllNonNull(Object record, String ctx) throws Exception {
        for (RecordComponent rc : record.getClass().getRecordComponents()) {
            if (record instanceof ApplicationFormDto.Step1 && rc.getName().equals("rate")) continue;
            assertNotNull(rc.getAccessor().invoke(record), ctx + ": " + record.getClass().getSimpleName() + "." + rc.getName());
        }
    }
}
