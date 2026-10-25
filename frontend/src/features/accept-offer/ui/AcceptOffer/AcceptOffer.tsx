import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@alfalab/core-components/button'
import {
  useApplications,
  getApplicationPurposeLabel,
  applicationViewSchema,
  type Application,
  type ApplicationView,
  type Offer,
} from '@/entities/loan-application'
import { ApiError, apiRequest, getSessionGeneration, useApiScope } from '@/shared/api'
import { formatDate, formatMoney } from '@/shared/lib'
import { Panel } from '@/shared/ui'
import styles from './AcceptOffer.module.scss'

/** Keeps the offer flow above the responsive panel, including its sticky actions. */
export interface AcceptOfferProps {
  application: Application
  offer?: Offer | null
  officerComment?: string | null
  open: boolean
  onClose: () => void
  onViewDocuments: () => void
  returnFocusRef?: RefObject<HTMLElement | null>
  children: ReactNode
}

type OfferAction =
  { kind: 'accept'; version: string; offer: Offer } | { kind: 'refresh' }

type OfferResult =
  | { kind: 'accepted'; offer: Offer | null }
  | { kind: 'review' | 'unknown'; message: string }

function offerVersion(
  applicationId: Application['id'],
  offer: Offer | null | undefined,
  comment: string | null | undefined,
) {
  return offer
    ? JSON.stringify([
        applicationId,
        offer.id,
        offer.amount,
        offer.termDays,
        offer.contractTermMonths,
        offer.finalRate,
        offer.monthlyPayment,
        offer.validUntil,
        comment?.trim() ?? '',
      ])
    : null
}

function offerDeadline(offer: Offer) {
  const deadline = new Date(`${offer.validUntil.slice(0, 10)}T00:00:00`)
  deadline.setDate(deadline.getDate() + 1)
  return deadline.getTime()
}

function isAccepted(application: ApplicationView) {
  return (
    application.status === 'ACCEPTED' ||
    application.status === 'SIGNATURE_PENDING'
  )
}

/** Accepting offer terms starts the separate document signing stage. */
export function AcceptOffer({
  application: providedApplication,
  offer: providedOffer,
  officerComment: providedComment,
  open,
  onClose,
  onViewDocuments,
  returnFocusRef,
  children,
}: AcceptOfferProps) {
  const applications = useApplications()
  const current = applications.data?.find(
    (item) => item.id === providedApplication.id,
  )
  const application = current ?? providedApplication
  const offer = current ? current.offer : providedOffer
  const officerComment = current ? current.officerComment : providedComment
  const cache = useQueryClient()
  const scope = useApiScope()
  const id = useId()
  const submitting = useRef(false)
  const [uncertain, setUncertain] = useState(false)
  const [now, setNow] = useState(Date.now)
  const version = offerVersion(application.id, offer, officerComment)
  const [review, setReview] = useState({
    version,
    confirm: false,
    updated: false,
  })
  const focusHeading = useCallback(
    (node: HTMLHeadingElement | null) => {
      if (node && open) node.focus()
    },
    [open],
  )

  if (review.version !== version) {
    setReview({
      version,
      confirm: false,
      updated: open && review.version !== null,
    })
  }

  const deadline = offer ? offerDeadline(offer) : null
  useEffect(() => {
    if (!open || deadline === null || deadline <= now) return
    const timer = window.setTimeout(
      () => setNow(Date.now()),
      Math.min(Math.max(deadline - Date.now(), 0), 2_147_483_647),
    )
    return () => window.clearTimeout(timer)
  }, [deadline, now, open])

  async function refreshApplication() {
    const result = await applications.refetch({ throwOnError: true })
    const current = result.data?.find((item) => item.id === application.id)
    if (!current) throw new Error('Не удалось получить актуальную заявку.')
    return current
  }

  const sign = useMutation({
    retry: false,
    mutationFn: async (action: OfferAction & { generation: number }): Promise<OfferResult> => {
      const current = await refreshApplication()
      if (action.generation !== getSessionGeneration())
        throw new ApiError(409, 'SESSION_CHANGED', 'Профиль изменился. Повторите действие.')
      if (isAccepted(current)) return { kind: 'accepted', offer: current.offer }
      if (action.kind === 'refresh') {
        return {
          kind: 'review',
          message:
            'Статус заявки обновлён. Проверьте актуальные условия предложения.',
        }
      }
      if (
        offerVersion(current.id, current.offer, current.officerComment) !==
        action.version
      ) {
        return {
          kind: 'review',
          message: 'Предложение обновилось. Проверьте условия ещё раз',
        }
      }
      if (
        current.status !== 'OFFER_READY' ||
        current.offer?.status !== 'ACTIVE' ||
        offerDeadline(current.offer) <= Date.now()
      ) {
        return {
          kind: 'review',
          message:
            'Предложение недоступно для принятия. Проверьте его статус и срок действия.',
        }
      }
      try {
        const accepted = await apiRequest(`/api/offers/${current.offer.id}/accept`, applicationViewSchema, {
          method: 'POST',
        })
        if (accepted.id !== current.id || !isAccepted(accepted))
          throw new ApiError(200, 'INVALID_RESPONSE', 'Сервер не подтвердил принятие предложения')
        return { kind: 'accepted', offer: accepted.offer }
      } catch (error) {
        if (error instanceof ApiError && error.code === 'SESSION_CHANGED')
          throw error
        // A failed response does not prove that the bank rejected the operation.
        try {
          const latest = await refreshApplication()
          if (isAccepted(latest))
            return { kind: 'accepted', offer: latest.offer }
          return {
            kind: 'review',
            message:
              'Сервер пока не подтвердил принятие условий. Проверьте актуальные условия перед новой попыткой.',
          }
        } catch {
          return {
            kind: 'unknown',
            message:
              'Не удалось проверить принятие предложения. Обновите статус заявки перед дальнейшими действиями.',
          }
        }
      }
    },
    onSuccess: (result, { generation }) => {
      if (generation !== getSessionGeneration()) return
      setUncertain(result.kind === 'unknown')
      if (result.kind !== 'accepted') {
        setReview((previous) => ({ ...previous, confirm: false }))
      } else {
        void cache.invalidateQueries({ queryKey: ['client', scope] })
      }
    },
    onSettled: () => {
      submitting.current = false
    },
  })

  const accepted =
    sign.data?.kind === 'accepted' ||
    application.status === 'ACCEPTED' ||
    application.status === 'SIGNATURE_PENDING'
  const unknown = !accepted && uncertain
  const confirm = !accepted && review.version === version && review.confirm
  const expired =
    offer != null &&
    (offer.status === 'EXPIRED' || (deadline !== null && deadline <= now))
  const accepting = sign.isPending && sign.variables?.kind === 'accept'
  const available =
    application.status === 'OFFER_READY' &&
    offer?.status === 'ACTIVE' &&
    !expired &&
    !applications.isError &&
    !applications.isPending
  const displayOffer =
    sign.data?.kind === 'accepted'
      ? sign.data.offer
      : sign.isPending && sign.variables?.kind === 'accept'
        ? sign.variables.offer
        : offer
  const heading = accepted
    ? application.status === 'ACCEPTED'
      ? 'Договор подписан'
      : 'Условия приняты'
    : confirm
      ? 'Подтвердите условия предложения'
      : 'Ваш следующий шаг для бизнеса'
  const screen = accepted ? 'accepted' : confirm ? 'confirm' : 'terms'
  const notice = unknown
    ? 'Не удалось проверить принятие предложения. Обновите статус заявки перед дальнейшими действиями.'
    : review.updated
      ? 'Предложение обновилось. Проверьте условия ещё раз'
      : sign.data && sign.data.kind !== 'accepted'
        ? sign.data.message
        : null

  function close() {
    if (submitting.current || sign.isPending) return
    setReview((previous) => ({ ...previous, confirm: false, updated: false }))
    onClose()
  }

  function refresh() {
    if (submitting.current) return
    submitting.current = true
    sign.mutate({ kind: 'refresh', generation: getSessionGeneration() })
  }

  const footer = (
    <div className={styles.footer} aria-busy={sign.isPending}>
      {accepted ? (
        <Button view="primary" block size={48} onClick={onViewDocuments}>
          Перейти к документам
        </Button>
      ) : unknown || (!available && !accepting) ? (
        <>
          {!unknown && (
            <Button view="primary" block size={48} disabled>
              Принять предложение
            </Button>
          )}
          <Button
            view={unknown ? 'primary' : 'secondary'}
            block
            size={48}
            loading={sign.isPending || applications.isFetching}
            disabled={sign.isPending || applications.isFetching}
            onClick={refresh}
          >
            {unknown ? 'Проверить статус заявки' : 'Обновить данные'}
          </Button>
          <Button
            view="text"
            block
            size={40}
            disabled={sign.isPending}
            onClick={close}
          >
            Не сейчас
          </Button>
        </>
      ) : (
        <>
          <Button
            view="primary"
            block
            size={48}
            loading={sign.isPending}
            disabled={sign.isPending}
            aria-describedby={`${id}-action-hint`}
            onClick={() => {
              if (submitting.current) return
              if (!confirm) {
                sign.reset()
                setReview({ version, confirm: true, updated: false })
                return
              }
              if (offer && version && offerDeadline(offer) > Date.now()) {
                submitting.current = true
                sign.mutate({ kind: 'accept', version, offer, generation: getSessionGeneration() })
              } else {
                setNow(Date.now())
                setReview({ version, confirm: false, updated: false })
              }
            }}
          >
            {sign.isPending
              ? 'Подтверждаем условия…'
              : confirm
                ? 'Принять предложение'
                : 'Принять условия'}
          </Button>
          <p id={`${id}-action-hint`} className={styles.actionHint}>
            {confirm
              ? 'После принятия предложения вы отдельно подпишете два документа'
              : 'На следующем шаге вы проверите и подтвердите условия'}
          </p>
          <Button
            view="text"
            block
            size={40}
            disabled={sign.isPending}
            onClick={() => {
              if (confirm) {
                setReview({ version, confirm: false, updated: false })
                sign.reset()
              } else close()
            }}
          >
            {confirm ? 'Вернуться к условиям' : 'Не сейчас'}
          </Button>
        </>
      )}
    </div>
  )

  return (
    <Panel
      open={open}
      title="Предложение банка"
      onClose={close}
      dismissible={!sign.isPending}
      returnFocusRef={returnFocusRef}
      footer={footer}
    >
      <div
        className={styles.body}
        aria-busy={sign.isPending || applications.isPending}
      >
        <ol className={styles.route} aria-label="Принятие предложения">
          <li aria-current={!confirm && !accepted ? 'step' : undefined}>
            <span aria-hidden="true">01</span> Условия
          </li>
          <li aria-current={confirm ? 'step' : undefined}>
            <span aria-hidden="true">02</span> Подтверждение
          </li>
        </ol>
        <div
          key={screen}
          className={`${styles.sheet} ${confirm ? styles.compact : ''}`}
        >
          <div className={styles.intro}>
            <span className={accepted ? styles.accepted : styles.waiting}>
              {accepted
                ? application.status === 'ACCEPTED'
                  ? 'Договор подписан'
                  : 'Условия приняты'
                : expired
                  ? 'Срок предложения истёк'
                  : application.status !== 'OFFER_READY'
                    ? 'Принятие недоступно'
                    : 'Ждёт вашего решения'}
            </span>
            <h2 className={styles.title} tabIndex={-1} ref={focusHeading}>
              {heading}
            </h2>
            {accepted ? (
              <p role="status">
                {application.status === 'ACCEPTED'
                  ? 'Договор подписан. Результат подписания доступен в документах. Транши оформляются отдельно: подписание не означает выдачу денег.'
                  : 'Следующий этап: проверьте и подпишите два документа. Принятие условий не заменяет подпись.'}
              </p>
            ) : (
              <p>Цель: {getApplicationPurposeLabel(application.purpose)}</p>
            )}
          </div>
          {notice && !accepted && (
            <p className={styles.notice} role="status">
              {notice}
            </p>
          )}
          {sign.error && (
            <p className={styles.notice} role="alert">
              {unknown
                ? 'Не удалось проверить принятие предложения. '
                : 'Не удалось принять предложение. '}
              {sign.error.message}
            </p>
          )}
          {displayOffer ? (
            <>
              <dl className={styles.terms}>
                <div className={styles.principal}>
                  <dt>Лимит договора</dt>
                  <dd>{formatMoney(displayOffer.amount, { exact: true })}</dd>
                </div>
                <div>
                  <dt>Срок договора</dt>
                  <dd>{displayOffer.contractTermMonths === null
                    ? 'Не указан'
                    : `${displayOffer.contractTermMonths} мес.`}</dd>
                </div>
                <div>
                  <dt>Срок транша</dt>
                  <dd>{displayOffer.termDays} дней</dd>
                </div>
                <div>
                  <dt>Ставка по договору</dt>
                  <dd>
                    {String(displayOffer.finalRate).replace('.', ',')}%{' '}
                    <span>годовых</span>
                  </dd>
                </div>
                <div className={styles.payment}>
                  <dt>Пример ежемесячного платежа</dt>
                  <dd>
                    {formatMoney(displayOffer.monthlyPayment, { exact: true })}
                    <span>Если взять весь лимит одним траншем на {displayOffer.termDays} дней</span>
                  </dd>
                </div>
                {displayOffer.contractStart !== null && (
                  <div>
                    <dt>Начало договора</dt>
                    <dd><time dateTime={displayOffer.contractStart}>{formatDate(displayOffer.contractStart)}</time></dd>
                  </div>
                )}
                {displayOffer.contractEnd !== null && (
                  <div>
                    <dt>Окончание договора</dt>
                    <dd><time dateTime={displayOffer.contractEnd}>{formatDate(displayOffer.contractEnd)}</time></dd>
                  </div>
                )}
              </dl>
              <p className={styles.actionHint}>
                Это точные условия одобренного предложения. Срок транша выбран
                на первом шаге заявки и фиксируется вместе со ставкой
                в индивидуальных условиях договора. При получении траншей
                они не выбираются заново. Пример платежа не является графиком
                погашения.
              </p>
              {officerComment?.trim() && (
                <section
                  className={styles.comment}
                  aria-labelledby={`${id}-comment`}
                >
                  <h3 id={`${id}-comment`}>
                    Комментарий кредитного специалиста
                  </h3>
                  <p>{officerComment.trim()}</p>
                </section>
              )}
              {!confirm && !accepted && (
                <section
                  className={styles.comparison}
                  aria-labelledby={`${id}-comparison`}
                >
                  <h3 id={`${id}-comparison`}>Относительно вашей заявки</h3>
                  {displayOffer.amount !== application.amount ||
                   displayOffer.contractTermMonths !== application.contractTermMonths ? (
                    <dl>
                      {displayOffer.amount !== application.amount && (
                        <div>
                          <dt>
                            Запрошенный лимит:{' '}
                            {formatMoney(application.amount, { exact: true })}
                          </dt>
                          <dd>
                            Лимит предложения:{' '}
                            {formatMoney(displayOffer.amount, { exact: true })}
                          </dd>
                        </div>
                      )}
                      {displayOffer.contractTermMonths !== application.contractTermMonths && (
                        <div>
                          <dt>Запрошенный срок договора: {application.contractTermMonths === null
                            ? 'не указан'
                            : `${application.contractTermMonths} мес.`}</dt>
                          <dd>Срок договора предложения: {displayOffer.contractTermMonths === null
                            ? 'не указан'
                            : `${displayOffer.contractTermMonths} мес.`}</dd>
                        </div>
                      )}
                    </dl>
                  ) : (
                    <p>
                      {application.decision === 'ALTERNATIVE_OFFER'
                        ? 'Банк предложил другие условия. Лимит и срок договора сохранены; проверьте ставку по договору'
                        : 'Лимит и срок договора соответствуют заявке. Срок транша сохранён с первого шага'}
                    </p>
                  )}
                </section>
              )}
              <p className={styles.validity}>
                {expired && !accepted
                  ? 'Срок предложения истёк: '
                  : 'Предложение действует до '}
                <time dateTime={displayOffer.validUntil}>
                  {formatDate(displayOffer.validUntil)}
                </time>
              </p>
            </>
          ) : applications.isPending ? (
            <>
              <p role="status">Загружаем условия предложения…</p>
              <div className={styles.skeleton} aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
              </div>
            </>
          ) : (
            <p className={styles.notice} role="status">
              Условия предложения пока недоступны
            </p>
          )}
          {applications.isError && (
            <p className={styles.notice} role="alert">
              Не удалось загрузить актуальные условия.{' '}
              {applications.error.message}
            </p>
          )}
          {expired && !accepted && (
            <p role="status">
              Условия можно прочитать, но принятие предложения недоступно.
            </p>
          )}
          <p className={styles.metadata}>
            Заявка № {application.id} · Создана{' '}
            <time dateTime={application.createdAt}>
              {formatDate(application.createdAt)}
            </time>
          </p>
        </div>
        <details className={styles.details}>
          <summary>Подробнее о заявке</summary>
          {children}
        </details>
      </div>
    </Panel>
  )
}
