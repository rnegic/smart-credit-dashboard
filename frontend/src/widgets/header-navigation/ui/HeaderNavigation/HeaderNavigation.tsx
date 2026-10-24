import { useState } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { Badge } from '@alfalab/core-components/badge'
import { Button } from '@alfalab/core-components/button'
import { Typography } from '@alfalab/core-components/typography'
import { BriefcaseMIcon } from '@alfalab/icons/glyph/dist/BriefcaseMIcon'
import { BurgerMIcon } from '@alfalab/icons/glyph/dist/BurgerMIcon'
import { ChevronDownMIcon } from '@alfalab/icons/glyph/dist/ChevronDownMIcon'
import { DocumentMIcon } from '@alfalab/icons/glyph/dist/DocumentMIcon'
import { FolderMIcon } from '@alfalab/icons/glyph/dist/FolderMIcon'
import { HouseMIcon } from '@alfalab/icons/glyph/dist/HouseMIcon'
import { InformationCircleLineMIcon } from '@alfalab/icons/glyph/dist/InformationCircleLineMIcon'
import { WalletMIcon } from '@alfalab/icons/glyph/dist/WalletMIcon'
import { useDashboard } from '@/entities/dashboard'
import { useApplications } from '@/entities/loan-application'
import { SessionActions } from '@/features/demo-session'
import { ProfileCompany, ProfileContacts } from '@/features/edit-profile'
import { NotificationCenter } from '@/features/read-notifications'
import { ROUTES } from '@/shared/config'
import { AlfaMark, Panel } from '@/shared/ui'
import styles from './HeaderNavigation.module.scss'

const items = [
  { path: ROUTES.dashboard, label: 'Главная', Icon: HouseMIcon },
  { path: ROUTES.applications, label: 'Заявки', Icon: DocumentMIcon },
  { path: ROUTES.credits, label: 'Кредиты и лимиты', Icon: WalletMIcon },
  {
    path: ROUTES.documents,
    label: 'Документы',
    Icon: FolderMIcon,
  },
]

export interface NavigationProps {
  onNavigate?: () => void
}

function Navigation({ onNavigate }: NavigationProps) {
  const applications = useApplications()
  return (
    <nav aria-label="Основная навигация" className={styles.navigation}>
      {items.map(({ path, label, Icon }) => (
        <NavLink
          key={path}
          to={path}
          end
          onClick={onNavigate}
          className={({ isActive }) =>
            `${styles.navLink} ${isActive ? styles.active : ''}`
          }
        >
          <Icon aria-hidden="true" />
          <Typography.Text view="primary-small" weight="medium">
            {label}
          </Typography.Text>
          {path === ROUTES.applications &&
            applications.data &&
            !applications.error && (
              <Badge
                view="count"
                content={applications.data.length}
                color="specialbg-secondary-transparent"
              />
            )}
        </NavLink>
      ))}
    </nav>
  )
}

export function HeaderNavigation() {
  const [panel, setPanel] = useState<
    'menu' | 'notifications' | 'profile' | null
  >(null)
  const dashboard = useDashboard()
  const company = dashboard.error ? undefined : dashboard.data?.company
  const companyName = company?.name ?? 'Кредитный кабинет'
  const companyDetails = company
    ? `ИНН ${company.inn}${company.okved ? ` · ОКВЭД ${company.okved}` : ''}`
    : dashboard.error
      ? 'Не удалось загрузить данные компании'
      : 'Данные компании загружаются'
  const closePanel = () => setPanel(null)

  return (
    <>
      <header className={styles.header}>
        <div className={styles.logoSlot}>
          <span className={styles.menuControl}>
            <Button
              view="transparent"
              size={40}
              aria-label="Открыть меню"
              onClick={() => setPanel('menu')}
            >
              <BurgerMIcon aria-hidden="true" />
            </Button>
          </span>
          <Link
            to={ROUTES.dashboard}
            className={styles.logo}
            aria-label="Альфа-Банк, главная"
          >
            <AlfaMark />
          </Link>
        </div>
        <Button
          view="transparent"
          size={56}
          className={styles.companyButton}
          labelClassName={styles.companyLabel}
          onClick={() => setPanel('profile')}
          leftAddons={
            <span className={styles.avatar}>
              <BriefcaseMIcon aria-hidden="true" />
            </span>
          }
          rightAddons={<ChevronDownMIcon aria-hidden="true" />}
        >
          <span className={styles.companyText}>
            <Typography.Text view="primary-small" weight="bold">
              {companyName}
            </Typography.Text>
            <Typography.Text
              view="secondary-medium"
              color="secondary"
              className={styles.companyActivity}
            >
              {companyDetails}
            </Typography.Text>
          </span>
        </Button>
        <div className={styles.headerActions}>
          <NotificationCenter
            className={styles.notificationControl}
            open={panel === 'notifications'}
            onOpen={() => setPanel('notifications')}
            onClose={closePanel}
          />
          <SessionActions compact />
        </div>
      </header>

      <aside className={styles.sidebar}>
        <Typography.Text
          view="caps"
          color="secondary"
          className={styles.sidebarLabel}
        >
          Финансирование
        </Typography.Text>
        <Navigation />
        <div className={styles.sidebarBottom}>
          <div className={styles.profileNote}>
            <Typography.Text view="secondary-medium" color="secondary">
              Ваш бизнес
            </Typography.Text>
            <Typography.Text view="primary-small" weight="medium">
              {companyName}
            </Typography.Text>
          </div>
          <Button
            view="transparent"
            size={40}
            leftAddons={<InformationCircleLineMIcon aria-hidden="true" />}
            onClick={() => setPanel('profile')}
          >
            О компании
          </Button>
        </div>
      </aside>

      <Panel
        open={panel === 'menu'}
        title="Кредитный кабинет"
        onClose={closePanel}
      >
        <Navigation onNavigate={closePanel} />
        <div className={styles.panelContent}>
          <Button
            view="secondary"
            block
            onClick={() => setPanel('notifications')}
          >
            Уведомления
          </Button>
        </div>
      </Panel>
      <Panel
        open={panel === 'profile'}
        title="Профиль компании"
        onClose={closePanel}
      >
        <div className={styles.panelContent}>
          <Typography.TitleResponsive tag="h2" view="small" font="system">
            {companyName}
          </Typography.TitleResponsive>
          <Typography.Text tag="p" color="secondary">
            {companyDetails}
          </Typography.Text>
          {company && (
            <div className={styles.panelNotice}>
              <Typography.Text tag="p" weight="medium">
                Форма бизнеса
              </Typography.Text>
              <Typography.Text tag="p" view="primary-small" color="secondary">
                {company.legalForm === 'IP'
                  ? 'Индивидуальный предприниматель (ИП)'
                  : company.legalForm === 'OOO'
                    ? 'Общество с ограниченной ответственностью (ООО)'
                    : company.legalForm ?? 'Не указана'}
              </Typography.Text>
            </div>
          )}
          <ProfileCompany />
          <ProfileContacts />
          <SessionActions />
        </div>
      </Panel>
    </>
  )
}
