package alfa.smartcredit.service;

import alfa.smartcredit.dto.ContractView;
import alfa.smartcredit.dto.TrancheRequest;
import alfa.smartcredit.dto.TrancheView;
import alfa.smartcredit.event.ApplicationStatusChangedEvent;
import alfa.smartcredit.exception.ApiException;
import alfa.smartcredit.model.Company;
import alfa.smartcredit.model.CreditApplication;
import alfa.smartcredit.model.Offer;
import alfa.smartcredit.model.Tranche;
import alfa.smartcredit.model.enums.TrancheStatus;
import alfa.smartcredit.repository.CompanyRepository;
import alfa.smartcredit.repository.CreditApplicationRepository;
import alfa.smartcredit.repository.OfferRepository;
import alfa.smartcredit.repository.TrancheRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Договор овердрафта на 6/12/24 месяца и транши внутри него.
 * Договор = подписанная оферта: лимит = offers.amount, срок = offers.contract_term_months.
 * Клиент берёт несколько траншей на 30/60/90 дней на любую сумму, пока не исчерпан лимит.
 */
@Service
@RequiredArgsConstructor
public class ContractService {

    private final OfferRepository offerRepository;
    private final TrancheRepository trancheRepository;
    private final CreditApplicationRepository applicationRepository;
    private final CompanyRepository companyRepository;
    private final ApplicationEventPublisher eventPublisher;

    // ---------------------------------------------------------------- чтение

    @Transactional(readOnly = true)
    public List<ContractView> list(Long companyId) {
        Company company = companyRepository.findById(companyId).orElseThrow(ApiException::unauthorized);
        return offerRepository.findByCompanyIdOrderByIdDesc(companyId).stream()
                .filter(ContractService::isSigned)
                .map(o -> toView(o, company))
                .toList();
    }

    /** Последний действующий (не истёкший) договор или null. */
    @Transactional(readOnly = true)
    public ContractView findActive(Long companyId) {
        return list(companyId).stream()
                .filter(c -> "ACTIVE".equals(c.status()))
                .findFirst().orElse(null);
    }

    @Transactional(readOnly = true)
    public ContractView get(Long companyId, Long contractId) {
        Company company = companyRepository.findById(companyId).orElseThrow(ApiException::unauthorized);
        Offer o = offerRepository.findById(contractId)
                .orElseThrow(() -> ApiException.notFound("Договор не найден"));
        if (!o.getCompanyId().equals(companyId)) throw ApiException.forbidden();
        if (!isSigned(o)) throw ApiException.notFound("Договор не найден или ещё не подписан");
        return toView(o, company);
    }

    // ---------------------------------------------------------------- получение транша

    @Transactional
    public TrancheView issue(Long companyId, Long contractId, TrancheRequest req) {
        // Блокировка договора: два параллельных запроса не смогут вместе превысить лимит.
        Offer o = offerRepository.findForUpdate(contractId)
                .orElseThrow(() -> ApiException.notFound("Договор не найден"));
        if (!o.getCompanyId().equals(companyId)) throw ApiException.forbidden();
        if (!isSigned(o))
            throw new ApiException(HttpStatus.CONFLICT, "CONTRACT_NOT_ACTIVE",
                    "Договор ещё не подписан: транши доступны после подписания документов");

        Company company = companyRepository.findById(companyId).orElseThrow(ApiException::unauthorized);
        CreditApplication app = applicationRepository.findById(o.getApplicationId())
                .orElseThrow(() -> ApiException.notFound("Заявка не найдена"));
        LocalDate today = LocalDate.now();
        List<Tranche> existing = trancheRepository.findByOfferIdOrderByIdDesc(o.getId());

        if (today.isAfter(o.getContractEnd()))
            throw new ApiException(HttpStatus.CONFLICT, "CONTRACT_EXPIRED",
                    "Срок договора истёк " + o.getContractEnd() + ": новые транши недоступны");
        if (hasOverdue(existing, today))
            throw new ApiException(HttpStatus.CONFLICT, "HAS_OVERDUE_TRANCHE",
                    "Есть просроченный транш. Погасите его, чтобы получить новый");

        BigDecimal amount = req.amount().setScale(2, RoundingMode.HALF_UP);
        if (amount.compareTo(ProductRules.MIN_TRANCHE_AMOUNT) < 0)
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "TRANCHE_AMOUNT_TOO_SMALL",
                    "Минимальная сумма транша " + money(ProductRules.MIN_TRANCHE_AMOUNT));

        BigDecimal available = availableLimit(o, existing);
        if (amount.compareTo(available) > 0)
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "LIMIT_EXCEEDED",
                    "Сумма транша больше доступного лимита. Доступно: " + money(available));

        LocalDate due = today.plusDays(req.termDays());
        if (due.isAfter(o.getContractEnd()))
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "TRANCHE_EXCEEDS_CONTRACT",
                    "Транш на " + req.termDays() + " дн. закончился бы " + due
                            + ", уже после окончания договора (" + o.getContractEnd() + "). Выберите меньший срок");

        BigDecimal rate = trancheRate(o, app, company, req.termDays());
        if (rate == null)
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "RATE_UNAVAILABLE",
                    "Не удалось определить ставку транша для выбранного срока");

        Tranche t = new Tranche();
        t.setCompanyId(companyId);
        t.setOfferId(o.getId());
        t.setApplicationId(o.getApplicationId());
        t.setAmount(amount);
        t.setTermDays(req.termDays());
        t.setRatePercent(rate);
        t.setIssuedAt(today);
        t.setDueDate(due);
        t.setStatus(TrancheStatus.ACTIVE);
        t = trancheRepository.save(t);

        BigDecimal left = available.subtract(amount);
        eventPublisher.publishEvent(new ApplicationStatusChangedEvent(
                companyId, o.getApplicationId(), "TRANCHE_ISSUED",
                String.format("Овердрафт №%d: %s на %d дн. под %s%%. Погасить до %s. Остаток лимита: %s.",
                        t.getId(), money(amount), req.termDays(), pct(rate), due, money(left))));
        return toTrancheView(t, today);
    }

    // ---------------------------------------------------------------- погашение

    /** Полное погашение транша: основной долг + проценты за фактическое число дней пользования. */
    @Transactional
    public TrancheView repay(Long companyId, Long trancheId) {
        Tranche t = trancheRepository.findForUpdate(trancheId)
                .orElseThrow(() -> ApiException.notFound("Транш не найден"));
        if (!t.getCompanyId().equals(companyId)) throw ApiException.forbidden();

        LocalDate today = LocalDate.now();
        if (t.getStatus() == TrancheStatus.REPAID) return toTrancheView(t, today);   // идемпотентно

        BigDecimal interest = interest(t, today);
        t.setStatus(TrancheStatus.REPAID);
        t.setRepaidAt(today);
        t.setInterestPaid(interest);

        eventPublisher.publishEvent(new ApplicationStatusChangedEvent(
                companyId, t.getApplicationId(), "TRANCHE_REPAID",
                String.format("Овердрафт №%d погашен: %s (проценты %s).",
                        t.getId(), money(t.getAmount().add(interest)), money(interest))));
        return toTrancheView(t, today);
    }

    // ---------------------------------------------------------------- расчёты (используются и дашбордом)

    public static boolean isSigned(Offer o) {
        return o.getSignedAt() != null && o.getContractTermMonths() != null
                && o.getContractStart() != null && o.getContractEnd() != null;
    }

    /** Использованный лимит: нарастающим итогом (по умолчанию) либо только открытые транши (revolving). */
    public static BigDecimal usedLimit(List<Tranche> tranches) {
        return tranches.stream()
                .filter(t -> !ProductRules.LIMIT_REVOLVING || t.getStatus() == TrancheStatus.ACTIVE)
                .map(Tranche::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    public static BigDecimal availableLimit(Offer o, List<Tranche> tranches) {
        return o.getAmount().subtract(usedLimit(tranches)).max(BigDecimal.ZERO);
    }

    public static boolean hasOverdue(List<Tranche> tranches, LocalDate today) {
        return tranches.stream().anyMatch(t -> isOverdue(t, today));
    }

    private static boolean isOverdue(Tranche t, LocalDate today) {
        return t.getStatus() == TrancheStatus.ACTIVE && t.getDueDate().isBefore(today);
    }

    /** Ставка транша = базовая ставка на выбранный срок + надбавка договора (класс риска, отрасль, решение сотрудника). */
    public BigDecimal trancheRate(Offer o, CreditApplication app, Company company, int termDays) {
        BigDecimal base = ProductRules.baseRate(company.getLegalForm(), app.getBusinessScale(), termDays);
        if (base == null) return null;
        BigDecimal spread = o.getRateSpread() == null ? BigDecimal.ZERO : o.getRateSpread();
        return base.add(spread).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
    }

    /** Проценты = сумма * ставка% * дней / 365; дней - фактически, минимум 1 (просрочка тоже начисляется по ставке). */
    private static BigDecimal interest(Tranche t, LocalDate asOf) {
        long days = Math.max(1, ChronoUnit.DAYS.between(t.getIssuedAt(), asOf));
        return t.getAmount().multiply(t.getRatePercent()).multiply(BigDecimal.valueOf(days))
                .divide(BigDecimal.valueOf(100L * ProductRules.DAYS_IN_YEAR), 2, RoundingMode.HALF_UP);
    }

    // ---------------------------------------------------------------- маппинг

    ContractView toView(Offer o, Company company) {
        CreditApplication app = applicationRepository.findById(o.getApplicationId()).orElseThrow();
        List<Tranche> tranches = trancheRepository.findByOfferIdOrderByIdDesc(o.getId());
        LocalDate today = LocalDate.now();

        BigDecimal used = usedLimit(tranches);
        BigDecimal available = availableLimit(o, tranches);
        BigDecimal outstanding = tranches.stream()
                .filter(t -> t.getStatus() == TrancheStatus.ACTIVE)
                .map(Tranche::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);

        List<ContractView.TermOption> terms = new ArrayList<>();
        for (int d : ProductRules.TERM_DAYS.stream().sorted().toList()) {
            LocalDate due = today.plusDays(d);
            terms.add(new ContractView.TermOption(d, trancheRate(o, app, company, d), due,
                    !due.isAfter(o.getContractEnd())));
        }

        boolean expired = today.isAfter(o.getContractEnd());
        String blocked;
        if (expired) blocked = "CONTRACT_EXPIRED";
        else if (hasOverdue(tranches, today)) blocked = "HAS_OVERDUE_TRANCHE";
        else if (available.compareTo(ProductRules.MIN_TRANCHE_AMOUNT) < 0) blocked = "LIMIT_EXHAUSTED";
        else if (terms.stream().noneMatch(ContractView.TermOption::available)) blocked = "CONTRACT_ENDING";
        else blocked = null;

        return new ContractView(o.getId(), o.getApplicationId(), expired ? "EXPIRED" : "ACTIVE",
                o.getContractTermMonths(), o.getContractStart(), o.getContractEnd(),
                o.getAmount(), used, available, ProductRules.LIMIT_REVOLVING, outstanding,
                ProductRules.MIN_TRANCHE_AMOUNT, blocked == null, blocked, terms,
                tranches.stream().map(t -> toTrancheView(t, today)).toList());
    }

    private TrancheView toTrancheView(Tranche t, LocalDate today) {
        boolean repaid = t.getStatus() == TrancheStatus.REPAID;
        BigDecimal interest = repaid ? t.getInterestPaid() : interest(t, today);
        String status = repaid ? "REPAID" : isOverdue(t, today) ? "OVERDUE" : "ACTIVE";
        return new TrancheView(t.getId(), t.getOfferId(), t.getAmount(), t.getTermDays(), t.getRatePercent(),
                t.getIssuedAt(), t.getDueDate(), status, interest, t.getAmount().add(interest), t.getRepaidAt());
    }

    private static String money(BigDecimal v) {
        return String.format(Locale.forLanguageTag("ru-RU"), "%,.2f ₽", v);
    }

    private static String pct(BigDecimal v) {
        return v.setScale(2, RoundingMode.HALF_UP).toPlainString();
    }
}
