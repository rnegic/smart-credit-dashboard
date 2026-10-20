import { Typography } from '@alfalab/core-components/typography'
import { ApplicationOverview } from '@/widgets/application-overview'
import { ApplicationDocuments } from '@/widgets/application-documents'
import { CreditSummary } from '@/widgets/credit-summary'
import styles from './CabinetSections.module.scss'

export function ApplicationsPage() {
  return (
    <main className={styles.page}>
      <header className={styles.heading}>
        <Typography.TitleResponsive
          tag="h1"
          view="large"
          font="system"
          weight="bold"
        >
          Заявки
        </Typography.TitleResponsive>
        <Typography.Text tag="p" color="secondary">
          Статус рассмотрения и следующие шаги.
        </Typography.Text>
      </header>
      <ApplicationOverview />
    </main>
  )
}

export function CreditsPage() {
  return (
    <main className={styles.page}>
      <header className={styles.heading}>
        <Typography.TitleResponsive
          tag="h1"
          view="large"
          font="system"
          weight="bold"
        >
          Кредиты и лимиты
        </Typography.TitleResponsive>
        <Typography.Text tag="p" color="secondary">
          Обязательства бизнеса и предстоящие платежи.
        </Typography.Text>
      </header>
      <CreditSummary />
    </main>
  )
}

export function DocumentsPage() {
  return (
    <main className={styles.page}>
      <header className={styles.heading}>
        <Typography.TitleResponsive
          tag="h1"
          view="large"
          font="system"
          weight="bold"
        >
          Документы
        </Typography.TitleResponsive>
        <Typography.Text tag="p" color="secondary">
          Все переданные сведения в одном месте.
        </Typography.Text>
      </header>
      <ApplicationDocuments />
    </main>
  )
}
