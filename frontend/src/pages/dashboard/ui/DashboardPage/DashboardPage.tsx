import { Typography } from '@alfalab/core-components/typography'
import { ApplicationOverview } from '@/widgets/application-overview'
import { ApplicationDocuments } from '@/widgets/application-documents'
import { CreditSummary } from '@/widgets/credit-summary'
import styles from './DashboardPage.module.scss'

export function DashboardPage() {
  return (
    <main className={styles.page}>
      <header className={styles.heading}>
        <Typography.TitleResponsive
          tag="h1"
          view="large"
          font="system"
          weight="bold"
        >
          Кредитный кабинет
        </Typography.TitleResponsive>
        <Typography.Text tag="p" color="secondary">
          Ваше финансирование. Все важное на одном экране.
        </Typography.Text>
      </header>
      <ApplicationOverview />
      <div className={styles.cards}>
        <CreditSummary />
        <ApplicationDocuments compact />
      </div>
    </main>
  )
}
