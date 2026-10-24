import { Skeleton } from '@/shared/ui'
import styles from './BankWorkspaceSkeleton.module.scss'

const filterWidths = ['4.5rem', '5.5rem', '7rem', '5rem', '4.5rem'] as const
const rows = [0, 1, 2, 3, 4] as const

export function BankWorkspaceSkeleton() {
  return (
    <section className={styles.workspace} aria-busy="true">
      <header className={styles.header}>
        <div className={styles.heading}>
          <Skeleton width="min(22rem, 85%)" height="2rem" />
          <Skeleton width="min(18rem, 70%)" height="0.875rem" />
        </div>
        <div className={styles.refresh}>
          <div className={styles.freshness}>
            <Skeleton width="8rem" height="0.75rem" />
            <Skeleton width="10rem" height="0.75rem" />
          </div>
          <Skeleton
            width="3rem"
            height="3rem"
            radius="var(--border-radius-12)"
          />
        </div>
      </header>

      <div className={styles.queue}>
        <div className={styles.filters}>
          {filterWidths.map((width) => (
            <Skeleton
              key={width}
              width={width}
              height="2rem"
              radius="var(--border-radius-8)"
            />
          ))}
        </div>
        <div className={styles.toolbar}>
          <Skeleton
            width="min(36rem, 100%)"
            height="3rem"
            radius="var(--border-radius-12)"
          />
          <Skeleton
            width="100%"
            height="3rem"
            radius="var(--border-radius-12)"
          />
        </div>
        <div className={styles.resultBar}>
          <Skeleton width="10rem" height="0.75rem" />
        </div>
        <div className={styles.table}>
          <div className={styles.tableHead}>
            <Skeleton width="6rem" height="0.75rem" />
            <Skeleton width="4rem" height="0.75rem" />
            <Skeleton width="7rem" height="0.75rem" />
            <Skeleton width="8rem" height="0.75rem" />
            <Skeleton width="4rem" height="0.75rem" />
            <Skeleton width="2rem" height="0.75rem" />
          </div>
          {rows.map((row) => (
            <div className={styles.tableRow} key={row}>
              <div className={styles.cell}>
                <Skeleton width="30%" height="0.75rem" />
                <Skeleton width="78%" height="1rem" />
                <Skeleton width="52%" height="0.75rem" />
              </div>
              <div className={styles.cell}>
                <Skeleton width="80%" height="1rem" />
                <Skeleton width="55%" height="0.75rem" />
                <Skeleton width="65%" height="0.75rem" />
              </div>
              <div className={styles.cell}>
                <Skeleton width="70%" height="1.5rem" radius="var(--border-radius-8)" />
                <Skeleton width="85%" height="0.75rem" />
              </div>
              <div className={styles.cell}>
                <Skeleton width="65%" height="1rem" />
                <Skeleton width="80%" height="0.75rem" />
              </div>
              <div className={styles.cell}>
                <Skeleton width="80%" height="0.875rem" />
                <Skeleton width="60%" height="0.75rem" />
              </div>
              <div className={styles.cell}>
                <Skeleton
                  width="2rem"
                  height="2rem"
                  radius="var(--border-radius-8)"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
