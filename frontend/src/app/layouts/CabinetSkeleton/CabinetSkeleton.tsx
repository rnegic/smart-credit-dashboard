import type { ReactNode } from 'react'
import { DashboardPage } from '@/pages/dashboard'
import { AlfaMark, Skeleton } from '@/shared/ui'
import styles from './CabinetSkeleton.module.scss'

const navigationRows = ['70%', '58%', '76%', '52%'] as const

export interface CabinetSkeletonProps {
  children?: ReactNode
}

export function CabinetSkeleton({ children }: CabinetSkeletonProps) {
  return (
    <div className={styles.layout} aria-busy="true">
      <header className={styles.header}>
        <div className={styles.logoSlot}>
          <span className={styles.menuControl}>
            <Skeleton
              width="2.5rem"
              height="2.5rem"
              radius="var(--border-radius-8)"
            />
          </span>
          <span className={styles.logo}>
            <AlfaMark />
          </span>
        </div>
        <div className={styles.company}>
          <Skeleton
            width="2.5rem"
            height="2.5rem"
            radius="var(--border-radius-12)"
          />
          <div className={styles.companyText}>
            <Skeleton width="min(12rem, 100%)" height="0.875rem" />
            <Skeleton width="min(9rem, 100%)" height="0.75rem" />
          </div>
        </div>
        <div className={styles.headerActions}>
          <Skeleton width="2.5rem" height="2.5rem" radius="50%" />
          <Skeleton
            width="6rem"
            height="2.5rem"
            radius="var(--border-radius-12)"
          />
        </div>
      </header>

      <aside className={styles.sidebar}>
        <Skeleton
          className={styles.sidebarLabel}
          width="4.5rem"
          height="0.75rem"
        />
        <nav className={styles.navigation}>
          {navigationRows.map((width) => (
            <div className={styles.navLink} key={width}>
              <Skeleton width="1.5rem" height="1.5rem" radius="50%" />
              <Skeleton width={width} height="0.875rem" />
            </div>
          ))}
        </nav>
        <div className={styles.sidebarBottom}>
          <div className={styles.profileNote}>
            <Skeleton width="4rem" height="0.75rem" />
            <Skeleton width="9rem" height="0.875rem" />
          </div>
          <Skeleton
            width="6.5rem"
            height="2.5rem"
            radius="var(--border-radius-12)"
          />
        </div>
      </aside>

      <div className={styles.content}>{children ?? <DashboardPage />}</div>
    </div>
  )
}
