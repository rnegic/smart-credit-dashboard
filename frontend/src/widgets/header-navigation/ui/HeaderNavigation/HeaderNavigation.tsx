import { useState } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { Badge } from '@alfalab/core-components/badge'
import { Button } from '@alfalab/core-components/button'
import { Typography } from '@alfalab/core-components/typography'
import { BellMIcon } from '@alfalab/icons/glyph/dist/BellMIcon'
import { BriefcaseMIcon } from '@alfalab/icons/glyph/dist/BriefcaseMIcon'
import { BurgerMIcon } from '@alfalab/icons/glyph/dist/BurgerMIcon'
import { ChevronDownMIcon } from '@alfalab/icons/glyph/dist/ChevronDownMIcon'
import { DocumentMIcon } from '@alfalab/icons/glyph/dist/DocumentMIcon'
import { FolderMIcon } from '@alfalab/icons/glyph/dist/FolderMIcon'
import { HouseMIcon } from '@alfalab/icons/glyph/dist/HouseMIcon'
import { InformationCircleLineMIcon } from '@alfalab/icons/glyph/dist/InformationCircleLineMIcon'
import { LogOutMIcon } from '@alfalab/icons/glyph/dist/LogOutMIcon'
import { WalletMIcon } from '@alfalab/icons/glyph/dist/WalletMIcon'
import { demoCompany } from '@/entities/company'
import { demoApplication, demoDocuments } from '@/entities/loan-application'
import { ROUTES } from '@/shared/config'
import { AlfaMark, Panel } from '@/shared/ui'
import styles from './HeaderNavigation.module.scss'

const items = [
  { path: ROUTES.dashboard, label: 'Главная', Icon: HouseMIcon },
  { path: ROUTES.applications, label: 'Заявки', Icon: DocumentMIcon, count: 1 },
  { path: ROUTES.credits, label: 'Кредиты и лимиты', Icon: WalletMIcon },
  {
    path: ROUTES.documents,
    label: 'Документы',
    Icon: FolderMIcon,
    count: demoDocuments.length,
  },
]

export interface NavigationProps {
  onNavigate?: () => void
}

function Navigation({ onNavigate }: NavigationProps) {
  return (
    <nav aria-label="Основная навигация" className={styles.navigation}>
      {items.map(({ path, label, Icon, count }) => (
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
          {count !== undefined && (
            <Badge
              view="count"
              content={count}
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
  const [notificationRead, setNotificationRead] = useState(false)
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
          onClick={() => setPanel('profile')}
          aria-label="Профиль компании"
          leftAddons={
            <span className={styles.avatar}>
              <BriefcaseMIcon aria-hidden="true" />
            </span>
          }
          rightAddons={<ChevronDownMIcon aria-hidden="true" />}
        >
          <span className={styles.companyText}>
            <Typography.Text view="primary-small" weight="bold">
              {demoCompany.name}
            </Typography.Text>
            <Typography.Text
              view="secondary-medium"
              color="secondary"
              className={styles.companyActivity}
            >
              {demoCompany.activity}
            </Typography.Text>
          </span>
        </Button>
        <div className={styles.headerActions}>
          <span className={styles.notificationControl}>
            <Button
              view="transparent"
              size={48}
              aria-label={
                notificationRead
                  ? 'Уведомления'
                  : 'Уведомления, 1 непрочитанное'
              }
              onClick={() => setPanel('notifications')}
            >
              <BellMIcon aria-hidden="true" />
            </Button>
            {!notificationRead && (
              <span className={styles.notificationDot} aria-hidden="true" />
            )}
          </span>
          <Button view="transparent" size={48} aria-label="Выйти">
            <LogOutMIcon aria-hidden="true" />
          </Button>
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
              {demoCompany.name}
            </Typography.Text>
          </div>
          <Button
            view="transparent"
            size={40}
            leftAddons={<InformationCircleLineMIcon aria-hidden="true" />}
            onClick={() => setPanel('profile')}
          >
            О демоверсии
          </Button>
        </div>
      </aside>

      <Panel
        open={panel === 'menu'}
        title="Кредитный кабинет"
        onClose={closePanel}
      >
        <Navigation onNavigate={closePanel} />
      </Panel>
      <Panel
        open={panel === 'profile'}
        title="Профиль компании"
        onClose={closePanel}
      >
        <div className={styles.panelContent}>
          <Typography.TitleResponsive tag="h2" view="small" font="system">
            {demoCompany.name}
          </Typography.TitleResponsive>
          <Typography.Text tag="p" color="secondary">
            {demoCompany.activity}
          </Typography.Text>
          <div className={styles.panelNotice}>
            <Typography.Text tag="p" weight="medium">
              {demoCompany.profileLabel}
            </Typography.Text>
            <Typography.Text tag="p" view="primary-small" color="secondary">
              Компания, заявка и документы - демонстрационные данные
            </Typography.Text>
          </div>
        </div>
      </Panel>
      <Panel
        open={panel === 'notifications'}
        title="Уведомления"
        onClose={closePanel}
        footer={
          !notificationRead && (
            <Button
              view="secondary"
              block
              onClick={() => setNotificationRead(true)}
            >
              Отметить прочитанным
            </Button>
          )
        }
      >
        <div className={styles.panelContent}>
          <Typography.Text view="secondary-medium" color="secondary">
            {demoApplication.submittedLabel}
          </Typography.Text>
          <Typography.TitleResponsive tag="h2" view="xsmall" font="system">
            Заявка принята
          </Typography.TitleResponsive>
          <Typography.Text tag="p" color="secondary">
            Проверяем данные по заявке {demoApplication.number}. Дополнительных
            действий сейчас не требуется.
          </Typography.Text>
          <Link
            to={ROUTES.applications}
            className={styles.textLink}
            onClick={closePanel}
          >
            Перейти к заявке
          </Link>
          {notificationRead && (
            <Typography.Text
              view="secondary-medium"
              color="secondary"
              role="status"
            >
              Прочитано
            </Typography.Text>
          )}
        </div>
      </Panel>
    </>
  )
}
