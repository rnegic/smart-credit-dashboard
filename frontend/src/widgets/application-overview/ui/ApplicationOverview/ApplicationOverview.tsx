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
  businessScaleLabels,
  getApplicationProgress,
  getApplicationPurposeLabel,
  useApplications,
  type Application,
  type ApplicationView,
} from '@/entities/loan-application'
import { AcceptOffer } from '@/features/accept-offer'
import { ApplicationForm } from '@/features/submit-loan-application'
import { ROUTES } from '@/shared/config'
import { useApiScope } from '@/shared/api'
import { formatDate, formatMoney } from '@/shared/lib'
import { Panel, Skeleton } from '@/shared/ui'
import styles from './ApplicationOverview.module.scss'

const skeletonRows = [0, 1, 2, 3]

/** Selects the dashboard hero or displays a specific application in the list. */
export interface ApplicationOverviewProps {
  application?: ApplicationView
}

function ApplicationOverviewSkeleton() {
  const headingId = useId()

  return (
    <section
      className={styles.card}
      aria-labelledby={headingId}
      aria-busy="true"
    >
      <div className={styles.topline}>
        <Skeleton
          width="7.5rem"
          height="1.75rem"
          radius="var(--border-radius-pill)"
        />
        <Skeleton width="3.5rem" height="1rem" />
      </div>
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
        <Skeleton width="min(100%, 24rem)" height="2.25rem" />
        <Skeleton width="min(70%, 18rem)" height="1rem" />
      </div>
      <div className={styles.skeletonBody}>
        <div className={styles.skeletonSteps}>
          {skeletonRows.map((row) => (
            <div className={styles.skeletonStep} key={row}>
              <Skeleton width="1.5rem" height="1.5rem" radius="50%" />
              <Skeleton width="100%" height="0.75rem" />
            </div>
          ))}
        </div>
        <div className={styles.skeletonParameters}>
          {skeletonRows.map((row) => (
            <div className={styles.skeletonParameter} key={row}>
              <Skeleton width="55%" height="0.875rem" />
              <Skeleton width="30%" height="0.875rem" />
            </div>
          ))}
        </div>
      </div>
      <div className={styles.bottomline}>
        <Skeleton width="min(60%, 18rem)" height="1rem" />
        <Skeleton
          width="8.5rem"
          height="3rem"
          radius="var(--border-radius-12)"
        />
      </div>
      <span className={styles.screenReaderOnly} role="status">
        Загружаем данные…
      </span>
    </section>
  )
}

/** Shows server-backed application progress and strictly related offer terms. */
export function ApplicationOverview({
  application: providedApplication,
}: ApplicationOverviewProps) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [selectedApplication, setSelectedApplication] =
    useState<Application | null>(null)
  const detailsButtonRef = useRef<HTMLButtonElement>(null)
  const headingId = useId()
  const navigate = useNavigate()
  const dashboard = useDashboard()
  const applications = useApplications()
  const scope = useApiScope()
  const currentApplication =
    providedApplication ?? dashboard.data?.currentApplication
  const applicationId =
    detailsOpen && selectedApplication
      ? selectedApplication.id
      : currentApplication?.id
  const applicationView =
    (providedApplication?.id === applicationId
      ? providedApplication
      : undefined) ??
    applications.data?.find((item) => item.id === applicationId)
  const application =
    applicationView ?? (detailsOpen ? selectedApplication : currentApplication)
  // Company-wide dashboard offers do not identify their application.
  const offer = applicationView?.offer
  const scoring = applicationView?.scoring
  const isOoo = applicationView?.legalForm === 'OOO'
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
    !detailsOpen &&
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

  if (!providedApplication && !detailsOpen) {
    if (dashboard.isError) {
      return (
        <section className={styles.card} aria-labelledby={headingId}>
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
          <div className={styles.progress} role="alert">
            <Typography.Text tag="p" color="secondary">
              {dashboard.error.message}
            </Typography.Text>
          </div>
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
        </section>
      )
    }

    if (dashboard.isPending || !dashboard.data) {
      return <ApplicationOverviewSkeleton />
    }
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
              ref={detailsButtonRef}
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

  const awaitingClientChoice = application.status === 'OFFER_READY'
  const officerComment = applicationView?.officerComment?.trim()
  const officerCommentNotice = officerComment && (
    <div className={`${styles.notice} ${styles.officerComment}`}>
      <p>
        <strong>Комментарий кредитного специалиста</strong>
      </p>
      <p>{officerComment}</p>
    </div>
  )
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
      {awaitingClientChoice && step.code === 'DECISION' ? (
        <span className={styles.pendingChoice}>
          {step.title}
          <span className={styles.choiceHint}>Ожидает выбора</span>
        </span>
      ) : (
        step.title
      )}
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
                  ? awaitingClientChoice
                    ? 'ожидает вашего выбора'
                    : step.code === 'ISSUED'
                      ? 'ожидает выдачи'
                      : 'текущий этап'
                  : 'предстоит'}
        </li>
      ))}
    </ol>
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
        ? 'Ожидаем вашего выбора. Рассмотрите условия предложения перед подписанием.'
        : 'Принятие предложения недоступно. Проверьте его условия и статус.',
    },
    DECLINED: {
      title: 'В заявке отказано',
      description: officerComment
        ? 'Причина отказа указана в комментарии кредитного специалиста.'
        : !providedApplication && applications.isError
          ? applications.error.message
          : !providedApplication && applications.isPending
            ? 'Загружаем комментарий кредитного специалиста…'
            : 'Комментарий кредитного специалиста пока не указан.',
    },
    ACCEPTED: {
      title: 'Условия приняты',
      description: 'Ожидаем подтверждения выдачи. Деньги ещё не зачислены.',
    },
  }[application.status]
  const offerState =
    !providedApplication && applications.isError
      ? applications.error.message
      : !providedApplication && applications.isPending
        ? 'Загружаем условия предложения…'
        : !offer
          ? 'Условия предложения пока недоступны'
          : offer.status === 'EXPIRED' ||
              (offer.status === 'ACTIVE' && !offerIsValid)
            ? 'Срок действия предложения истёк. Подписание недоступно.'
            : offer.status === 'ACCEPTED'
              ? 'Предложение уже принято. Повторное подписание недоступно.'
              : !canAcceptOffer
                ? 'Статус заявки обновляется. Подписание пока недоступно.'
                : null

  const offerExperience =
    awaitingClientChoice ||
    application.status === 'ACCEPTED' ||
    (detailsOpen &&
      (selectedApplication?.status === 'OFFER_READY' ||
        selectedApplication?.status === 'ACCEPTED'))
  const applicationDetails = (
    <div className={styles.details}>
      <Typography.TitleResponsive tag="h2" view="medium" font="system">
        Запрошено: {formatMoney(application.amount)}
      </Typography.TitleResponsive>
      {!offerExperience && officerCommentNotice}
      <dl className={styles.parameters}>
        <div>
          <dt>Дата создания заявки</dt>
          <dd>
            <time dateTime={application.createdAt}>
              {formatDate(application.createdAt)}
            </time>
          </dd>
        </div>
        <div>
          <dt>Цель</dt>
          <dd>{getApplicationPurposeLabel(application.purpose)}</dd>
        </div>
        <div>
          <dt>Запрошенный срок</dt>
          <dd>{application.termDays} дней</dd>
        </div>
        <div>
          <dt>Статус заявки</dt>
          <dd>{applicationStatusLabels[application.status]}</dd>
        </div>
        <div>
          <dt>Решение банка</dt>
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
      {isOoo && (
        <div className={styles.notice}>
          <dl className={styles.parameters}>
            <div>
              <dt>Масштаб бизнеса по расчету банка</dt>
              <dd>
                {scoring?.businessScale
                  ? businessScaleLabels[scoring.businessScale]
                  : 'Банк пока не передал расчет'}
              </dd>
            </div>
          </dl>
          <Typography.Text tag="p" view="primary-small" color="secondary">
            Масштаб не является классом риска. Итоговые условия определяет банк в
            предложении.
          </Typography.Text>
        </div>
      )}
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
              <dt>Платёж скоринга по базовой ставке</dt>
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
            Скоринг рассчитан сервером для исходной заявки по базовой ставке,
            а не по ставке предложения. Условия предложения указаны отдельно.
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
    </div>
  )

  return (
    <>
      <section
        className={`${styles.card} ${awaitingClientChoice ? styles.offerCard : ''}`}
        aria-labelledby={headingId}
      >
        <div className={styles.topline}>
          <div className={styles.statusLine}>
            <span
              className={`${styles.status}${
                declined
                  ? ` ${styles.declined}`
                  : awaitingClientChoice
                    ? ` ${styles.warning}`
                    : ''
              }`}
            >
              {application.status === 'IN_REVIEW' && (
                <ClockMIcon aria-hidden="true" />
              )}
              <Typography.Text view="primary-small" weight="medium">
                {awaitingClientChoice
                  ? 'Предложение готово'
                  : applicationStatusLabels[application.status]}
              </Typography.Text>
            </span>
            {awaitingClientChoice && (
              <Typography.Text view="primary-small" color="secondary">
                Ждёт вашего решения
              </Typography.Text>
            )}
          </div>
          <Typography.Text view="secondary-large" color="secondary">
            № {application.id}
          </Typography.Text>
        </div>
        <div className={awaitingClientChoice ? styles.offerMain : undefined}>
          <div className={styles.heading}>
            <Typography.TitleResponsive
              id={headingId}
              tag="h2"
              view="large"
              font="system"
              weight="bold"
            >
              {awaitingClientChoice ? (
                'Ваш следующий шаг для бизнеса'
              ) : (
                <>
                  Заявка на{' '}
                  <span className={styles.amount}>
                    {formatMoney(application.amount)}
                  </span>
                </>
              )}
            </Typography.TitleResponsive>
            {awaitingClientChoice ? (
              <Typography.Text tag="p" color="secondary">
                Цель: {getApplicationPurposeLabel(application.purpose)}
              </Typography.Text>
            ) : (
              <>
                <Typography.Text tag="p" color="secondary">
                  Дата создания заявки:{' '}
                  <time dateTime={application.createdAt}>
                    {formatDate(application.createdAt)}
                  </time>
                </Typography.Text>
                <Typography.Text tag="p" color="secondary">
                  Запрошенный срок: {application.termDays} дней
                  {application.purpose &&
                    ` · ${getApplicationPurposeLabel(application.purpose)}`}
                </Typography.Text>
                {isOoo && (
                  <Typography.Text tag="p" view="primary-small" color="secondary">
                    Масштаб бизнеса:{' '}
                    {scoring?.businessScale
                      ? businessScaleLabels[scoring.businessScale]
                      : 'Ожидает расчета банка'}
                  </Typography.Text>
                )}
                {officerCommentNotice}
              </>
            )}
          </div>

          {awaitingClientChoice && (
            <div className={styles.offerSummary}>
              {offer && (
                <dl className={styles.offerAmount}>
                  <dt>Банк предлагает</dt>
                  <dd>{formatMoney(offer.amount, { exact: true })}</dd>
                </dl>
              )}
              {!offer && !providedApplication && applications.isPending && (
                <div className={styles.offerSkeleton} aria-hidden="true" />
              )}
              {offer && (
                <Typography.Text tag="p" color="secondary">
                  {offer.amount !== application.amount &&
                  offer.termDays !== application.termDays
                    ? 'Сумма и срок отличаются от заявки. Сравнение доступно в предложении.'
                    : offer.amount !== application.amount
                      ? 'Сумма отличается от заявки. Сравнение доступно в предложении.'
                      : offer.termDays !== application.termDays
                        ? 'Срок отличается от заявки. Сравнение доступно в предложении.'
                        : application.decision === 'ALTERNATIVE_OFFER'
                          ? 'Банк предложил другие условия. Сумма и срок сохранены.'
                          : 'Сумма и срок соответствуют заявке'}
                </Typography.Text>
              )}
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
              <dl className={styles.offerDates}>
                <div>
                  <dt>Заявка создана</dt>
                  <dd>
                    <time dateTime={application.createdAt}>
                      {formatDate(application.createdAt)}
                    </time>
                  </dd>
                </div>
                {offer && (
                  <div>
                    <dt>Предложение действует до</dt>
                    <dd>
                      <time dateTime={offer.validUntil}>
                        {formatDate(offer.validUntil)}
                      </time>
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </div>
        <div
          className={`${styles.progress} ${awaitingClientChoice ? styles.offerProgress : ''}`}
          aria-label="Этапы заявки"
        >
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
              <span
                className={
                  awaitingClientChoice ? styles.pendingChoice : undefined
                }
              >
                {`Этап ${activeStep} из ${stages.length} · ${stages[activeStep - 1].title}${declined ? ' · Отказ' : awaitingClientChoice ? ' · Ожидает выбора' : ''}`}
              </span>
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
          {awaitingClientChoice ? (
            <Typography.Text view="primary-small" color="secondary">
              Рассмотрите условия и решите без спешки.
            </Typography.Text>
          ) : (
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
          )}
          <Button
            view="primary"
            size={48}
            className={styles.detailsButton}
            rightAddons={<ArrowRightMIcon aria-hidden="true" />}
            onClick={() => {
              setSelectedApplication(application)
              setDetailsOpen(true)
            }}
            ref={detailsButtonRef}
          >
            {awaitingClientChoice
              ? 'Посмотреть предложение'
              : 'Подробнее о заявке'}
          </Button>
        </div>
      </section>
      {!providedApplication && <ApplicationForm resumeOnly />}

      {offerExperience ? (
        <AcceptOffer
          key={`${scope}-${application.id}`}
          open={detailsOpen}
          application={application}
          offer={offer}
          officerComment={officerComment}
          returnFocusRef={detailsButtonRef}
          onClose={() => setDetailsOpen(false)}
        >
          {applicationDetails}
        </AcceptOffer>
      ) : (
        <Panel
          open={detailsOpen}
          returnFocusRef={detailsButtonRef}
          title={`Заявка № ${application.id}`}
          onClose={() => setDetailsOpen(false)}
          footer={
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
          }
        >
          {applicationDetails}
        </Panel>
      )}
    </>
  )
}
