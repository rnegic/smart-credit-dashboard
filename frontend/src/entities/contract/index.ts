import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { apiRequest, ApiError, useApiScope } from '@/shared/api'

/** An overdraft's fixed terms and server-calculated repayment amount. */
export const trancheSchema = z.object({
  id: z.number().int().positive(),
  contractId: z.number().int().positive(),
  amount: z.number().positive(),
  termDays: z.union([z.literal(30), z.literal(60), z.literal(90)]),
  ratePercent: z.number().nonnegative(),
  issuedAt: z.iso.date(),
  dueDate: z.iso.date(),
  status: z.enum(['ACTIVE', 'OVERDUE', 'REPAID']),
  accruedInterest: z.number().nonnegative(),
  totalToRepay: z.number().nonnegative(),
  repaidAt: z.iso.date().nullable(),
})

/** Signed contracts expose authoritative limits and agreed fixed tranche terms. */
export const contractSchema = z.object({
  id: z.number().int().positive(),
  applicationId: z.number().int().positive(),
  status: z.enum(['ACTIVE', 'EXPIRED']),
  contractTermMonths: z.union([z.literal(6), z.literal(12), z.literal(24)]),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  limit: z.number().nonnegative(),
  usedLimit: z.number().nonnegative(),
  availableLimit: z.number().nonnegative(),
  revolving: z.boolean(),
  outstandingPrincipal: z.number().nonnegative(),
  minTrancheAmount: z.number().positive(),
  canIssueTranche: z.boolean(),
  issueBlockedReason: z.enum([
    'CONTRACT_EXPIRED',
    'HAS_OVERDUE_TRANCHE',
    'LIMIT_EXHAUSTED',
    'CONTRACT_ENDING',
    'RATE_UNAVAILABLE',
  ]).nullable(),
  trancheTerms: z.object({
    termDays: z.union([z.literal(30), z.literal(60), z.literal(90)]),
    ratePercent: z.number().nonnegative().nullable(),
    dueDate: z.iso.date(),
    available: z.boolean(),
  }),
  tranches: z.array(trancheSchema),
})

/** POST amounts are rubles, not the AmountInput's minor units. */
export const trancheRequestSchema = z.object({
  amount: z.number({ error: 'Укажите сумму транша' }).positive('Укажите сумму транша')
    .multipleOf(0.01, 'Укажите сумму с точностью до копеек'),
})

export type Contract = z.infer<typeof contractSchema>
export type Tranche = z.infer<typeof trancheSchema>
export type TrancheRequest = z.infer<typeof trancheRequestSchema>

export const trancheStatusLabels: Record<Tranche['status'], string> = {
  ACTIVE: 'Активен',
  OVERDUE: 'Просрочен',
  REPAID: 'Погашен',
}

export const contractIssueBlockedLabels = {
  CONTRACT_EXPIRED: 'Срок договора истёк. Новые транши недоступны.',
  HAS_OVERDUE_TRANCHE: 'Погасите просроченные транши, чтобы получить новый.',
  LIMIT_EXHAUSTED: 'Доступный лимит меньше минимальной суммы транша.',
  CONTRACT_ENDING: 'Согласованный срок транша не помещается в оставшийся срок договора. Новые транши недоступны.',
  RATE_UNAVAILABLE: 'Согласованная ставка по договору недоступна. Получение новых траншей невозможно.',
} satisfies Record<NonNullable<Contract['issueBlockedReason']>, string>

/** Keep contracts isolated by the authenticated user, like the other entities. */
export const contractsKey = (scope: number | null) => ['client', scope, 'contracts'] as const
export const contractKey = (scope: number | null, id: number | undefined) =>
  [...contractsKey(scope), id] as const

/** Read the latest terms before a financial action. */
export async function getContract(id: number, signal?: AbortSignal) {
  const contract = await apiRequest(`/api/contracts/${id}`, contractSchema, { signal })
  if (contract.id !== id)
    throw new ApiError(200, 'INVALID_RESPONSE', 'Сервер вернул другой договор.')
  return contract
}

/** Fetch all signed contracts, including expired ones with outstanding tranches. */
export function useContracts(enabled = true) {
  const scope = useApiScope()
  return useQuery({
    queryKey: contractsKey(scope),
    queryFn: ({ signal }) => apiRequest('/api/contracts', z.array(contractSchema), { signal }),
    enabled: scope !== null && enabled,
    staleTime: 0,
  })
}

/** Refresh a selected contract when it is opened or the window regains focus. */
export function useContract(id: number | undefined, enabled = true) {
  const scope = useApiScope()
  return useQuery({
    queryKey: contractKey(scope, id),
    queryFn: ({ signal }) => {
      if (id === undefined) throw new Error('Договор не выбран')
      return getContract(id, signal)
    },
    enabled: scope !== null && id !== undefined && enabled,
    staleTime: 0,
  })
}

/** Issue one tranche; callers must never automatically retry this POST. */
export async function issueTranche(contractId: number, input: TrancheRequest) {
  const tranche = await apiRequest(`/api/contracts/${contractId}/tranches`, trancheSchema, {
    method: 'POST',
    body: JSON.stringify(trancheRequestSchema.parse(input)),
  })
  if (tranche.contractId !== contractId)
    throw new ApiError(201, 'INVALID_RESPONSE', 'Сервер не подтвердил выдачу транша по выбранному договору.')
  return tranche
}

/** Fully repay a tranche through the backend's idempotent operation. */
export async function repayTranche(id: number) {
  const tranche = await apiRequest(`/api/tranches/${id}/repay`, trancheSchema, { method: 'POST' })
  if (tranche.id !== id || tranche.status !== 'REPAID')
    throw new ApiError(200, 'INVALID_RESPONSE', 'Сервер не подтвердил погашение выбранного транша.')
  return tranche
}
