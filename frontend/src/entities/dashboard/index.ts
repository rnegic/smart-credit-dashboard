import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import {
  applicationDecisionSchema,
  applicationStatusSchema,
} from '@/entities/loan-application'
import { apiRequest, useApiScope } from '@/shared/api'

export const dashboardSchema = z.object({
  company: z.object({
    id: z.number().int(),
    name: z.string(),
    inn: z.string(),
    okved: z.string().nullable(),
    legalForm: z.string().nullable(),
    externalDemo: z
      .object({
        bkiScore: z.number().int(),
        delinquencies12m: z.number().int(),
        inquiries12m: z.number().int(),
        revenueTrend: z.enum(['GROWING', 'STABLE', 'DECLINING']),
        companyAgeYears: z.number().int(),
      })
      .nullish(),
  }),
  currentApplication: z
    .object({
      id: z.number().int(),
      amount: z.number(),
      termDays: z.number().int(),
      contractTermMonths: z.union([z.literal(6), z.literal(12), z.literal(24)]).nullable(),
      rate: z.number().nullable(),
      purpose: z.string().nullable(),
      status: applicationStatusSchema,
      decision: applicationDecisionSchema.nullable(),
      finalRate: z.number().nullable(),
      createdAt: z.iso.datetime({ offset: true }),
    })
    .nullable(),
  stages: z.array(
    z.object({
      code: z.enum(['SUBMITTED', 'REVIEW', 'OFFER', 'SIGNING', 'ISSUED']),
      title: z.string(),
      state: z.enum(['DONE', 'CURRENT', 'PENDING']),
    }),
  ),
  requiredActions: z.array(
    z.object({
      code: z.enum([
        'CREATE_APPLICATION',
        'ACCEPT_OFFER',
        'SIGN_DOCUMENTS',
        'ISSUE_TRANCHE',
        'REPAY_TRANCHE',
      ]),
      title: z.string(),
    }),
  ),
  offers: z.array(
    z.object({
      id: z.number().int(),
      amount: z.number(),
      termDays: z.number().int(),
      contractTermMonths: z.union([z.literal(6), z.literal(12), z.literal(24)]).nullable(),
      finalRate: z.number(),
      monthlyPayment: z.number(),
      validUntil: z.iso.date(),
    }),
  ),
  activeContract: z.object({
    id: z.number().int().positive(),
    applicationId: z.number().int().positive(),
    status: z.enum(['ACTIVE', 'EXPIRED']),
    contractTermMonths: z.union([z.literal(6), z.literal(12), z.literal(24)]),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    limit: z.number().nonnegative(),
    usedLimit: z.number().nonnegative(),
    availableLimit: z.number().nonnegative(),
    outstandingPrincipal: z.number().nonnegative(),
    revolving: z.boolean(),
    canIssueTranche: z.boolean(),
    issueBlockedReason: z.enum([
      'CONTRACT_EXPIRED', 'HAS_OVERDUE_TRANCHE', 'LIMIT_EXHAUSTED', 'CONTRACT_ENDING', 'RATE_UNAVAILABLE',
    ]).nullable(),
    trancheTerms: z.object({
      termDays: z.union([z.literal(30), z.literal(60), z.literal(90)]),
      ratePercent: z.number().nonnegative().nullable(),
      dueDate: z.iso.date(),
      available: z.boolean(),
    }),
  }).nullable(),
  activeLoan: z
    .object({
      id: z.number().int(),
      principal: z.number(),
      ratePercent: z.number(),
      termMonths: z.number().int(),
      monthlyPayment: z.number(),
      remainingBalance: z.number(),
      startDate: z.iso.date(),
    })
    .nullable(),
  nextPayment: z
    .object({ id: z.number().int(), dueDate: z.iso.date(), amount: z.number() })
    .nullable(),
  unreadNotifications: z.number().int().nonnegative(),
})
export type Dashboard = z.infer<typeof dashboardSchema>
/** Load the current client's dashboard and refresh pending credit decisions. */
export function useDashboard() {
  const scope = useApiScope()
  return useQuery({
    queryKey: ['client', scope, 'dashboard'],
    queryFn: ({ signal }) =>
      apiRequest('/api/dashboard', dashboardSchema, { signal }),
    enabled: scope !== null,
    refetchInterval: (query) => {
      const status = query.state.data?.currentApplication?.status
      return status === 'IN_REVIEW' || status === 'OFFER_READY' || status === 'SIGNATURE_PENDING' ? 15_000 : false
    },
  })
}
