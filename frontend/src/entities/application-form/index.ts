import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { apiOptionalRequest, useApiScope } from '@/shared/api'

const optionalTextSchema = z.string().nullable()
const optionalNumberSchema = z.number().nullable()

export const applicationApplicantSchema = z.object({
  type: optionalTextSchema,
  companyName: optionalTextSchema,
  inn: optionalTextSchema,
  taxSystem: optionalTextSchema,
  firstName: optionalTextSchema,
  lastName: optionalTextSchema,
  middleName: optionalTextSchema,
  ogrnip: optionalTextSchema,
  ogrn: optionalTextSchema,
  registrationDate: z.iso.date().nullable(),
  mainOkved: optionalTextSchema,
  industry: optionalTextSchema,
  phone: optionalTextSchema,
  email: optionalTextSchema,
  registrationAddress: optionalTextSchema,
})

export const applicationFormSchema = z.object({
  applicationId: optionalTextSchema,
  createdAt: z.iso.datetime({ offset: true }).nullable(),
  status: optionalTextSchema,
  step1_financingParameters: z.object({
    businessTask: optionalTextSchema,
    amount: optionalNumberSchema,
    termDays: z.number().int().nullable(),
    rate: optionalNumberSchema.optional(),
    purpose: optionalTextSchema,
  }),
  step2_businessData: z.object({
    applicant: applicationApplicantSchema,
    financials: z.object({
      monthlyRevenue: optionalNumberSchema,
      existingDebt: optionalNumberSchema,
    }),
  }),
  prefilled: z
    .object({
      source: optionalTextSchema,
      fetchedAt: z.iso.datetime({ offset: true }).nullable(),
      confirmedByUser: z.boolean().nullable(),
    })
    .nullable(),
  step3_verification: z.object({
    consents: z.object({
      personalData: z.boolean(),
      bkiRequest: z.boolean(),
      fnsRequest: z.boolean(),
      acceptedAt: z.iso.datetime({ offset: true }).nullable(),
    }),
  }),
  meta: z
    .object({
      formVersion: optionalTextSchema,
      events: z.array(z.string()).nullable(),
    })
    .nullable(),
})

export const prefillResponseSchema = z.object({
  form: applicationFormSchema,
  aiFilled: z.array(z.string()),
  missingFields: z.array(z.string()),
})

export const applicationFormSubmissionSchema = applicationFormSchema.extend({
  step1_financingParameters: z.object({
    businessTask: z.string().trim().min(1, 'Опишите бизнес-задачу').max(500),
    amount: z
      .number()
      .min(50_000, 'Минимальная сумма 50 000 ₽')
      .max(20_000_000, 'Максимальная сумма 20 000 000 ₽'),
    termDays: z.union([z.literal(30), z.literal(60), z.literal(90)], {
      error: 'Выберите срок 30, 60 или 90 дней',
    }),
    purpose: z.string().trim().min(1, 'Укажите цель финансирования').max(100),
  }),
  step2_businessData: z.object({
    applicant: applicationApplicantSchema,
    financials: z.object({
      monthlyRevenue: z
        .number()
        .positive('Среднемесячная выручка должна быть больше 0 ₽'),
      existingDebt: z
        .number()
        .min(0, 'Задолженность не может быть отрицательной')
        .default(0),
    }),
  }),
  step3_verification: z.object({
    consents: z.object({
      personalData: z.literal(true, {
        error: 'Подтвердите обработку персональных данных',
      }),
      bkiRequest: z.literal(true, {
        error: 'Разрешите запрос кредитной истории',
      }),
      fnsRequest: z.literal(true, {
        error: 'Разрешите получение сведений ФНС',
      }),
      acceptedAt: z.iso.datetime({ offset: true }),
    }),
  }),
})

export type ApplicationForm = z.infer<typeof applicationFormSchema>
export type ApplicationFormSubmission = z.infer<
  typeof applicationFormSubmissionSchema
>
export type PrefillResponse = z.infer<typeof prefillResponseSchema>

/** Drop obsolete annotations from persisted drafts without converting values. */
export const applicationDraftPathsSchema = z
  .array(z.string())
  .transform((paths) =>
    paths.filter(
      (path) =>
        path !== 'step1_financingParameters.termMonths' &&
        path !== 'step2_businessData.financials.existingMonthlyDebtPayment',
    ),
  )

export const applicationDraftSchema = z.object({
  form: applicationFormSchema,
  currentStep: z.number().int().min(0).max(3),
  aiFilled: applicationDraftPathsSchema,
  missingFields: applicationDraftPathsSchema,
  revision: z.number().int().nonnegative(),
  updatedAt: z.iso.datetime({ offset: true }),
})
export type ApplicationDraft = z.infer<typeof applicationDraftSchema>

export function useApplicationDraft() {
  const scope = useApiScope()
  return useQuery({
    queryKey: ['client', scope, 'application-draft'],
    queryFn: ({ signal }) =>
      apiOptionalRequest('/api/applications/draft', applicationDraftSchema, {
        signal,
      }),
    enabled: scope !== null,
    staleTime: 0,
    retry: false,
  })
}
