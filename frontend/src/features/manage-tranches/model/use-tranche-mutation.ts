import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isCurrentSession } from '@/entities/session'
import { contractIssueBlockedLabels, type Tranche } from '@/entities/contract'
import { ApiError, useApiScope, useSessionTransition } from '@/shared/api'

/** Fence financial actions and refresh private data only for their original session. */
export function useTrancheMutation<T>(operation: (input: T, assertCurrent: () => void) => Promise<Tranche>) {
  const cache = useQueryClient()
  const scope = useApiScope()
  const { generation } = useSessionTransition()
  function assertCurrent() {
    if (!isCurrentSession(cache, scope, generation))
      throw new ApiError(409, 'SESSION_CHANGED', 'Профиль изменился. Повторите действие.')
  }
  return useMutation({
    mutationFn: (input: T) => {
      assertCurrent()
      return operation(input, assertCurrent)
    },
    onSettled: async () => {
      if (isCurrentSession(cache, scope, generation))
        await cache.invalidateQueries({ queryKey: ['client', scope] })
    },
    retry: false,
  })
}

/** A failed response may hide a committed non-idempotent issuance. */
export function isIssuanceUncertain(error: Error | null) {
  return error instanceof ApiError &&
    (error.status === 0 || error.status >= 500 || error.code === 'INVALID_RESPONSE')
}

/** Known backend codes remain readable even if a server message is unavailable. */
export function getTrancheErrorMessage(error: Error) {
  const messages: Record<string, string> = {
    ...contractIssueBlockedLabels,
    CONTRACT_NOT_ACTIVE: 'Договор ещё не подписан. Получить транш пока нельзя.',
    CONTRACT_EXPIRED: 'Срок договора истёк. Новые транши недоступны.',
    HAS_OVERDUE_TRANCHE: 'Сначала погасите просроченные транши.',
    TRANCHE_AMOUNT_TOO_SMALL: 'Сумма меньше минимальной суммы транша.',
    LIMIT_EXCEEDED: 'Сумма превышает доступный лимит договора.',
    TRANCHE_EXCEEDS_CONTRACT: contractIssueBlockedLabels.CONTRACT_ENDING,
  }
  return error instanceof ApiError
    ? messages[error.code] ?? error.message
    : error.message
}
