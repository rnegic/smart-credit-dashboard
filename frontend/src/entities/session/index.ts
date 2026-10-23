import { useEffect } from 'react'
import { z } from 'zod'
import {
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import {
  apiRequest,
  ApiError,
  beginSessionChange,
  endSessionChange,
  completeSessionRefresh,
  getSessionGeneration,
  hasActiveSessionChange,
  isSessionSwitching,
  sessionEvents,
  syncSessionChanges,
  useSessionTransition,
  type SessionChangeEvent,
} from '@/shared/api'

export const sessionSchema = z.object({
  userId: z.number().int().positive(),
  fullName: z.string(),
  role: z.enum(['CLIENT', 'BANK_OFFICER']),
  companyId: z.number().int().positive().nullable(),
  legalForm: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
})
export const demoProfilesSchema = z.array(
  z.object({
    login: z.string(),
    password: z.string(),
    role: z.enum(['CLIENT', 'BANK_OFFICER']),
    fullName: z.string(),
    description: z.string().nullable(),
  }),
)
export type Session = z.infer<typeof sessionSchema>
export type DemoProfile = z.infer<typeof demoProfilesSchema>[number]
export const sessionKey = ['session'] as const

/** Accept private cache updates only for the initiating account and generation. */
export function isCurrentSession(
  cache: QueryClient,
  scope: number | null,
  generation: number,
) {
  syncSessionChanges()
  return (
    scope !== null &&
    generation === getSessionGeneration() &&
    !isSessionSwitching() &&
    cache.getQueryData<Session | null>(sessionKey)?.userId === scope
  )
}

async function fetchSession(signal: AbortSignal) {
  try {
    return await apiRequest('/api/auth/me', sessionSchema, { signal })
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null
    throw error
  }
}

/** Preserve the observed session query while discarding private data and settled mutations. */
export function resetSession(cache: QueryClient, session: Session | null) {
  void cache.cancelQueries()
  cache.setQueryData(sessionKey, session)
  cache.removeQueries({
    predicate: (query) =>
      query.queryKey[0] !== 'session' && query.queryKey[0] !== 'demo-profiles',
  })
  const mutations = cache.getMutationCache()
  mutations
    .getAll()
    .filter((mutation) => mutation.state.status !== 'pending')
    .forEach((mutation) => mutations.remove(mutation))
}

/** Own authentication transitions outside components that are unmounted by the UI fence. */
export async function changeSession(
  cache: QueryClient,
  operation: () => Promise<Session | null>,
) {
  if (cache.isMutating() > 1)
    throw new Error(
      'Дождитесь завершения текущего действия перед сменой профиля.',
    )
  const change = beginSessionChange()
  resetSession(cache, null)
  try {
    const session = await operation()
    syncSessionChanges()
    const current = change.generation === getSessionGeneration()
    if (current) resetSession(cache, session)
    endSessionChange(change, !current)
    return session
  } catch (error) {
    endSessionChange(
      change,
      true,
      error instanceof Error
        ? error
        : new Error('Не удалось сменить профиль. Повторите попытку.'),
    )
    throw error
  }
}

/** Attach the current QueryClient to cross-tab lifecycle notifications. */
export function useSessionIntegration() {
  const cache = useQueryClient()
  useEffect(() => {
    let mounted = true
    let refreshAttempt = 0
    const started = () => resetSession(cache, null)
    const refresh = () => {
      if (hasActiveSessionChange()) return
      const attempt = ++refreshAttempt
      resetSession(cache, null)
      const generation = getSessionGeneration()
      void cache
        .fetchQuery({
          queryKey: sessionKey,
          queryFn: ({ signal }) => fetchSession(signal),
          staleTime: 0,
          retry: false,
          networkMode: 'always',
        })
        .catch(() => undefined)
        .finally(() => {
          if (mounted && attempt === refreshAttempt)
            completeSessionRefresh(generation)
        })
    }
    const ended = (event: Event) => {
      if ((event as CustomEvent<SessionChangeEvent>).detail.refresh) refresh()
    }
    sessionEvents.addEventListener('change-start', started)
    sessionEvents.addEventListener('change-end', ended)
    sessionEvents.addEventListener('expired', started)
    syncSessionChanges()
    if (isSessionSwitching() && !hasActiveSessionChange()) refresh()
    return () => {
      mounted = false
      sessionEvents.removeEventListener('change-start', started)
      sessionEvents.removeEventListener('change-end', ended)
      sessionEvents.removeEventListener('expired', started)
    }
  }, [cache])
}

/** Observe the stable session query, pausing polling during authentication changes. */
export function useSession() {
  const transition = useSessionTransition()
  return useQuery({
    queryKey: sessionKey,
    queryFn: ({ signal }) => fetchSession(signal),
    enabled: !hasActiveSessionChange(),
    networkMode: 'always',
    staleTime: 0,
    retry: false,
    refetchInterval: transition.switching ? false : 30_000,
  })
}
