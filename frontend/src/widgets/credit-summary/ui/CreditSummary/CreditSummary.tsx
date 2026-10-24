import { useId } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@alfalab/core-components/button'
import { Typography } from '@alfalab/core-components/typography'
import { ArrowRightMIcon } from '@alfalab/icons/glyph/dist/ArrowRightMIcon'
import { WalletMIcon } from '@alfalab/icons/glyph/dist/WalletMIcon'
import { useDashboard } from '@/entities/dashboard'
import { ROUTES } from '@/shared/config'
import { formatDate, formatMoney } from '@/shared/lib'
import { Skeleton } from '@/shared/ui'
import styles from './CreditSummary.module.scss'

const skeletonRows = [0, 1, 2, 3, 4]

function CreditSummarySkeleton() {
  const headingId = useId()

  return (
    <section
      className={styles.card}
      aria-labelledby={headingId}
      aria-busy="true"
    >
      <Typography.TitleResponsive
        tag="h2"
        id={headingId}
        view="xsmall"
        font="system"
        weight="bold"
      >
        Кредиты и лимиты
      </Typography.TitleResponsive>
      <div className={styles.body}>
        <Skeleton
          width="var(--gap-48)"
          height="var(--gap-48)"
          radius="var(--border-radius-16)"
        />
        <Skeleton width="min(85%, 18rem)" height="1.25rem" />
        <div className={styles.skeletonParameters}>
          {skeletonRows.map((row) => (
            <div className={styles.skeletonParameter} key={row}>
              <Skeleton width="42%" height="0.875rem" />
              <Skeleton width="25%" height="0.875rem" />
            </div>
          ))}
        </div>
      </div>
      <div>
        <Skeleton
          width="7rem"
          height="2.5rem"
          radius="var(--border-radius-12)"
        />
      </div>
      <span className={styles.screenReaderOnly} role="status">
        Загружаем сведения о кредите…
      </span>
    </section>
  )
}

/** Summarizes the active loan and next payment returned by the dashboard API. */
export function CreditSummary() {
  const headingId = useId()
  const navigate = useNavigate()
  const dashboard = useDashboard()
  const loan = dashboard.data?.activeLoan
  const payment = dashboard.data?.nextPayment

  if (dashboard.isPending || (!dashboard.isError && !dashboard.data)) {
    return <CreditSummarySkeleton />
  }

  const unavailable = dashboard.isError || !dashboard.data

  return (
    <section
      className={styles.card}
      aria-labelledby={headingId}
      aria-busy={dashboard.isPending}
    >
      <Typography.TitleResponsive
        tag="h2"
        id={headingId}
        view="xsmall"
        font="system"
        weight="bold"
      >
        Кредиты и лимиты
      </Typography.TitleResponsive>
      <div className={styles.body}>
        <span className={styles.icon}>
          <WalletMIcon aria-hidden="true" />
        </span>
        {unavailable ? (
          <div role={dashboard.isError ? 'alert' : 'status'}>
            <Typography.Text tag="p" view="primary-small" color="secondary">
              {dashboard.isError
                ? 'Не удалось загрузить сведения о кредите'
                : 'Загружаем сведения о кредите…'}
            </Typography.Text>
          </div>
        ) : loan ? (
          <>
            <Typography.Text tag="p" view="primary-medium" weight="medium">
              Остаток долга: {formatMoney(loan.remainingBalance)}
            </Typography.Text>
            <dl className={styles.parameters}>
              <div>
                <dt>Кредит</dt>
                <dd>№ {loan.id}</dd>
              </div>
              <div>
                <dt>Годовая ставка</dt>
                <dd>{loan.ratePercent}%</dd>
              </div>
              <div>
                <dt>Срок</dt>
                <dd>{loan.termMonths} мес.</dd>
              </div>
              <div>
                <dt>Дата начала</dt>
                <dd>{formatDate(loan.startDate)}</dd>
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
              <Typography.Text tag="p" view="primary-small" color="secondary">
                Ближайший платёж не указан.
              </Typography.Text>
            )}
            <Typography.Text tag="p" view="primary-small" color="secondary">
              Полный график платежей пока недоступен.
            </Typography.Text>
          </>
        ) : (
          <>
            <Typography.Text tag="p" view="primary-medium" weight="medium">
              Действующих кредитов пока нет
            </Typography.Text>
            <Typography.Text tag="p" view="primary-small" color="secondary">
              Принятие предложения не означает выдачу кредита.
            </Typography.Text>
          </>
        )}
      </div>
      {dashboard.isError ? (
        <div>
          <Button
            view="secondary"
            size={40}
            onClick={() => {
              void dashboard.refetch()
            }}
          >
            Повторить загрузку
          </Button>
        </div>
      ) : !unavailable && loan ? (
        <div>
          <Button
            view="text"
            size={40}
            rightAddons={<ArrowRightMIcon aria-hidden="true" />}
            onClick={() => {
              void navigate(ROUTES.credits)
            }}
          >
            К кредитам
          </Button>
        </div>
      ) : null}
    </section>
  )
}
