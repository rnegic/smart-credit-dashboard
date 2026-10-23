import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { apiRequest, useApiScope } from '@/shared/api'

export const notificationSchema = z.object({
  id: z.number().int().positive(),
  text: z.string(),
  read: z.boolean(),
  createdAt: z.iso.datetime({ offset: true }),
})
export const notificationsSchema = z.array(notificationSchema)
export type Notification = z.infer<typeof notificationSchema>

/** Notifications are company-wide; caches remain isolated by authenticated user. */
export function useNotifications() {
  const scope = useApiScope()
  return useQuery({
    queryKey: ['client', scope, 'notifications'],
    queryFn: ({ signal }) =>
      apiRequest('/api/notifications', notificationsSchema, { signal }),
    enabled: scope !== null,
    staleTime: 30_000,
  })
}
