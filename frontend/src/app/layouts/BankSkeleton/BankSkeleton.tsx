import { BankWorkspaceSkeleton } from '@/widgets/bank-workspace'
import { AlfaMark, Skeleton } from '@/shared/ui'
import styles from './BankSkeleton.module.scss'

export function BankSkeleton() {
  return (
    <div className={styles.shell} aria-busy="true">
      <header className={styles.header}>
        <div className={styles.brand}>
          <AlfaMark />
          <Skeleton width="8rem" height="0.875rem" />
        </div>
        <div className={styles.profile}>
          <div className={styles.identity}>
            <Skeleton width="10rem" height="0.875rem" />
            <Skeleton width="6rem" height="0.75rem" />
          </div>
          <Skeleton
            width="2.5rem"
            height="2.5rem"
            radius="var(--border-radius-12)"
          />
        </div>
      </header>
      <main className={styles.page}>
        <BankWorkspaceSkeleton />
      </main>
    </div>
  )
}
