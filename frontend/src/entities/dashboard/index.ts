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
      ]),
      title: z.string(),
    }),
  ),
  offers: z.array(
    z.object({
      id: z.number().int(),
      amount: z.number(),
      termDays: z.number().int(),
      finalRate: z.number(),
      monthlyPayment: z.number(),
      validUntil: z.iso.date(),
    }),
  ),
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
      return status === 'IN_REVIEW' || status === 'OFFER_READY' ? 15_000 : false
    },
  })
}
