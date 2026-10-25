package alfa.smartcredit.service;

import alfa.smartcredit.dto.ApplicationFormDto;
import alfa.smartcredit.dto.ApplicationFormDto.*;
import alfa.smartcredit.model.enums.DecisionStatus;
import alfa.smartcredit.model.enums.RevenueTrend;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * 4 самых показательных сценария для жюри: по одному на каждый исход DecisionEngine
 * (APPROVED / ALTERNATIVE_OFFER / MANUAL_REVIEW / DECLINED), ИП и ООО поровну.
 * Все поля заполнены. Внешние данные (БКИ/ФНС/возраст) берутся из демо-таблиц ExternalDataService по ИНН.
 */
public final class DemoScenarioCatalog {
    private DemoScenarioCatalog() {}

    public static final String PASSWORD = "demo123";

    /** В каком состоянии сценарий лежит в БД к моменту демонстрации. */
    public enum Stage {
        IN_REVIEW,    // ждёт решения сотрудника банка
        OFFER_READY,  // банк одобрил, предложение ждёт принятия и подписи клиентом
        DECLINED      // банк отказал
    }

    public record Scenario(
            int order, String login, String fullName, String description, String phone, String email,
            String companyName, String inn, String okved, String legalForm,
            DecisionStatus expected, Stage stage, String officerComment, int daysAgo,
            ApplicationFormDto form) {}

    public static List<Scenario> all() {
        return List.of(
                new Scenario(1, "demo_ip_approved", "Кузнецов Дмитрий Олегович",
                        "Сценарий 1 · ИП · ОДОБРЕНО. Идеальный клиент: балл 100, класс A. "
                                + "Банк уже одобрил заявку: примите предложение и подпишите документы.",
                        "+79991110011", "kuznetsov@example.com",
                        "ИП Кузнецов Дмитрий Олегович", "772834561209", "62.01", "IP",
                        DecisionStatus.APPROVED, Stage.OFFER_READY,
                        "Одобрено на запрошенных условиях: высокий кредитный рейтинг, растущая выручка, "
                                + "низкая долговая нагрузка, просрочек нет.", 3,
                        form("IP", "ИП Кузнецов Дмитрий Олегович", "772834561209", "62.01",
                                "УСН 6%", "IT и разработка ПО",
                                "Дмитрий", "Кузнецов", "Олегович", "312774600123456", null, null,
                                "+79991110011", "kuznetsov@example.com", "г. Москва, ул. Тверская, д. 12, оф. 4",
                                "Закупка лицензий ПО и серверного оборудования для разработки",
                                "500000", 60, 12, "Оборотные средства",
                                "1000000", "10000", "0", "12000000", 4,
                                new ExternalDataOverride(800, 0, 1, RevenueTrend.GROWING, 5))),

                new Scenario(2, "demo_ooo_alternative", "Морозова Елена Викторовна",
                        "Сценарий 2 · ООО · ДРУГИЕ УСЛОВИЯ. Класс A, но долговая нагрузка выше 50%. "
                                + "Заявка ждёт сотрудника банка: войдите как сотрудник банка и предложите условия.",
                        "+79991110012", "morozova@stroyresurs.example",
                        "ООО «СтройРесурс»", "7708123456", "41.20", "OOO",
                        DecisionStatus.ALTERNATIVE_OFFER, Stage.IN_REVIEW, null, 2,
                        form("OOO", "ООО «СтройРесурс»", "7708123456", "41.20",
                                "ОСНО", "Строительство",
                                null, null, null, null, "1127746123456", "770801001",
                                "+79991110012", "morozova@stroyresurs.example", "г. Москва, ул. Строителей, д. 7",
                                "Закупка материалов под крупный строительный объект",
                                "15000000", 90, 12, "Оборотные средства",
                                "10000000", "100000", "50000", "120000000", 30,
                                new ExternalDataOverride(700, 0, 1, RevenueTrend.GROWING, 3))),

                new Scenario(3, "demo_ip_manual", "Белова Анна Сергеевна",
                        "Сценарий 3 · ИП · РУЧНАЯ ПРОВЕРКА. Пограничный случай: балл 42 (класс C), "
                                + "просрочка, падающая выручка. Решение принимает сотрудник банка.",
                        "+79991110013", "belova@example.com",
                        "ИП Белова Анна Сергеевна", "502745123876", "47.91", "IP",
                        DecisionStatus.MANUAL_REVIEW, Stage.IN_REVIEW, null, 1,
                        form("IP", "ИП Белова Анна Сергеевна", "502745123876", "47.91",
                                "УСН 6%", "Интернет-торговля",
                                "Анна", "Белова", "Сергеевна", "320502700045678", null, null,
                                "+79991110013", "belova@example.com", "г. Москва, ул. Лесная, д. 3, кв. 15",
                                "Пополнение оборотных средств интернет-магазина",
                                "100000", 30, 6, "Оборотные средства",
                                "200000", "20000", "0", "2400000", 1,
                                new ExternalDataOverride(500, 1, 4, RevenueTrend.DECLINING, 0))),

                new Scenario(4, "demo_ooo_declined", "Лебедев Артём Игоревич",
                        "Сценарий 4 · ООО · ОТКАЗ. Показатели отличные (балл 100), но компании меньше года: "
                                + "для ООО это жёсткий стоп. Видно, как банк объясняет отказ.",
                        "+79991110014", "lebedev@novasoft.example",
                        "ООО «Нова-Софт»", "7743987654", "62.01", "OOO",
                        DecisionStatus.DECLINED, Stage.DECLINED,
                        "Отказано: возраст компании меньше 1 года (жёсткое ограничение для юридических лиц). "
                                + "Рекомендуем повторно обратиться после года работы.", 4,
                        form("OOO", "ООО «Нова-Софт»", "7743987654", "62.01",
                                "УСН 15%", "IT и разработка ПО",
                                null, null, null, null, "1267700456789", "774301001",
                                "+79991110014", "lebedev@novasoft.example", "г. Москва, Ленинградский пр-т, д. 39",
                                "Расширение команды разработки и аренда офиса",
                                "500000", 60, 24, "Оборотные средства",
                                "1000000", "0", "0", "12000000", 5,
                                new ExternalDataOverride(800, 0, 1, RevenueTrend.GROWING, 0))));
    }

    private static ApplicationFormDto form(
            String legalForm, String companyName, String inn, String okved, String taxSystem, String industry,
            String firstName, String lastName, String middleName, String ogrnip, String ogrn, String kpp,
            String phone, String email, String address,
            String businessTask, String amount, int termDays, int contractTermMonths, String purpose,
            String monthlyRevenue, String debt, String other, String annualRevenue, Integer employees,
            ExternalDataOverride ext) {
        var applicant = new Applicant(legalForm, companyName, inn, taxSystem,
                firstName, lastName, middleName, ogrnip, ogrn, kpp,
                ExternalDataService.registrationDate(inn), okved, industry, phone, email, address);
        var financials = new Financials(new BigDecimal(monthlyRevenue), new BigDecimal(debt),
                new BigDecimal(annualRevenue), employees, new BigDecimal(other));
        boolean ip = "IP".equals(legalForm);
        return new ApplicationFormDto(null, Instant.now(), "SUBMITTED",
                new Step1(businessTask, new BigDecimal(amount), termDays, contractTermMonths, null, purpose),
                new Step2(applicant, financials, ext),
                new Prefilled(ip ? "EGRIP_MOCK" : "EGRUL_MOCK", Instant.now(), true),
                new Step3(new Consents(true, true, true, Instant.now())),
                new Meta("1.3", List.of("form_started", "prefill_confirmed", "consents_accepted", "submitted")));
    }
}
