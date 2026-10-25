import { Typography } from '@alfalab/core-components/typography'
import { ApplicationList } from '@/widgets/application-overview'
import { ApplicationDocuments } from '@/widgets/application-documents'
import { ContractOverview } from '@/widgets/contract-overview'
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
      <ApplicationList />
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
          Договор и овердрафты
        </Typography.TitleResponsive>
        <Typography.Text tag="p" color="secondary">
          Лимит договора, получение траншей и погашение овердрафтов.
        </Typography.Text>
      </header>
      <ContractOverview />
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
          Доступность документов по кредитному процессу.
        </Typography.Text>
      </header>
      <ApplicationDocuments />
    </main>
  )
}
