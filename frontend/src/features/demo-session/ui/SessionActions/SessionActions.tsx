import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@alfalab/core-components/button'
import { LogOutMIcon } from '@alfalab/icons/glyph/dist/LogOutMIcon'
import { changeSession } from '@/entities/session'
import { apiEmpty, useSessionTransition } from '@/shared/api'

/** Selects an icon-only or labeled sign-out control. */
export interface SessionActionsProps {
  compact?: boolean
}
/** Signs out through the shared cookie-session transition. */
export function SessionActions({ compact = false }: SessionActionsProps) {
  const cache = useQueryClient()
  const transition = useSessionTransition()
  const logout = useMutation({
    networkMode: 'always',
    mutationFn: () =>
      changeSession(cache, async () => {
        await apiEmpty('/api/auth/logout', { method: 'POST' })
        return null
      }),
  })
  return (
    <div>
      <Button
        type="button"
        view="transparent"
        size={compact ? 40 : 48}
        aria-label={compact ? 'Выйти' : undefined}
        title={compact ? 'Выйти' : undefined}
        loading={logout.isPending}
        disabled={transition.switching || logout.isPending}
        onClick={() => logout.mutate()}
      >
        {compact ? (
          <LogOutMIcon aria-hidden="true" focusable="false" />
        ) : (
          'Выйти из аккаунта'
        )}
      </Button>
      {logout.error && <p role="alert">{logout.error.message}</p>}
    </div>
  )
}
