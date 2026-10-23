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
  type Application,
  type ApplicationView,
  type Offer,
} from '@/entities/loan-application'
import { ApiError, apiEmpty, useApiScope } from '@/shared/api'
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
  returnFocusRef?: RefObject<HTMLElement | null>
  children: ReactNode
}

type OfferAction =
  { kind: 'sign'; version: string; offer: Offer } | { kind: 'refresh' }

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
    application.offer?.status === 'ACCEPTED'
  )
}

/** Shows linked terms, reviews their latest version, and signs only on explicit confirmation. */
export function AcceptOffer({
  application: providedApplication,
  offer: providedOffer,
  officerComment: providedComment,
  open,
  onClose,
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
    mutationFn: async (action: OfferAction): Promise<OfferResult> => {
      const current = await refreshApplication()
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
            'Предложение недоступно для подписания. Проверьте его статус и срок действия.',
        }
      }
      try {
        await apiEmpty(`/api/offers/${current.offer.id}/sign`, {
          method: 'POST',
        })
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
              'Не удалось проверить результат подписания. Обновите статус заявки перед дальнейшими действиями.',
          }
        }
      }
      return { kind: 'accepted', offer: current.offer }
    },
    onSuccess: (result) => {
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
    offer?.status === 'ACCEPTED'
  const unknown = !accepted && uncertain
  const confirm = !accepted && review.version === version && review.confirm
  const expired =
    offer != null &&
    (offer.status === 'EXPIRED' || (deadline !== null && deadline <= now))
  const signing = sign.isPending && sign.variables?.kind === 'sign'
  const available =
    application.status === 'OFFER_READY' &&
    offer?.status === 'ACTIVE' &&
    !expired &&
    !applications.isError &&
    !applications.isPending
  const displayOffer =
    sign.data?.kind === 'accepted'
      ? sign.data.offer
      : sign.isPending && sign.variables?.kind === 'sign'
        ? sign.variables.offer
        : offer
  const heading = accepted
    ? 'Условия приняты'
    : confirm
      ? 'Проверьте условия перед подписанием'
      : 'Ваш следующий шаг для бизнеса'
  const screen = accepted ? 'accepted' : confirm ? 'confirm' : 'terms'
  const notice = unknown
    ? 'Не удалось проверить результат подписания. Обновите статус заявки перед дальнейшими действиями.'
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
    sign.mutate({ kind: 'refresh' })
  }

  const footer = (
    <div className={styles.footer} aria-busy={sign.isPending}>
      {accepted ? (
        <Button view="primary" block size={48} onClick={close}>
          К заявке
        </Button>
      ) : unknown || (!available && !signing) ? (
        <>
          {!unknown && (
            <Button view="primary" block size={48} disabled>
              Перейти к подписанию
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
                sign.mutate({ kind: 'sign', version, offer })
              } else {
                setNow(Date.now())
                setReview({ version, confirm: false, updated: false })
              }
            }}
          >
            {sign.isPending
              ? 'Подтверждаем условия…'
              : confirm
                ? 'Подтвердить подписание'
                : 'Перейти к подписанию'}
          </Button>
          <p id={`${id}-action-hint`} className={styles.actionHint}>
            {confirm
              ? 'Вы подтвердите условия предложения. После этого ожидайте подтверждения выдачи'
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
                ? 'Принято'
                : expired
                  ? 'Срок предложения истёк'
                  : application.status !== 'OFFER_READY'
                    ? 'Подписание недоступно'
                    : 'Ждёт вашего решения'}
            </span>
            <h2 className={styles.title} tabIndex={-1} ref={focusHeading}>
              {heading}
            </h2>
            {accepted ? (
              <p role="status">
                Ожидаем подтверждения выдачи. Деньги ещё не зачислены
              </p>
            ) : (
              <p>Цель: {application.purpose || 'Не указана'}</p>
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
                ? 'Не удалось проверить результат подписания. '
                : 'Не удалось обновить условия. Подписание не отправлено. '}
              {sign.error.message}
            </p>
          )}
          {displayOffer ? (
            <>
              <dl className={styles.terms}>
                <div className={styles.principal}>
                  <dt>Сумма предложения</dt>
                  <dd>{formatMoney(displayOffer.amount, { exact: true })}</dd>
                </div>
                <div>
                  <dt>Срок</dt>
                  <dd>{displayOffer.termDays} дней</dd>
                </div>
                <div>
                  <dt>Итоговая ставка</dt>
                  <dd>
                    {String(displayOffer.finalRate).replace('.', ',')}%{' '}
                    <span>годовых</span>
                  </dd>
                </div>
                <div className={styles.payment}>
                  <dt>Ежемесячный платёж</dt>
                  <dd>
                    {formatMoney(displayOffer.monthlyPayment, { exact: true })}
                  </dd>
                </div>
              </dl>
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
                  displayOffer.termDays !== application.termDays ? (
                    <dl>
                      {displayOffer.amount !== application.amount && (
                        <div>
                          <dt>
                            Запрашивали{' '}
                            {formatMoney(application.amount, { exact: true })}
                          </dt>
                          <dd>
                            Банк предлагает{' '}
                            {formatMoney(displayOffer.amount, { exact: true })}
                          </dd>
                        </div>
                      )}
                      {displayOffer.termDays !== application.termDays && (
                        <div>
                          <dt>Запрошенный срок: {application.termDays} дней</dt>
                          <dd>Банк предлагает: {displayOffer.termDays} дней</dd>
                        </div>
                      )}
                    </dl>
                  ) : (
                    <p>
                      {application.decision === 'ALTERNATIVE_OFFER'
                        ? 'Банк предложил другие условия. Сумма и срок сохранены; проверьте итоговую ставку'
                        : 'Сумма и срок соответствуют заявке'}
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
              Условия можно прочитать, но подписание недоступно.
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
