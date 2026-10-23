import { BankPage } from '@/pages/bank'
import { SessionActions } from '@/features/demo-session'
import { useSession } from '@/entities/session'
import { AlfaMark } from '@/shared/ui'
import styles from './BankLayout.module.scss'

export function BankLayout() {
  const session = useSession()
  return (
    <>
      <header className={styles.header}>
        <div className={styles.brand}>
          <AlfaMark />
          <span className={styles.product}>Кредитный кабинет</span>
        </div>
        <div className={styles.profile}>
          <div className={styles.identity}>
            <span>{session.data?.fullName}</span>
            <span className={styles.role}>Сотрудник банка</span>
          </div>
          <SessionActions compact />
        </div>
      </header>
      <BankPage />
    </>
  )
}
