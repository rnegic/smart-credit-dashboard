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
        <AlfaMark />
        <span>{session.data?.fullName} · Сотрудник банка</span>
        <SessionActions compact />
      </header>
      <BankPage />
    </>
  )
}
