import { useId, useRef, useState } from 'react'
import { Button } from '@alfalab/core-components/button'
import { IconButton } from '@alfalab/core-components/icon-button'
import { TooltipDesktop } from '@alfalab/core-components/tooltip/desktop'
import { ArrowsCwMIcon } from '@alfalab/icons/glyph/dist/ArrowsCwMIcon'
import { CalendarLineMIcon } from '@alfalab/icons/glyph/dist/CalendarLineMIcon'
import { DocumentLinesMIcon } from '@alfalab/icons/glyph/dist/DocumentLinesMIcon'
import { InformationCircleMIcon } from '@alfalab/icons/glyph/dist/InformationCircleMIcon'
import { WalletLineMIcon } from '@alfalab/icons/glyph/dist/WalletLineMIcon'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { sessionKey, useSession, type Session } from '@/entities/session'
import { applicationBusinessSummarySchema } from '@/entities/application-form'
import { getCompanyAge, getIndustryGroup } from '@/entities/company'
import {
  bankApplicationViewSchema,
  bankApplicationViewsSchema,
  type BankApplicationView,
} from '@/entities/loan-application'
import {
  ApiError,
  apiRequest,
  getSessionGeneration,
  isSessionSwitching,
  syncSessionChanges,
} from '@/shared/api'
import { formatDate, formatMoney } from '@/shared/lib'
import { Panel } from '@/shared/ui'
import { ApplicationQueue } from '../ApplicationQueue'
import { ApplicationStatus } from '../ApplicationStatus'
import { DecisionStatus } from '../DecisionStatus'
import { DecisionForm } from '../DecisionForm'
import type { Decision } from '../../model/decision'
import styles from './BankWorkspace.module.scss'

type UserId = Session['userId']

interface DecisionVariables {
  userId: UserId
  generation: number
  applicationId: BankApplicationView['id']
  decision: Decision
}

const bkiZoneLabels = { RED: 'Красная', YELLOW: 'Жёлтая', GREEN: 'Зелёная' }
const revenueTrendLabels = {
  GROWING: 'Растёт',
  STABLE: 'Стабильна',
  DECLINING: 'Снижается',
}
const scoringPointLabels: Record<string, string> = {
  bkiScore: 'Оценка БКИ',
  delinquencies12m: 'Просрочки за 12 месяцев',
  inquiries12m: 'Запросы в БКИ за 12 месяцев',
  revenueTrend: 'Динамика выручки',
  companyAgeYears: 'Возраст бизнеса',
  dtiPercent: 'Долговая нагрузка (DTI)',
  amountToRevenue: 'Сумма / годовая выручка',
  isDataComplete: 'Полнота данных',
}
const updateTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit',
  minute: '2-digit',
})

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return `${error.message} (${error.code})`
  if (error instanceof Error) return error.message
  return 'Не удалось выполнить запрос. Повторите попытку.'
}

/** Bank queue and officer decisions, backed exclusively by validated API data. */
export function BankWorkspace() {
  const headingId = useId()
  const session = useSession()
  const userId = session.data?.userId
  const generation = getSessionGeneration()
  const queryClient = useQueryClient()
  const [selection, setSelection] = useState<{
    userId: UserId
    applicationId: BankApplicationView['id']
  } | null>(null)
  const selectedId =
    selection?.userId === userId ? selection?.applicationId : undefined
  const decisionLocks = useRef(new Set<string>())
  const queueTriggerRef = useRef<HTMLButtonElement>(null)
  const [lockedKeys, setLockedKeys] = useState<ReadonlySet<string>>(new Set())

  const applications = useQuery({
    queryKey: ['bank', userId, 'applications'],
    queryFn: ({ signal }) =>
      apiRequest('/api/bank/applications', bankApplicationViewsSchema, { signal }),
    enabled: session.data?.role === 'BANK_OFFICER' && !session.isError,
    staleTime: 15_000,
    refetchInterval: 15_000,
    notifyOnChangeProps: [
      'data', 'error', 'isPending', 'isError', 'isFetching', 'dataUpdatedAt',
    ],
    gcTime: 5 * 60_000,
    retry: false,
  })

  const detail = useQuery({
    queryKey: ['bank', userId, 'applications', selectedId],
    queryFn: ({ signal }) =>
      apiRequest(
        `/api/bank/applications/${selectedId}`,
        bankApplicationViewSchema,
        { signal },
      ),
    enabled:
      session.data?.role === 'BANK_OFFICER' &&
      !session.isError &&
      selectedId !== undefined,
    staleTime: 0,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    gcTime: 5 * 60_000,
    retry: false,
  })

  const applicationForm = useQuery({
    queryKey: ['bank', userId, 'applications', selectedId, 'form'],
    queryFn: ({ signal }) =>
      apiRequest(
        `/api/bank/applications/${selectedId}/form`,
        applicationBusinessSummarySchema,
        { signal },
      ),
    enabled:
      session.data?.role === 'BANK_OFFICER' &&
      !session.isError &&
      selectedId !== undefined,
    staleTime: 5 * 60_000,
    gcTime: 5 * 60_000,
    retry: false,
  })

  function isCurrentOfficer(variables: DecisionVariables) {
    syncSessionChanges()
    const currentSession = queryClient.getQueryData<Session | null>(sessionKey)
    return (
      !isSessionSwitching() &&
      variables.generation === getSessionGeneration() &&
      currentSession?.userId === variables.userId &&
      currentSession.role === 'BANK_OFFICER'
    )
  }

  const decision = useMutation({
    mutationFn: async (variables: DecisionVariables) => {
      if (!isCurrentOfficer(variables))
        throw new ApiError(
          409,
          'SESSION_CHANGED',
          'Сессия изменилась. Решение из прежней сессии не отправлено.',
        )
      return apiRequest(
        `/api/bank/applications/${variables.applicationId}/decision`,
        bankApplicationViewSchema,
        { method: 'POST', body: JSON.stringify(variables.decision) },
      )
    },
    retry: false,
    onSuccess: async (updated, variables) => {
      if (!isCurrentOfficer(variables)) return
      queryClient.setQueryData(
        ['bank', variables.userId, 'applications', variables.applicationId],
        updated,
      )
      queryClient.setQueryData<BankApplicationView[]>(
        ['bank', variables.userId, 'applications'],
        (current) =>
          current?.map((item) => (item.id === updated.id ? updated : item)),
      )
      await queryClient.invalidateQueries({
        queryKey: ['bank', variables.userId],
      })
    },
    onError: async (error, variables) => {
      if (
        (error instanceof ApiError && error.code === 'SESSION_CHANGED') ||
        !isCurrentOfficer(variables)
      )
        return
      await queryClient.invalidateQueries({
        queryKey: ['bank', variables.userId],
      })
      if (!isCurrentOfficer(variables)) return
      if (!(error instanceof ApiError && error.code === 'ALREADY_DECIDED')) {
        const key = `${variables.userId}:${variables.applicationId}`
        decisionLocks.current.delete(key)
        setLockedKeys((current) => {
          const next = new Set(current)
          next.delete(key)
          return next
        })
      }
    },
  })

  const application = detail.data
  const scoring = application?.scoring
  const recommendation = application?.recommendation
  const finalRate = application?.offer?.finalRate ?? application?.finalRate
  const businessData = applicationForm.data?.step2_businessData
  const monthlyRevenue = businessData?.financials?.monthlyRevenue
  const registrationDate = businessData?.applicant?.registrationDate
  const industryGroup = getIndustryGroup(businessData?.applicant?.mainOkved)
  const exactAge = application
    ? getCompanyAge(registrationDate, application.createdAt)
    : null
  const scoreAge = scoring?.external?.companyAgeYears
  const companyAge =
    exactAge ??
    (registrationDate
      ? 'Проверьте дату регистрации'
      : scoreAge == null
        ? 'Дата регистрации не передана'
        : scoreAge === 0
          ? 'Меньше года, точная дата не передана'
          : `${new Intl.NumberFormat('ru-RU', {
              style: 'unit',
              unit: 'year',
              unitDisplay: 'long',
            }).format(scoreAge)} (по данным скоринга)`)
  const currentDecision =
    decision.variables?.userId === userId &&
    decision.variables?.generation === generation &&
    decision.variables?.applicationId === selectedId
  const pending = decision.isPending && Boolean(currentDecision)
  const locked =
    selectedId !== undefined && lockedKeys.has(`${userId}:${selectedId}`)

  function submitDecision(body: Decision) {
    if (
      userId === undefined ||
      selectedId === undefined ||
      !application ||
      application.status !== 'IN_REVIEW' ||
      locked ||
      decision.isPending ||
      detail.isFetching ||
      detail.isError ||
      session.isError
    )
      return

    const variables = {
      userId,
      generation,
      applicationId: selectedId,
      decision: body,
    }
    if (!isCurrentOfficer(variables)) return
    const lockKey = `${userId}:${selectedId}`
    // Guard synchronous double submissions before the mutation state rerenders.
    if (decisionLocks.current.has(lockKey)) return
    decisionLocks.current.add(lockKey)
    setLockedKeys((current) => new Set(current).add(lockKey))
    decision.mutate(variables)
  }

  if (session.isError) {
    return (
      <div className={styles.error} role="alert">
        {errorMessage(session.error)}
      </div>
    )
  }
  if (session.isPending) {
    return <p role="status">Загружаем сессию сотрудника...</p>
  }
  if (!session.data || session.data.role !== 'BANK_OFFICER') {
    return (
      <p role="status">
        Для работы с заявками войдите в аккаунт сотрудника банка.
      </p>
    )
  }

  const officerId = session.data.userId
  const queue = applications.data

  return (
    <section className={styles.workspace} aria-labelledby={headingId}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <h1 id={headingId}>Рабочее место банка</h1>
          <p className={styles.caption}>
            <DocumentLinesMIcon aria-hidden="true" />
            Кредитные заявки предпринимателей
          </p>
        </div>
        <div className={styles.refreshGroup}>
          <div className={styles.freshness}>
            <span>
              {applications.isFetching
                ? 'Обновляем очередь...'
                : applications.isError
                  ? 'Не удалось обновить'
                  : applications.dataUpdatedAt > 0
                    ? `Обновлено в ${updateTimeFormatter.format(applications.dataUpdatedAt)}`
                    : 'Загружаем очередь'}
            </span>
            <span className={styles.secondary}>Автообновление каждые 15 сек.</span>
          </div>
          <TooltipDesktop content="Обновить очередь" position="bottom">
            <IconButton
              type="button"
              view="secondary"
              size={48}
              icon={<ArrowsCwMIcon aria-hidden="true" />}
              aria-label="Обновить очередь"
              loading={applications.isFetching}
              disabled={decision.isPending || applications.isFetching}
              onClick={() => {
                void applications.refetch()
              }}
            />
          </TooltipDesktop>
        </div>
      </header>

      {applications.isPending && (
        <p className={styles.loading} role="status">Загружаем заявки...</p>
      )}
      {applications.isError && (
        <div className={styles.error} role="alert">
          <strong>Не удалось загрузить очередь</strong>
          <p>{errorMessage(applications.error)}</p>
          {queue && (
            <p>
              Ниже сохранённые данные. Обновите очередь, чтобы получить текущие
              статусы.
            </p>
          )}
        </div>
      )}
      {queue && (
        <ApplicationQueue
          applications={queue}
          disabled={decision.isPending}
          onSelect={(item, trigger) => {
            queueTriggerRef.current = trigger
            setSelection({ userId: officerId, applicationId: item.id })
          }}
        />
      )}

      <Panel
        open={selectedId !== undefined}
        title={`Заявка № ${selectedId ?? ''}`}
        dismissible={!decision.isPending}
        returnFocusRef={queueTriggerRef}
        onClose={() => {
          if (!decision.isPending) setSelection(null)
        }}
      >
        <div className={styles.details}>
          {detail.isPending && (
            <p role="status">Загружаем сведения о заявке...</p>
          )}
          {detail.isError && (
            <div className={styles.error} role="alert">
              <strong>Не удалось загрузить актуальную заявку</strong>
              <p>{errorMessage(detail.error)}</p>
              <Button
                type="button"
                view="secondary"
                size={48}
                block
                loading={detail.isFetching}
                disabled={detail.isFetching || pending}
                onClick={() => {
                  void detail.refetch()
                }}
              >
                Повторить загрузку
              </Button>
            </div>
          )}
          {detail.isFetching && !detail.isPending && (
            <p className={styles.secondary} role="status">
              Проверяем текущий статус...
            </p>
          )}
          {application && (
            <>
              <section className={styles.section} aria-label="Параметры заявки">
                <div className={styles.detailHeading}>
                  <h2>{application.companyName}</h2>
                  <ApplicationStatus status={application.status} />
                </div>
                <dl
                  className={styles.businessFacts}
                  aria-label="Ключевые показатели бизнеса"
                >
                  <div>
                    <dt>
                      <WalletLineMIcon aria-hidden="true" />
                      Среднемесячная выручка
                    </dt>
                    <dd>
                      {applicationForm.isPending
                        ? 'Загружаем…'
                        : monthlyRevenue == null
                          ? 'Не указана'
                          : formatMoney(monthlyRevenue)}
                    </dd>
                  </div>
                  <div>
                    <dt>
                      <CalendarLineMIcon aria-hidden="true" />
                      Возраст компании на дату заявки
                    </dt>
                    <dd>
                      {applicationForm.isPending ? 'Загружаем…' : companyAge}
                    </dd>
                  </div>
                </dl>
                {applicationForm.isError &&
                  !(applicationForm.error instanceof ApiError &&
                    applicationForm.error.status === 404) && (
                    <div className={styles.secondary} role="status">
                      <p>
                        Не удалось загрузить данные бизнеса:{' '}
                        {errorMessage(applicationForm.error)}
                      </p>
                      <Button
                        type="button"
                        view="text"
                        size={32}
                        loading={applicationForm.isFetching}
                        onClick={() => {
                          void applicationForm.refetch()
                        }}
                      >
                        Повторить загрузку анкеты
                      </Button>
                    </div>
                  )}
                <dl className={styles.parameters}>
                  <div>
                    <dt>ИНН</dt>
                    <dd>{application.inn}</dd>
                  </div>
                  <div>
                    <dt>Форма</dt>
                    <dd>
                      {application.legalForm === 'IP'
                        ? 'ИП'
                        : application.legalForm === 'OOO'
                          ? 'ООО'
                          : (application.legalForm ?? 'Не указана')}
                    </dd>
                  </div>
                  <div>
                    <dt>Сумма</dt>
                    <dd>{formatMoney(application.amount)}</dd>
                  </div>
                  <div>
                    <dt>Срок</dt>
                    <dd>{application.termDays} дней</dd>
                  </div>
                  <div>
                    <dt>Базовая годовая ставка</dt>
                    <dd>
                      {application.rate == null
                        ? 'Не указана'
                        : `${application.rate}%`}
                    </dd>
                  </div>
                  <div>
                    <dt>Сохранённая итоговая годовая ставка</dt>
                    <dd>
                      {finalRate == null ? 'Не определена' : `${finalRate}%`}
                    </dd>
                  </div>
                  <div>
                    <dt>Цель</dt>
                    <dd>{application.purpose ?? 'Не указана'}</dd>
                  </div>
                  <div>
                    <dt>Создана</dt>
                    <dd>{formatDate(application.createdAt)}</dd>
                  </div>
                  <div>
                    <dt>Дата регистрации компании</dt>
                    <dd>
                      {registrationDate
                        ? formatDate(registrationDate)
                        : 'Не передана'}
                    </dd>
                  </div>
                  <div>
                    <dt>Группа отраслей (ОКВЭД)</dt>
                    <dd>{industryGroup?.label ?? 'ОКВЭД не передан'}</dd>
                  </div>
                </dl>
              </section>

              <section
                className={styles.scoring}
                aria-label="Рекомендация скоринга, только для банка"
              >
                <h3 className={styles.sectionTitle}>
                  <InformationCircleMIcon aria-hidden="true" />
                  Рекомендация скоринга
                </h3>
                <p className={styles.secondary}>
                  Это рекомендация, не окончательное решение
                </p>
                {recommendation ? (
                  <>
                    <dl className={styles.parameters}>
                      <div>
                        <dt>Рекомендуемое решение</dt>
                        <dd>
                          <DecisionStatus decision={recommendation.decision} />
                        </dd>
                      </div>
                      <div>
                        <dt>Рекомендуемая сумма</dt>
                        <dd>
                          {recommendation.amount === null
                            ? 'Не указана'
                            : formatMoney(recommendation.amount)}
                        </dd>
                      </div>
                      <div>
                        <dt>Рекомендуемая годовая ставка</dt>
                        <dd>
                          {recommendation.finalRate === null
                            ? 'Не указана'
                            : `${recommendation.finalRate}%`}
                        </dd>
                      </div>
                    </dl>
                    <p>
                      <strong>Обоснование рекомендации</strong>
                    </p>
                    <p className={styles.comment}>{recommendation.reason}</p>
                  </>
                ) : (
                  <p className={styles.secondary}>Рекомендация не сохранена.</p>
                )}
              </section>

              <section
                className={styles.section}
                aria-label="AI-сводка, только для банка"
              >
                <h3>AI-сводка для банка</h3>
                <p className={styles.secondary}>
                  Носит рекомендательный
                  характер и не заменяет решение сотрудника.
                </p>
                <p className={styles.comment}>
                  {application.aiComment?.trim() || 'AI-сводка не сохранена.'}
                </p>
              </section>

              <section
                className={styles.scoring}
                aria-label="Скоринг исходной заявки"
              >
                <h3>Скоринг исходной заявки</h3>
                <dl className={styles.parameters}>
                  <div>
                    <dt>Внутренний скоринговый балл</dt>
                    <dd>
                      {application.internalScore == null
                        ? 'Нет оценки'
                        : `${application.internalScore} / 100`}
                    </dd>
                  </div>
                  <div>
                    <dt>Класс риска</dt>
                    <dd>{application.riskClass ?? 'Нет оценки'}</dd>
                  </div>
                  {scoring && (
                    <>
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
                      <div>
                        <dt>Максимальная сумма продукта</dt>
                        <dd>{formatMoney(scoring.absoluteMaxAmount)}</dd>
                      </div>
                      <div>
                        <dt>Отраслевой коэффициент лимита</dt>
                        <dd>{scoring.industryLimitCoef}</dd>
                      </div>
                      <div>
                        <dt>Отраслевая надбавка к ставке</dt>
                        <dd>{scoring.industryRatePremium} п. п.</dd>
                      </div>
                      <div>
                        <dt>Данные для скоринга</dt>
                        <dd>
                          {scoring.isDataComplete
                            ? 'Полные'
                            : 'Нужны дополнительные сведения'}
                        </dd>
                      </div>
                    </>
                  )}
                </dl>
                {!scoring && (
                  <p className={styles.secondary}>
                    Снимок скоринга не сохранён. Детальные показатели и
                    банковские данные недоступны.
                  </p>
                )}
                <p className={styles.secondary}>
                  Детерминированный скоринг учитывает оценку БКИ, просрочки и
                  запросы за 12 месяцев, динамику выручки, возраст бизнеса, DTI,
                  отношение суммы к годовой выручке и полноту данных. Отрасль
                  влияет на лимит и надбавку к ставке. Расчёты и рекомендация
                  выполняются сервером по фиксированным правилам.
                  Окончательное решение принимает сотрудник.
                  Показатели скоринга относятся к исходной заявке и базовой
                  ставке, а платёж предложения рассчитывается отдельно по
                  итоговой ставке.
                </p>
              </section>

              {scoring &&
                (scoring.bkiZone !== null ||
                  scoring.external !== null ||
                  scoring.points !== null) && (
                  <section
                    className={styles.section}
                    aria-label="Банковские данные скоринга"
                  >
                    <h3>Банковские данные скоринга</h3>
                    <p className={styles.secondary}>
                      Эти сведения не отображаются в кабинете клиента
                    </p>
                    <dl className={styles.parameters}>
                      {scoring.bkiZone && (
                        <div>
                          <dt>Зона БКИ</dt>
                          <dd>{bkiZoneLabels[scoring.bkiZone]}</dd>
                        </div>
                      )}
                      {scoring.external && (
                        <>
                          <div>
                            <dt>Оценка БКИ</dt>
                            <dd>{scoring.external.bkiScore}</dd>
                          </div>
                          <div>
                            <dt>Просрочки за 12 месяцев</dt>
                            <dd>{scoring.external.delinquencies12m}</dd>
                          </div>
                          <div>
                            <dt>Запросы в БКИ за 12 месяцев</dt>
                            <dd>{scoring.external.inquiries12m}</dd>
                          </div>
                          <div>
                            <dt>Активные кредиты по данным БКИ</dt>
                            <dd>{scoring.external.activeLoans}</dd>
                          </div>
                          <div>
                            <dt>Динамика выручки</dt>
                            <dd>
                              {
                                revenueTrendLabels[
                                  scoring.external.revenueTrend
                                ]
                              }
                            </dd>
                          </div>
                          <div>
                            <dt>Полных лет бизнеса в расчёте скоринга</dt>
                            <dd>{scoring.external.companyAgeYears}</dd>
                          </div>
                        </>
                      )}
                    </dl>
                    {scoring.points &&
                      Object.keys(scoring.points).length > 0 && (
                        <>
                          <h3>Баллы по критериям</h3>
                          <dl className={styles.parameters}>
                            {Object.entries(scoring.points).map(
                              ([criterion, points]) => (
                                <div key={criterion}>
                                  <dt>
                                    {scoringPointLabels[criterion] ??
                                      'Другой критерий'}
                                  </dt>
                                  <dd>{points}</dd>
                                </div>
                              ),
                            )}
                          </dl>
                        </>
                      )}
                  </section>
                )}

              <section
                className={styles.section}
                aria-label="Сохранённое решение банка"
              >
                <h3>Сохранённое решение банка</h3>
                <dl className={styles.parameters}>
                  <div>
                    <dt>Решение банка</dt>
                    <dd>
                      {application.decision ? (
                        <DecisionStatus decision={application.decision} />
                      ) : 'Не принято'}
                    </dd>
                  </div>
                </dl>
                <p>
                  <strong>Комментарий сотрудника</strong>
                </p>
                <p className={styles.comment}>
                  {application.officerComment?.trim() ||
                    'Комментарий сотрудника не указан.'}
                </p>
              </section>
              {application.offer && (
                <section
                  className={styles.section}
                  aria-label="Сохранённое предложение"
                >
                  <h3>Предложение по заявке</h3>
                  <dl className={styles.parameters}>
                    <div>
                      <dt>Сумма</dt>
                      <dd>{formatMoney(application.offer.amount)}</dd>
                    </div>
                    <div>
                      <dt>Срок</dt>
                      <dd>{application.offer.termDays} дней</dd>
                    </div>
                    <div>
                      <dt>Итоговая годовая ставка</dt>
                      <dd>{application.offer.finalRate}%</dd>
                    </div>
                    <div>
                      <dt>Платёж в месяц</dt>
                      <dd>{formatMoney(application.offer.monthlyPayment)}</dd>
                    </div>
                    <div>
                      <dt>Действует до</dt>
                      <dd>{formatDate(application.offer.validUntil)}</dd>
                    </div>
                  </dl>
                </section>
              )}
              {currentDecision && decision.isSuccess && (
                <p className={styles.success} role="status">
                  Решение сохранено.
                </p>
              )}
              {currentDecision && decision.isError && (
                <div className={styles.error} role="alert">
                  <strong>Не удалось подтвердить сохранение решения</strong>
                  <p>{errorMessage(decision.error)}</p>
                  <p>
                    Проверьте актуальный статус заявки перед следующей попыткой.
                  </p>
                </div>
              )}
              {application.status === 'IN_REVIEW' ? (
                <DecisionForm
                  key={`${userId}:${selectedId}`}
                  application={application}
                  pending={pending}
                  disabled={locked || detail.isFetching || detail.isError}
                  onSubmit={submitDecision}
                />
              ) : (
                <p className={styles.secondary}>
                  Решение уже принято. Повторное рассмотрение недоступно.
                </p>
              )}
              {pending && (
                <p role="status">
                  Сохраняем решение. Дождитесь завершения запроса.
                </p>
              )}
            </>
          )}
        </div>
      </Panel>
    </section>
  )
}
