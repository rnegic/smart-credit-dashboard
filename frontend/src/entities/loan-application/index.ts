import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { apiRequest, useApiScope } from '@/shared/api'

export {
  getApplicationProgress,
  type ApplicationProgressStage,
} from './get-application-progress'

export const applicationStatusSchema = z.enum([
  'IN_REVIEW',
  'OFFER_READY',
  'ACCEPTED',
  'DECLINED',
])
export const applicationDecisionSchema = z.enum([
  'INFO_REQUIRED',
  'DECLINED',
  'APPROVED',
  'ALTERNATIVE_OFFER',
  'MANUAL_REVIEW',
])
const riskClassSchema = z.enum(['A', 'B', 'C', 'D'])
const internalScoreSchema = z.number().int().min(0).max(100)
const scoringSchema = z.object({
  rate: z.number().nullable(),
  termMonthsEquivalent: z.number(),
  newMonthlyPayment: z.number().nullable(),
  dtiPercent: z.number(),
  amountToRevenue: z.number(),
  isDataComplete: z.boolean(),
  internalScore: internalScoreSchema,
  riskClass: riskClassSchema,
  bkiZone: z.enum(['RED', 'YELLOW', 'GREEN']).nullable(),
  industryLimitCoef: z.number(),
  industryRatePremium: z.number(),
  absoluteMaxAmount: z.number(),
  calculatedLimit: z.number().nullable(),
  external: z
    .object({
      bkiScore: z.number().int(),
      delinquencies12m: z.number().int(),
      inquiries12m: z.number().int(),
      activeLoans: z.number().int(),
      revenueTrend: z.enum(['GROWING', 'STABLE', 'DECLINING']),
      companyAgeYears: z.number().int(),
    })
    .nullable(),
  points: z.record(z.string(), z.number().int()).nullable(),
})
export const applicationSchema = z.object({
  id: z.number().int().positive(),
  amount: z.number(),
  termDays: z.number().int(),
  rate: z.number().nullable(),
  purpose: z.string().nullable(),
  status: applicationStatusSchema,
  decision: applicationDecisionSchema.nullable(),
  finalRate: z.number().nullable(),
  createdAt: z.iso.datetime({ offset: true }),
})
export const offerSchema = z.object({
  id: z.number().int().positive(),
  amount: z.number(),
  termDays: z.number().int(),
  finalRate: z.number(),
  monthlyPayment: z.number(),
  validUntil: z.iso.date(),
  status: z.enum(['ACTIVE', 'ACCEPTED', 'EXPIRED']),
})
export const applicationViewSchema = applicationSchema.extend({
  businessTask: z.string().nullable(),
  companyName: z.string(),
  inn: z.string(),
  legalForm: z.string().nullable(),
  internalScore: internalScoreSchema.nullable(),
  riskClass: riskClassSchema.nullable(),
  aiComment: z.string().nullable(),
  officerComment: z.string().nullable(),
  scoring: scoringSchema.nullable(),
  offer: offerSchema.nullable(),
})
export const applicationViewsSchema = z.array(applicationViewSchema)
export const createApplicationSchema = z.object({
  amount: z
    .number()
    .min(50_000, 'Минимальная сумма 50 000 ₽')
    .max(20_000_000, 'Максимальная сумма 20 000 000 ₽'),
  termDays: z.union([z.literal(30), z.literal(60), z.literal(90)], {
    error: 'Выберите срок 30, 60 или 90 дней',
  }),
  purpose: z
    .string()
    .trim()
    .min(1, 'Укажите цель финансирования')
    .max(100, 'Не более 100 символов'),
})
export type Application = z.infer<typeof applicationSchema>
export type ApplicationView = z.infer<typeof applicationViewSchema>
export type Offer = z.infer<typeof offerSchema>
export const applicationStatusLabels = {
  IN_REVIEW: 'На рассмотрении',
  OFFER_READY: 'Предложение банка',
  ACCEPTED: 'Предложение принято',
  DECLINED: 'Отказ по заявке',
} as const
export const applicationDecisionLabels = {
  INFO_REQUIRED: 'Нужны дополнительные сведения',
  DECLINED: 'Отказ',
  APPROVED: 'Одобрено',
  ALTERNATIVE_OFFER: 'Предложены другие условия',
  MANUAL_REVIEW: 'Ручная проверка',
} as const

/** Load applications under the current session's isolated query key. */
export function useApplications() {
  const scope = useApiScope()
  return useQuery({
    queryKey: ['client', scope, 'applications'],
    queryFn: ({ signal }) =>
      apiRequest('/api/applications', applicationViewsSchema, { signal }),
    enabled: scope !== null,
    refetchInterval: (query) =>
      query.state.data?.some(
        (application) =>
          application.status === 'IN_REVIEW' ||
          application.status === 'OFFER_READY',
      )
        ? 15_000
        : false,
  })
}
