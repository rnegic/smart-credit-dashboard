import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { apiRequest, ApiError, useApiScope } from '@/shared/api'

/** Contacts returned by the authenticated profile endpoint, including empty values. */
export const profileSchema = z.object({
  userId: z.number().int().positive(),
  fullName: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
})

/** Both fields are required in PUT; empty strings and null clear a contact. */
export const profileContactsSchema = z.object({
  phone: z
    .string()
    .regex(/^$|^\+?[0-9][0-9\-\s()]{9,18}$/, 'Некорректный номер телефона')
    .nullable(),
  email: z
    .union([
      z.literal(''),
      z.email({ error: 'Укажите корректный email' }).max(
        255,
        'Email не должен превышать 255 символов',
      ),
    ])
    .nullable(),
})

export type Profile = z.infer<typeof profileSchema>
export type ProfileContactsInput = z.infer<typeof profileContactsSchema>

/** Isolate client profile data by the authenticated user, not by company. */
export const profileKey = (scope: number | null) =>
  ['client', scope, 'profile'] as const

/** Read the current user's contacts through the shared session-fenced transport. */
export function useProfile() {
  const scope = useApiScope()
  return useQuery({
    queryKey: profileKey(scope),
    queryFn: async ({ signal }) => {
      const profile = await apiRequest('/api/profile', profileSchema, { signal })
      if (profile.userId !== scope)
        throw new ApiError(
          200,
          'INVALID_RESPONSE',
          'Не удалось проверить владельца профиля.',
        )
      return profile
    },
    enabled: scope !== null,
    staleTime: 0,
    retry: false,
  })
}
