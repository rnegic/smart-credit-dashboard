import { useId } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@alfalab/core-components/button'
import { Typography } from '@alfalab/core-components/typography'
import { ArrowRightMIcon } from '@alfalab/icons/glyph/dist/ArrowRightMIcon'
import { WalletMIcon } from '@alfalab/icons/glyph/dist/WalletMIcon'
import { useDashboard } from '@/entities/dashboard'
import { ROUTES } from '@/shared/config'
import { formatDate, formatMoney } from '@/shared/lib'
import styles from './CreditSummary.module.scss'

/** Summarizes the active loan and next payment returned by the dashboard API. */
export function CreditSummary() {
  const headingId = useId()
  const navigate = useNavigate()
  const dashboard = useDashboard()
  const loan = dashboard.data?.activeLoan
  const payment = dashboard.data?.nextPayment
  const unavailable =
    dashboard.isPending || dashboard.isError || !dashboard.data

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
