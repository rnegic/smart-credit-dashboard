import { Outlet } from 'react-router-dom'
import { HeaderNavigation } from '@/widgets/header-navigation'
import { AiCopilotDrawer } from '@/widgets/ai-copilot-drawer'
import { demoCompany } from '@/entities/company'
import { demoApplication } from '@/entities/loan-application'
import styles from './CabinetLayout.module.scss'

export function CabinetLayout() {
  return (
    <div className={styles.layout}>
      <a href="#main-content" className={styles.skipLink}>
        Перейти к содержимому
      </a>
      <HeaderNavigation />
      <div id="main-content" className={styles.content} tabIndex={-1}>
        <Outlet />
      </div>
      <AiCopilotDrawer
        companyName={demoCompany.name}
        application={demoApplication}
      />
    </div>
  )
}
