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
export const applicationSchema = z.object({
  id: z.number().int().positive(),
  amount: z.number(),
  termMonths: z.number().int(),
  purpose: z.string().nullable(),
  status: applicationStatusSchema,
  createdAt: z.iso.datetime({ offset: true }),
})
export const offerSchema = z.object({
  id: z.number().int().positive(),
  amount: z.number(),
  termMonths: z.number().int(),
  ratePercent: z.number(),
  monthlyPayment: z.number(),
  validUntil: z.iso.date(),
  status: z.enum(['ACTIVE', 'ACCEPTED', 'EXPIRED']),
})
export const applicationViewSchema = applicationSchema.extend({
  businessTask: z.string().nullable(),
  companyName: z.string(),
  inn: z.string(),
  legalForm: z.string().nullable(),
  riskScore: z.number().nullable(),
  riskClass: z.string().nullable(),
  aiComment: z.string().nullable(),
  officerComment: z.string().nullable(),
  offer: offerSchema.nullable(),
})
export const applicationViewsSchema = z.array(applicationViewSchema)
export const createApplicationSchema = z.object({
  amount: z.number().min(10_000, 'Минимальная сумма 10 000 ₽'),
  termMonths: z
    .number()
    .int('Укажите целое число месяцев')
    .min(1, 'Минимальный срок 1 месяц')
    .max(120, 'Максимальный срок 120 месяцев'),
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
