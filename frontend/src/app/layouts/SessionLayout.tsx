import { useEffect } from 'react'
import { matchPath, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useSession, useSessionIntegration } from '@/entities/session'
import { ApiScopeContext, useSessionTransition } from '@/shared/api'
import { ROUTES } from '@/shared/config'
import { RequestState } from '@/shared/ui'
import { BankSkeleton } from './BankSkeleton'
import { CabinetSkeleton } from './CabinetSkeleton'

export function SessionLayout() {
  const session = useSession()
  const transition = useSessionTransition()
  useSessionIntegration()
  const cache = useQueryClient()
  const location = useLocation()
  const isLoginRoute =
    matchPath({ path: ROUTES.login, end: true }, location.pathname) !== null
  const isBankRoute =
    matchPath({ path: ROUTES.bank, end: true }, location.pathname) !== null
  const pendingFallback = isLoginRoute ? (
    <RequestState />
  ) : isBankRoute ? (
    <BankSkeleton />
  ) : (
    <CabinetSkeleton />
  )
  useEffect(() => {
    const currentUserId = session.data?.userId
    if (currentUserId !== undefined) {
      const otherUser = (query: { queryKey: readonly unknown[] }) =>
        (query.queryKey[0] === 'client' || query.queryKey[0] === 'bank') &&
        query.queryKey[1] !== currentUserId
      void cache.cancelQueries({ predicate: otherUser })
      cache.removeQueries({ predicate: otherUser })
    }
    if (session.data === null) {
      void cache.cancelQueries({
        predicate: (q) =>
          q.queryKey[0] !== 'session' && q.queryKey[0] !== 'demo-profiles',
      })
      cache.removeQueries({
        predicate: (q) =>
          q.queryKey[0] !== 'session' && q.queryKey[0] !== 'demo-profiles',
      })
    }
  }, [cache, session.data])
  if (transition.switching) return isLoginRoute ? <Outlet /> : pendingFallback
  if (session.isPending || (!isLoginRoute && !session.data && session.isFetching))
    return pendingFallback
  if (session.error)
    return (
      <RequestState
        error={session.error}
        retry={() => {
          void session.refetch()
        }}
      />
    )
  if (!session.data)
    return isLoginRoute ? <Outlet /> : <Navigate to={ROUTES.login} replace />
  const isBank = session.data.role === 'BANK_OFFICER'
  if (isLoginRoute || (isBank && !isBankRoute) || (!isBank && isBankRoute))
    return <Navigate to={isBank ? ROUTES.bank : ROUTES.dashboard} replace />
  return (
    <ApiScopeContext.Provider value={session.data.userId}>
      <div key={session.data.userId}>
        {transition.error && <RequestState error={transition.error} />}
        <Outlet />
      </div>
    </ApiScopeContext.Provider>
  )
}
