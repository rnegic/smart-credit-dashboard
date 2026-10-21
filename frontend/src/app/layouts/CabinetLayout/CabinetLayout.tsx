import { Outlet } from 'react-router-dom'
import { HeaderNavigation } from '@/widgets/header-navigation'
import { AiCopilotDrawer } from '@/widgets/ai-copilot-drawer'
import { useDashboard } from '@/entities/dashboard'
import { applicationStatusLabels } from '@/entities/loan-application'
import { LegalForm } from '@/features/demo-session'
import styles from './CabinetLayout.module.scss'

export function CabinetLayout() {
  const dashboard = useDashboard()
  const application = dashboard.data?.currentApplication
  return (
    <div className={styles.layout}>
      <a href="#main-content" className={styles.skipLink}>
        Перейти к содержимому
      </a>
      <HeaderNavigation />
      <div id="main-content" className={styles.content} tabIndex={-1}>
        <Outlet />
      </div>
      {dashboard.data && !dashboard.error && (
        <AiCopilotDrawer
          companyName={dashboard.data.company.name}
          application={
            application
              ? {
                  amount: application.amount,
                  purpose: application.purpose ?? 'Цель не указана',
                  statusLabel: applicationStatusLabels[application.status],
                }
              : null
          }
        />
      )}
      <LegalForm />
    </div>
  )
}
