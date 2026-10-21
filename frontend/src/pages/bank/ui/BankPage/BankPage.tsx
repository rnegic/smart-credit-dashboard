import { BankWorkspace } from '@/widgets/bank-workspace'
import styles from './BankPage.module.scss'

/** Composition-only page; routing and role access are owned by the app. */
export function BankPage() {
  return (
    <main className={styles.page}>
      <BankWorkspace />
    </main>
  )
}
