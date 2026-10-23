import { useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@alfalab/core-components/button'
import { Steps } from '@alfalab/core-components/steps'
import { Typography } from '@alfalab/core-components/typography'
import { ArrowRightMIcon } from '@alfalab/icons/glyph/dist/ArrowRightMIcon'
import { ClockMIcon } from '@alfalab/icons/glyph/dist/ClockMIcon'
import { useDashboard } from '@/entities/dashboard'
import {
  applicationDecisionLabels,
  applicationStatusLabels,
  getApplicationProgress,
  useApplications,
  type ApplicationView,
} from '@/entities/loan-application'
import { AcceptOffer } from '@/features/accept-offer'
import { ApplicationForm } from '@/features/submit-loan-application'
import { ROUTES } from '@/shared/config'
import { formatDate, formatMoney } from '@/shared/lib'
import { Panel } from '@/shared/ui'
import styles from './ApplicationOverview.module.scss'

/** Selects the dashboard hero or displays a specific application in the list. */
export interface ApplicationOverviewProps {
  application?: ApplicationView
}

/** Shows server-backed application progress and strictly related offer terms. */
export function ApplicationOverview({
  application: providedApplication,
}: ApplicationOverviewProps) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const detailsButtonRef = useRef<HTMLButtonElement>(null)
  const headingId = useId()
  const navigate = useNavigate()
  const dashboard = useDashboard()
  const applications = useApplications()
  const application = providedApplication ?? dashboard.data?.currentApplication
  const applicationView =
    providedApplication ??
    applications.data?.find((item) => item.id === application?.id)
  // Company-wide dashboard offers do not identify their application.
  const offer = applicationView?.offer
  const scoring = applicationView?.scoring
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const urgentUntil = new Date(today)
  urgentUntil.setDate(urgentUntil.getDate() + 7)
  const loan = dashboard.data?.activeLoan
  const payment = dashboard.data?.nextPayment
  // LocalDate fields must be compared as local calendar dates, not UTC instants.
  const paymentIsUrgent =
    payment != null &&
    new Date(`${payment.dueDate.slice(0, 10)}T00:00:00`).getTime() <=
      urgentUntil.getTime()
  const hasPendingApplication =
    application?.status === 'IN_REVIEW' || application?.status === 'OFFER_READY'
  const showLoan =
    !providedApplication &&
    loan != null &&
    (paymentIsUrgent || !hasPendingApplication)
  const offerIsValid =
    offer?.status === 'ACTIVE' &&
    new Date(`${offer.validUntil.slice(0, 10)}T00:00:00`).getTime() >=
      today.getTime()
  const canAcceptOffer =
    application?.status === 'OFFER_READY' &&
    applicationView?.status === application.status &&
    offerIsValid &&
    (providedApplication != null || !applications.isError)

  if (
    !providedApplication &&
    (dashboard.isPending || dashboard.isError || !dashboard.data)
  ) {
    return (
      <section
        className={styles.card}
        aria-labelledby={headingId}
        aria-busy={dashboard.isPending}
      >
        <div className={styles.heading}>
          <Typography.TitleResponsive
            id={headingId}
            tag="h2"
            view="large"
            font="system"
            weight="bold"
          >
            Обзор кредита и заявки
          </Typography.TitleResponsive>
        </div>
        <div
          className={styles.progress}
          role={dashboard.isError ? 'alert' : 'status'}
        >
          <Typography.Text tag="p" color="secondary">
            {dashboard.isError ? dashboard.error.message : 'Загружаем данные…'}
          </Typography.Text>
        </div>
        {dashboard.isError && (
          <div className={styles.bottomline}>
            <Button
              view="secondary"
              size={48}
              onClick={() => {
                void dashboard.refetch()
              }}
            >
              Повторить загрузку
            </Button>
          </div>
        )}
      </section>
    )
  }

  if (showLoan && loan) {
    return (
      <>
        <section className={styles.card} aria-labelledby={headingId}>
          <div className={styles.topline}>
            <Typography.Text view="primary-small" weight="medium">
              Действующий кредит
            </Typography.Text>
            <Typography.Text view="secondary-large" color="secondary">
              № {loan.id}
            </Typography.Text>
          </div>
          <div className={styles.heading}>
            <Typography.TitleResponsive
              id={headingId}
              tag="h2"
              view="large"
              font="system"
              weight="bold"
            >
              Остаток долга{' '}
              <span className={styles.amount}>
                {formatMoney(loan.remainingBalance)}
              </span>
            </Typography.TitleResponsive>
            <Typography.Text tag="p" color="secondary">
              Ставка {loan.ratePercent}% годовых · Срок: {loan.termMonths} мес.
            </Typography.Text>
          </div>
          <div className={styles.progress}>
            <dl className={styles.parameters}>
              <div>
                <dt>Сумма кредита</dt>
                <dd>{formatMoney(loan.principal)}</dd>
              </div>
              <div>
                <dt>Ежемесячный платёж</dt>
                <dd>{formatMoney(loan.monthlyPayment)}</dd>
              </div>
              {payment && (
                <>
                  <div>
                    <dt>Ближайший платёж</dt>
                    <dd>{formatMoney(payment.amount)}</dd>
                  </div>
                  <div>
                    <dt>Дата платежа</dt>
                    <dd>{formatDate(payment.dueDate)}</dd>
                  </div>
                </>
              )}
            </dl>
            {!payment && (
              <Typography.Text tag="p" color="secondary">
                Ближайший платёж не указан.
              </Typography.Text>
            )}
          </div>
          <div className={styles.bottomline}>
            <Typography.Text view="primary-small" color="secondary">
              {paymentIsUrgent
                ? payment && new Date(`${payment.dueDate}T00:00:00`) < today
                  ? 'Дата платежа прошла. Проверьте исполнение обязательства.'
                  : 'Платёж по кредиту в ближайшие 7 дней. Проверьте готовность к оплате.'
                : 'Сведения о действующем кредите.'}
            </Typography.Text>
            <Button
              view="primary"
              size={48}
              className={styles.detailsButton}
              rightAddons={<ArrowRightMIcon aria-hidden="true" />}
              onClick={() => {
                void navigate(ROUTES.credits)
              }}
            >
              К кредитам
            </Button>
          </div>
        </section>
        <ApplicationForm resumeOnly />
      </>
    )
  }

  if (!application) {
    return <ApplicationForm headingTag="h2" />
  }

  const finalRate = offer?.finalRate ?? application.finalRate
  const stages = getApplicationProgress(application.status)
  const activeStep = stages.findIndex((stage) => stage.state === 'CURRENT') + 1
  const declined = application.status === 'DECLINED'
  const checkIsStepError = (step: number) =>
    declined && stages[step - 1]?.code === 'DECISION'
  const steps = stages.map((step) => (
    <Typography.Text
      key={step.code}
      view="primary-small"
      weight={step.state === 'CURRENT' ? 'medium' : 'regular'}
      color={step.state === 'PENDING' ? 'secondary' : 'primary'}
      aria-current={step.state === 'CURRENT' ? 'step' : undefined}
    >
      {step.title}
    </Typography.Text>
  ))
  // The kit keeps step buttons focusable in read-only mode; expose a semantic list instead.
  const progressDescription = (
    <ol className={styles.screenReaderOnly} aria-label="Ход заявки">
      {stages.map((step) => (
        <li
          key={step.code}
          aria-current={step.state === 'CURRENT' ? 'step' : undefined}
        >
          {step.title}:{' '}
          {declined && step.state === 'CURRENT'
            ? 'отказ по заявке'
            : declined && step.state === 'PENDING'
              ? 'не выполняется: заявка отклонена'
              : step.state === 'DONE'
                ? 'завершено'
                : step.state === 'CURRENT'
                  ? step.code === 'ISSUED'
                    ? 'ожидает выдачи'
                    : 'текущий этап'
                  : 'предстоит'}
        </li>
      ))}
    </ol>
  )
  const offerParameters = offer && (
    <dl className={styles.parameters}>
      <div>
        <dt>Предложенная сумма</dt>
        <dd>{formatMoney(offer.amount)}</dd>
      </div>
      {offer.amount !== application.amount && (
        <div>
          <dt>Разница с запросом</dt>
          <dd>
            {offer.amount < application.amount ? 'Меньше на ' : 'Больше на '}
            {formatMoney(Math.abs(offer.amount - application.amount))}
          </dd>
        </div>
      )}
      <div>
        <dt>Предложенный срок</dt>
        <dd>{offer.termDays} дней</dd>
      </div>
      <div>
        <dt>Итоговая ставка</dt>
        <dd>{offer.finalRate}% годовых</dd>
      </div>
      <div>
        <dt>Ежемесячный платёж</dt>
        <dd>{formatMoney(offer.monthlyPayment)}</dd>
      </div>
      <div>
        <dt>Предложение действительно до</dt>
        <dd>{formatDate(offer.validUntil)}</dd>
      </div>
    </dl>
  )
  const statusMessage = {
    IN_REVIEW: {
      title: 'Заявка на рассмотрении у кредитного специалиста',
      description:
        'Кредитный специалист рассматривает заявку. Действий от вас сейчас не требуется. Решение появится здесь после рассмотрения.',
    },
    OFFER_READY: {
      title:
        application.decision === 'ALTERNATIVE_OFFER' ||
        (offer &&
          (offer.amount !== application.amount ||
            offer.termDays !== application.termDays))
          ? 'Банк предложил другие условия'
          : 'Банк подготовил предложение',
      description: canAcceptOffer
        ? 'Сравните запрошенные и предложенные условия. Выберите предложение банка в подробностях заявки, затем подтвердите подписание.'
        : 'Принятие предложения недоступно. Проверьте его условия и статус в подробностях заявки.',
    },
    DECLINED: {
      title: 'В заявке отказано',
      description:
        !providedApplication && applications.isError
          ? applications.error.message
          : !providedApplication && applications.isPending
            ? 'Загружаем причину отказа…'
            : applicationView?.officerComment?.trim() ||
              applicationView?.aiComment?.trim() ||
              'Причина отказа не указана.',
    },
    ACCEPTED: {
      title: 'Предложение принято',
      description: 'Ожидаем подтверждения выдачи. Деньги еще не зачислены.',
    },
  }[application.status]
  const offerState =
    !providedApplication && applications.isError
      ? applications.error.message
      : !providedApplication && applications.isPending
        ? 'Загружаем условия предложения…'
        : !offer
          ? 'Предложение для этой заявки пока недоступно.'
          : offer.status === 'EXPIRED' ||
              (offer.status === 'ACTIVE' && !offerIsValid)
            ? 'Срок действия предложения истёк. Подписание недоступно.'
            : offer.status === 'ACCEPTED'
              ? 'Предложение уже принято. Повторное подписание недоступно.'
              : !canAcceptOffer
                ? 'Статус заявки обновляется. Подписание пока недоступно.'
                : null

  return (
    <>
      <section className={styles.card} aria-labelledby={headingId}>
        <div className={styles.topline}>
          <span
            className={`${styles.status}${declined ? ` ${styles.declined}` : ''}`}
          >
            {application.status === 'IN_REVIEW' && (
              <ClockMIcon aria-hidden="true" />
            )}
            <Typography.Text view="primary-small" weight="medium">
              {applicationStatusLabels[application.status]}
            </Typography.Text>
          </span>
          <Typography.Text view="secondary-large" color="secondary">
            № {application.id}
          </Typography.Text>
        </div>
        <div className={styles.heading}>
          <Typography.TitleResponsive
            id={headingId}
            tag="h2"
            view="large"
            font="system"
            weight="bold"
          >
            {application.status === 'OFFER_READY'
              ? 'Запрошено: '
              : 'Заявка на '}
            <span className={styles.amount}>
              {formatMoney(application.amount)}
            </span>
          </Typography.TitleResponsive>
          <Typography.Text tag="p" color="secondary">
            Запрошенный срок: {application.termDays} дней
            {application.purpose && ` · ${application.purpose}`}
          </Typography.Text>
        </div>

        {application.status === 'OFFER_READY' && (
          <div className={styles.progress}>
            {offerParameters}
            {offerState && (
              <Typography.Text
                tag="p"
                view="primary-small"
                color="secondary"
                role={
                  !providedApplication && applications.isError
                    ? 'alert'
                    : 'status'
                }
              >
                {offerState}
              </Typography.Text>
            )}
          </div>
        )}
        <div className={styles.progress} aria-label="Этапы рассмотрения заявки">
          {progressDescription}
          <div className={styles.desktopSteps} inert aria-hidden="true">
            <Steps
              activeStep={activeStep}
              isMarkCompletedSteps={false}
              checkIsStepPositive={(step) => stages[step - 1]?.state === 'DONE'}
              checkIsStepError={checkIsStepError}
              ordered
              interactive={false}
              className={styles.steps}
              minSpaceBetweenSteps={16}
            >
              {steps}
            </Steps>
          </div>
          <div className={styles.mobileSteps} inert aria-hidden="true">
            <Typography.Text view="secondary-medium" color="secondary">
              {`Этап ${activeStep} из ${stages.length} · ${stages[activeStep - 1].title}${declined ? ' · Отказ' : ''}`}
            </Typography.Text>
            <Steps
              activeStep={activeStep}
              isMarkCompletedSteps={false}
              checkIsStepPositive={(step) => stages[step - 1]?.state === 'DONE'}
              checkIsStepError={checkIsStepError}
              ordered
              interactive={false}
              className={styles.steps}
              minSpaceBetweenSteps={16}
            >
              {stages.map((step) => (
                <span key={step.code} />
              ))}
            </Steps>
          </div>
        </div>

        <div className={styles.bottomline}>
          <div className={styles.nextStep}>
            <div className={styles.nextStepText}>
              <Typography.Text view="primary-small" weight="medium">
                {statusMessage.title}
              </Typography.Text>
              <Typography.Text view="primary-small" color="secondary">
                {statusMessage.description}
              </Typography.Text>
            </div>
          </div>
          <Button
            view="primary"
            size={48}
            className={styles.detailsButton}
            rightAddons={<ArrowRightMIcon aria-hidden="true" />}
            onClick={() => setDetailsOpen(true)}
            ref={detailsButtonRef}
          >
            Подробнее о заявке
          </Button>
        </div>
      </section>
      {!providedApplication && <ApplicationForm resumeOnly />}

      <Panel
        open={detailsOpen}
        returnFocusRef={detailsButtonRef}
        title={`Заявка № ${application.id}`}
        onClose={() => setDetailsOpen(false)}
        footer={
          application.status !== 'OFFER_READY' ? (
            <Button
              view="secondary"
              block
              onClick={() => {
                setDetailsOpen(false)
                void navigate(ROUTES.documents)
              }}
            >
              Документы по заявке
            </Button>
          ) : undefined
        }
      >
        <div className={styles.details}>
          <Typography.TitleResponsive tag="h2" view="medium" font="system">
            Запрошено: {formatMoney(application.amount)}
          </Typography.TitleResponsive>
          <dl className={styles.parameters}>
            <div>
              <dt>Цель</dt>
              <dd>{application.purpose || 'Не указана'}</dd>
            </div>
            <div>
              <dt>Запрошенный срок</dt>
              <dd>{application.termDays} дней</dd>
            </div>
            <div>
              <dt>Базовая ставка</dt>
              <dd>
                {application.rate == null
                  ? 'Не указана'
                  : `${application.rate}% годовых`}
              </dd>
            </div>
            <div>
              <dt>Итоговая ставка</dt>
              <dd>
                {finalRate == null ? 'Не определена' : `${finalRate}% годовых`}
              </dd>
            </div>
            <div>
              <dt>Заявка отправлена</dt>
              <dd>{formatDate(application.createdAt)}</dd>
            </div>
            <div>
              <dt>Текущий этап</dt>
              <dd>{applicationStatusLabels[application.status]}</dd>
            </div>
            <div>
              <dt>Решение</dt>
              <dd>
                {application.decision
                  ? applicationDecisionLabels[application.decision]
                  : 'Не указано'}
              </dd>
            </div>
            {applicationView && (
              <>
                <div>
                  <dt>Скоринговый балл</dt>
                  <dd>
                    {applicationView.internalScore == null
                      ? 'Нет оценки'
                      : `${applicationView.internalScore} / 100`}
                  </dd>
                </div>
                <div>
                  <dt>Класс риска</dt>
                  <dd>{applicationView.riskClass ?? 'Нет оценки'}</dd>
                </div>
              </>
            )}
          </dl>
          {scoring && (
            <>
              <Typography.TitleResponsive tag="h3" view="small" font="system">
                Показатели скоринга
              </Typography.TitleResponsive>
              <dl className={styles.parameters}>
                <div>
                  <dt>Долговая нагрузка (DTI)</dt>
                  <dd>{scoring.dtiPercent}%</dd>
                </div>
                <div>
                  <dt>Сумма / годовая выручка</dt>
                  <dd>{scoring.amountToRevenue}</dd>
                </div>
                <div>
                  <dt>Расчётный платёж по базовой ставке</dt>
                  <dd>
                    {scoring.newMonthlyPayment == null
                      ? 'Нет расчёта'
                      : formatMoney(scoring.newMonthlyPayment)}
                  </dd>
                </div>
                <div>
                  <dt>Расчётный лимит</dt>
                  <dd>
                    {scoring.calculatedLimit == null
                      ? 'Нет расчёта'
                      : formatMoney(scoring.calculatedLimit)}
                  </dd>
                </div>
              </dl>
              <Typography.Text tag="p" color="secondary">
                Скоринг рассчитан сервером для исходной заявки по базовой ставке.
                Условия предложения указаны отдельно.
              </Typography.Text>
            </>
          )}
          {progressDescription}
          <div inert aria-hidden="true">
            <Steps
              activeStep={activeStep}
              isMarkCompletedSteps={false}
              checkIsStepPositive={(step) => stages[step - 1]?.state === 'DONE'}
              checkIsStepError={checkIsStepError}
              ordered
              interactive={false}
              isVerticalAlign
            >
              {steps}
            </Steps>
          </div>
          <div className={styles.notice}>
            <Typography.Text tag="p" view="primary-small">
              {statusMessage.description}
            </Typography.Text>
          </div>
          {application.status === 'DECLINED' &&
            !providedApplication &&
            applications.isError && (
              <Button
                view="secondary"
                onClick={() => {
                  void applications.refetch()
                }}
              >
                Повторить загрузку комментария
              </Button>
            )}
          {application.status === 'OFFER_READY' && (
            <>
              <Typography.TitleResponsive tag="h3" view="small" font="system">
                Предложение банка
              </Typography.TitleResponsive>
              {offerParameters}
              {offer && offer.termDays !== application.termDays && (
                <Typography.Text tag="p" color="secondary">
                  Срок изменен с {application.termDays} до {offer.termDays}{' '}
                  дней. Платеж по новым условиям указан выше. Полная стоимость
                  кредита не указана.
                </Typography.Text>
              )}
              {offerState && (
                <Typography.Text
                  tag="p"
                  color="secondary"
                  role={
                    !providedApplication && applications.isError
                      ? 'alert'
                      : 'status'
                  }
                >
                  {offerState}
                </Typography.Text>
              )}
              {!providedApplication && applications.isError && (
                <Button
                  view="secondary"
                  onClick={() => {
                    void applications.refetch()
                  }}
                >
                  Повторить загрузку условий
                </Button>
              )}
              {detailsOpen && canAcceptOffer && offer && (
                <AcceptOffer
                  key={`${application.id}-${offer.id}`}
                  offer={offer}
                  application={application}
                />
              )}
            </>
          )}
        </div>
      </Panel>
    </>
  )
}
