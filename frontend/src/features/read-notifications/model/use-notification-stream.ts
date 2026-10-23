import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  notificationSchema,
  type Notification,
} from '@/entities/notification'
import { sessionKey, useSession } from '@/entities/session'
import {
  apiEventStream,
  useApiScope,
  useSessionTransition,
} from '@/shared/api'

/** The backend only streams CLIENT events and does not replay missed messages. */
export function useNotificationStream() {
  const scope = useApiScope()
  const session = useSession()
  const role = session.data?.role
  const companyId = session.data?.companyId
  const transition = useSessionTransition()
  const cache = useQueryClient()
  const [state, setState] = useState<'connecting' | 'connected' | 'reconnecting'>(
    'connecting',
  )
  const [latest, setLatest] = useState<Notification | null>(null)

  useEffect(() => {
    if (
      scope === null ||
      role !== 'CLIENT' ||
      companyId == null ||
      transition.switching
    )
      return
    const notificationKey = ['client', scope, 'notifications']
    const seen = new Set<number>()
    let checkingSession = false

    function refresh() {
      for (const resource of ['notifications', 'dashboard', 'applications'])
        void cache.invalidateQueries({ queryKey: ['client', scope, resource] })
    }

    return apiEventStream('/api/notifications/stream', {
      events: {
        connected: (data) => {
          if (data !== 'ok') {
            setState('reconnecting')
            return
          }
          checkingSession = false
          setState('connected')
          refresh()
        },
        notification: (data) => {
          let payload: unknown
          try {
            payload = JSON.parse(data)
          } catch {
            refresh()
            return
          }
          const result = notificationSchema.safeParse(payload)
          if (!result.success) {
            refresh()
            return
          }
          const notification = result.data
          if (seen.has(notification.id)) return
          seen.add(notification.id)
          if (seen.size > 200) seen.delete(seen.values().next().value!)
          cache.setQueryData<Notification[]>(notificationKey, (current) => {
            if (!current) return current
            const previous = current.find((item) => item.id === notification.id)
            return [
              { ...notification, read: previous?.read || notification.read },
              ...current.filter((item) => item.id !== notification.id),
            ].sort(
              (a, b) =>
                b.createdAt.localeCompare(a.createdAt) || b.id - a.id,
            )
          })
          setLatest(notification)
          refresh()
        },
      },
      onError: () => {
        setState('reconnecting')
        if (!checkingSession) {
          checkingSession = true
          void cache.invalidateQueries({ queryKey: sessionKey })
        }
      },
    })
  }, [
    cache,
    companyId,
    role,
    scope,
    transition.generation,
    transition.switching,
  ])

  useEffect(() => {
    if (!latest) return
    const timeout = setTimeout(() => setLatest(null), 10_000)
    return () => clearTimeout(timeout)
  }, [latest])

  return { state, latest, dismiss: () => setLatest(null) }
}
