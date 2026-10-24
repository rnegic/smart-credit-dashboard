import { useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Badge } from '@alfalab/core-components/badge'
import { Button } from '@alfalab/core-components/button'
import { IconButton } from '@alfalab/core-components/icon-button'
import { Typography } from '@alfalab/core-components/typography'
import { BellMIcon } from '@alfalab/icons/glyph/dist/BellMIcon'
import { ArrowsCwMIcon } from '@alfalab/icons/glyph/dist/ArrowsCwMIcon'
import { Link } from 'react-router-dom'
import { useNotifications } from '@/entities/notification'
import { useDashboard } from '@/entities/dashboard'
import {
  apiEmpty,
  ApiError,
  getSessionGeneration,
  isSessionSwitching,
  syncSessionChanges,
  useApiScope,
} from '@/shared/api'
import { ROUTES } from '@/shared/config'
import { formatDate } from '@/shared/lib'
import { Panel, RequestState } from '@/shared/ui'
import { useNotificationStream } from '../../model/use-notification-stream'
import styles from './NotificationCenter.module.scss'

/** Controlled panel state keeps header overlays mutually exclusive. */
export interface NotificationCenterProps {
  open: boolean
  onOpen: () => void
  onClose: () => void
  className?: string
}

/** List, read-state actions and the single client notification subscription. */
export function NotificationCenter({
  open,
  onOpen,
  onClose,
  className,
}: NotificationCenterProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const scope = useApiScope()
  const cache = useQueryClient()
  const notifications = useNotifications()
  const dashboard = useDashboard()
  const stream = useNotificationStream()
  const count = notifications.data
    ? notifications.data.filter((item) => !item.read).length
    : dashboard.data?.unreadNotifications
  const read = useMutation({
    mutationFn: ({ id, generation }: { id: number | null; generation: number }) => {
      syncSessionChanges()
      if (generation !== getSessionGeneration() || isSessionSwitching())
        throw new ApiError(409, 'SESSION_CHANGED', 'Профиль изменился. Повторите действие.')
      return apiEmpty(
        id === null ? '/api/notifications/read-all' : `/api/notifications/${id}/read`,
        { method: id === null ? 'POST' : 'PATCH' },
      )
    },
    onSuccess: async (_, { generation }) => {
      if (generation !== getSessionGeneration()) return
      await cache.cancelQueries({ queryKey: ['client', scope, 'notifications'] })
      if (generation !== getSessionGeneration()) return
      await Promise.all([
        cache.invalidateQueries({ queryKey: ['client', scope, 'notifications'] }),
        cache.invalidateQueries({ queryKey: ['client', scope, 'dashboard'] }),
      ])
    },
    retry: false,
  })

  function show() {
    stream.dismiss()
    onOpen()
    void notifications.refetch()
  }

  return (
    <>
      <span className={`${styles.control} ${className ?? ''}`}>
        <Button
          ref={triggerRef}
          type="button"
          view="transparent"
          size={48}
          aria-label={count ? `Уведомления, непрочитанных: ${count}` : 'Уведомления'}
          aria-expanded={open}
          title="Уведомления"
          onClick={show}
        >
          <BellMIcon aria-hidden="true" />
        </Button>
        {!!count && (
          <span className={styles.badge} aria-hidden="true">
            <Badge view="count" content={count} color="accent" />
          </span>
        )}
      </span>

      {stream.latest && !open && (
        <aside className={styles.toast} aria-label="Новое уведомление">
          <p role="status">{stream.latest.text}</p>
          <div className={styles.actions}>
            <Button type="button" view="secondary" size={32} onClick={show}>
              Посмотреть
            </Button>
            <Button type="button" view="transparent" size={32} onClick={stream.dismiss}>
              Скрыть
            </Button>
          </div>
        </aside>
      )}

      <Panel open={open} title="Уведомления" onClose={onClose} returnFocusRef={triggerRef}>
        <div className={styles.content}>
          <Typography.Text tag="p" view="primary-small" color="secondary" role="status">
            {stream.state === 'connected'
              ? 'Новые уведомления поступают в реальном времени.'
              : stream.state === 'connecting'
                ? 'Подключаем уведомления в реальном времени...'
                : 'Восстанавливаем соединение. Список можно обновить вручную.'}
          </Typography.Text>
          <div className={styles.actions}>
            <IconButton
              className={styles.refreshButton}
              type="button"
              view="secondary"
              size={40}
              icon={<ArrowsCwMIcon aria-hidden="true" />}
              aria-label="Обновить уведомления"
              aria-busy={notifications.isFetching}
              title="Обновить уведомления"
              disabled={notifications.isPending || read.isPending}
              onClick={() => {
                if (!notifications.isFetching) void notifications.refetch()
              }}
            />
            <Button
              type="button"
              view="transparent"
              size={40}
              loading={read.isPending && read.variables?.id === null}
              disabled={!count || read.isPending || notifications.isPending}
              onClick={() => read.mutate({ id: null, generation: getSessionGeneration() })}
            >
              Прочитать все
            </Button>
          </div>
          <Typography.Text view="secondary-medium" color="secondary">
            {count == null ? 'Счётчик пока недоступен' : `Непрочитанных: ${count}`}
          </Typography.Text>
          {notifications.isPending && <RequestState />}
          {notifications.error && (
            <RequestState error={notifications.error} retry={() => { void notifications.refetch() }} />
          )}
          {read.error && <RequestState error={read.error} />}
          {notifications.data?.length === 0 && <p>Уведомлений пока нет.</p>}
          {notifications.data && notifications.data.length > 0 && (
            <ul className={styles.list} aria-label="Уведомления компании">
              {notifications.data.map((notification) => (
                <li
                  key={notification.id}
                  className={`${styles.item} ${notification.read ? '' : styles.unread}`}
                >
                  <div className={styles.meta}>
                    <span>{notification.read ? 'Прочитано' : 'Новое'}</span>
                    <time dateTime={notification.createdAt}>
                      {formatDate(notification.createdAt)}
                      {' · '}
                      {new Intl.DateTimeFormat('ru-RU', {
                        hour: '2-digit', minute: '2-digit',
                      }).format(new Date(notification.createdAt))}
                    </time>
                  </div>
                  <p>{notification.text}</p>
                  {!notification.read && (
                    <Button
                      type="button"
                      view="text"
                      size={32}
                      disabled={read.isPending}
                      loading={read.isPending && read.variables?.id === notification.id}
                      aria-label={`Отметить уведомление от ${formatDate(notification.createdAt)} прочитанным`}
                      onClick={() => read.mutate({ id: notification.id, generation: getSessionGeneration() })}
                    >
                      Отметить прочитанным
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <Link to={ROUTES.applications} onClick={onClose} className={styles.link}>
            Перейти к заявкам
          </Link>
        </div>
      </Panel>
    </>
  )
}
