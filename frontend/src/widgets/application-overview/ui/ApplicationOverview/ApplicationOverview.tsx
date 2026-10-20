import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@alfalab/core-components/button'
import { StatusBadge } from '@alfalab/core-components/status-badge'
import { Steps } from '@alfalab/core-components/steps'
import { Typography } from '@alfalab/core-components/typography'
import { ArrowRightMIcon } from '@alfalab/icons/glyph/dist/ArrowRightMIcon'
import { ClockMIcon } from '@alfalab/icons/glyph/dist/ClockMIcon'
import { applicationSteps, demoApplication } from '@/entities/loan-application'
import { ROUTES } from '@/shared/config'
import { formatMoney } from '@/shared/lib'
import { Panel } from '@/shared/ui'
import styles from './ApplicationOverview.module.scss'

export function ApplicationOverview() {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const navigate = useNavigate()
  const steps = applicationSteps.map((step, index) => (
    <Typography.Text
      key={step}
      view="primary-small"
      weight={index + 1 === demoApplication.activeStep ? 'medium' : 'regular'}
      color={index + 1 > demoApplication.activeStep ? 'secondary' : 'primary'}
      aria-current={
        index + 1 === demoApplication.activeStep ? 'step' : undefined
      }
    >
      {step}
    </Typography.Text>
  ))
  // The kit keeps step buttons focusable in read-only mode; expose a semantic list instead.
  const progressDescription = (
    <ol className={styles.screenReaderOnly} aria-label="Ход заявки">
      {applicationSteps.map((step, index) => (
        <li
          key={step}
          aria-current={
            index + 1 === demoApplication.activeStep ? 'step' : undefined
          }
        >
          {step}:{' '}
          {index + 1 < demoApplication.activeStep
            ? 'завершено'
            : index + 1 === demoApplication.activeStep
              ? 'текущий этап'
              : 'предстоит'}
        </li>
      ))}
    </ol>
  )

  return (
    <>
      <section className={styles.card} aria-labelledby="application-heading">
        <div className={styles.topline}>
          <span className={styles.status}>
            <ClockMIcon aria-hidden="true" />
            <Typography.Text view="primary-small" weight="medium">
              {demoApplication.statusLabel}
            </Typography.Text>
          </span>
          <Typography.Text view="secondary-large" color="secondary">
            № {demoApplication.number}
          </Typography.Text>
        </div>
        <div className={styles.heading}>
          <Typography.TitleResponsive
            id="application-heading"
            tag="h2"
            view="large"
            font="system"
            weight="bold"
          >
            Заявка на{' '}
            <span className={styles.amount}>
              {formatMoney(demoApplication.amount)}
            </span>
          </Typography.TitleResponsive>
          <Typography.Text tag="p" color="secondary">
            {demoApplication.productName} · {demoApplication.purpose} ·{' '}
            {demoApplication.termMonths} месяца
          </Typography.Text>
        </div>

        <div className={styles.progress} aria-label="Этапы рассмотрения заявки">
          {progressDescription}
          <div className={styles.desktopSteps} inert aria-hidden="true">
            <Steps
              activeStep={demoApplication.activeStep}
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
              Этап {demoApplication.activeStep} из {applicationSteps.length} ·{' '}
              {applicationSteps[demoApplication.activeStep - 1]}
            </Typography.Text>
            <Steps
              activeStep={demoApplication.activeStep}
              ordered
              interactive={false}
              className={styles.steps}
              minSpaceBetweenSteps={16}
            >
              {applicationSteps.map((step) => (
                <span key={step} />
              ))}
            </Steps>
          </div>
        </div>

        <div className={styles.bottomline}>
          <div className={styles.nextStep}>
            <span aria-hidden="true">
              <StatusBadge view="positive-checkmark" />
            </span>
            <div className={styles.nextStepText}>
              <Typography.Text view="primary-small" weight="medium">
                Действий от вас не требуется
              </Typography.Text>
              <Typography.Text view="primary-small" color="secondary">
                Решение появится здесь и в уведомлениях.
              </Typography.Text>
            </div>
          </div>
          <Button
            view="primary"
            size={48}
            className={styles.detailsButton}
            rightAddons={<ArrowRightMIcon aria-hidden="true" />}
            onClick={() => setDetailsOpen(true)}
          >
            Подробнее о заявке
          </Button>
        </div>
      </section>

      <Panel
        open={detailsOpen}
        title={`Заявка ${demoApplication.number}`}
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
        <div className={styles.details}>
          <Typography.TitleResponsive tag="h2" view="medium" font="system">
            {formatMoney(demoApplication.amount)}
          </Typography.TitleResponsive>
          <Typography.Text color="secondary">
            {demoApplication.productName}
          </Typography.Text>
          <dl className={styles.parameters}>
            <div>
              <dt>Цель</dt>
              <dd>{demoApplication.purpose}</dd>
            </div>
            <div>
              <dt>Запрошенный срок</dt>
              <dd>{demoApplication.termMonths} месяца</dd>
            </div>
            <div>
              <dt>Заявка отправлена</dt>
              <dd>{demoApplication.submittedLabel}</dd>
            </div>
            <div>
              <dt>Текущий этап</dt>
              <dd>{demoApplication.statusLabel}</dd>
            </div>
          </dl>
          {progressDescription}
          <div inert aria-hidden="true">
            <Steps
              activeStep={demoApplication.activeStep}
              ordered
              interactive={false}
              isVerticalAlign
            >
              {steps}
            </Steps>
          </div>
          <div className={styles.notice}>
            <Typography.Text tag="p" view="primary-small">
              Проверяем сведения о компании и финансовые данные. Сумма, ставка и
              график платежей будут определены после рассмотрения заявки.
            </Typography.Text>
          </div>
          <Typography.Text view="secondary-medium" color="secondary">
            Демонстрационные данные. Рассмотрение не выполняется реальным
            банком.
          </Typography.Text>
        </div>
      </Panel>
    </>
  )
}
