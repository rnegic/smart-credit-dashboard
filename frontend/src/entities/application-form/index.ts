import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { apiOptionalRequest, useApiScope } from '@/shared/api'

const optionalTextSchema = z.string().nullable()
const optionalNumberSchema = z.number().nullable()
const requiredText = (message: string) =>
  z.string({ error: message }).trim().min(1, message)

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
  kpp: optionalTextSchema.optional(),
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
      annualRevenue: optionalNumberSchema.optional(),
      averageEmployeeCount: z.number().int().nullable().optional(),
      otherMonthlyObligations: optionalNumberSchema.optional(),
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

/** Bank form data may be incomplete in historical applications. */
export const applicationBusinessSummarySchema = z
  .object({
    step2_businessData: z
      .object({
        applicant: applicationApplicantSchema
          .pick({
            type: true,
            companyName: true,
            ogrn: true,
            kpp: true,
            registrationDate: true,
            mainOkved: true,
          })
          .partial()
          .nullish(),
        financials:
          applicationFormSchema.shape.step2_businessData.shape.financials
            .partial()
            .nullish(),
      })
      .nullish(),
  })
  .nullable()

/** Required submission fields; incoming forms and drafts may remain incomplete. */
export const applicationApplicantSubmissionSchema =
  applicationApplicantSchema.extend({
    type: z.literal('IP'),
    companyName: requiredText('Укажите название'),
    inn: requiredText('Укажите ИНН').regex(
      /^\d{12}$/,
      'ИНН ИП должен содержать 12 цифр',
    ),
    taxSystem: requiredText('Выберите систему налогообложения'),
    firstName: requiredText('Укажите фамилию и имя предпринимателя'),
    lastName: requiredText('Укажите фамилию и имя предпринимателя'),
    ogrnip: requiredText('Укажите ОГРНИП').regex(
      /^\d{15}$/,
      'ОГРНИП должен содержать 15 цифр',
    ),
    // Registry metadata is supplied by the server; it may be absent on submission.
    registrationDate: z.iso
      .date({ error: 'Укажите дату регистрации в формате ДД.ММ.ГГГГ' })
      .refine(
        (value) => new Date(`${value}T00:00:00`) <= new Date(),
        'Дата регистрации не может быть в будущем',
      )
      .nullable(),
    mainOkved: requiredText('Укажите основной ОКВЭД').regex(
      /^\d{2}(?:\.\d{1,2}){0,2}$/,
      'Укажите код ОКВЭД, например 47.11',
    ),
    industry: requiredText('Выберите группу отраслей'),
    registrationAddress: requiredText('Укажите адрес регистрации'),
    phone: requiredText('Укажите телефон').refine(
      (value) =>
        /^\+?[\d\s()-]+$/.test(value) &&
        value.replace(/\D/g, '').length >= 10 &&
        value.replace(/\D/g, '').length <= 15,
      'Укажите телефон: от 10 до 15 цифр',
    ),
    email: requiredText('Укажите email').pipe(
      z.email({ error: 'Укажите корректный email' }),
    ),
  })

/** Corporate applicants have their own registry identifiers and tax regimes. */
export const oooApplicantSubmissionSchema = applicationApplicantSchema.extend({
  ...applicationApplicantSubmissionSchema.pick({
    registrationDate: true,
    mainOkved: true,
    industry: true,
    phone: true,
    email: true,
  }).shape,
  type: z.literal('OOO'),
  companyName: requiredText('Укажите наименование организации').max(
    255,
    'Наименование должно быть не длиннее 255 символов',
  ),
  inn: requiredText('Укажите ИНН организации').regex(
    /^\d{10}$/,
    'ИНН ООО должен содержать 10 цифр',
  ),
  ogrn: requiredText('Укажите ОГРН').regex(
    /^\d{13}$/,
    'ОГРН должен содержать 13 цифр',
  ),
  kpp: requiredText('Укажите КПП').regex(
    /^\d{9}$/,
    'КПП должен содержать 9 цифр',
  ),
  taxSystem: z.enum(['OSNO', 'USN', 'AUSN', 'ESHN', 'OTHER'], {
    error: 'Выберите систему налогообложения ООО',
  }),
  registrationAddress: requiredText('Укажите юридический адрес'),
})

const financialsSubmissionSchema = z.object({
  monthlyRevenue: z
    .number({ error: 'Укажите среднемесячную выручку' })
    .positive('Среднемесячная выручка должна быть больше 0 ₽'),
  existingDebt: z
    .number({ error: 'Укажите ежемесячный платеж от 0 ₽' })
    .min(0, 'Платеж не может быть отрицательным'),
})

/** Annual revenue and headcount are supplied independently for server scoring. */
export const oooFinancialsSubmissionSchema = financialsSubmissionSchema.extend({
  annualRevenue: z
    .number({ error: 'Укажите годовую выручку от 0 ₽' })
    .min(0, 'Годовая выручка не может быть отрицательной'),
  averageEmployeeCount: z
    .number({ error: 'Укажите среднесписочную численность' })
    .int('Численность должна быть целым числом')
    .min(0, 'Численность не может быть отрицательной')
    .max(2_147_483_647, 'Укажите корректную численность'),
  otherMonthlyObligations: z
    .number({ error: 'Укажите иные обязательства от 0 ₽' })
    .min(0, 'Иные обязательства не могут быть отрицательными'),
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
  step2_businessData: z.union([
    z.object({
      applicant: applicationApplicantSubmissionSchema,
      financials: financialsSubmissionSchema,
    }),
    z.object({
      applicant: oooApplicantSubmissionSchema,
      financials: oooFinancialsSubmissionSchema,
    }),
  ]),
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
