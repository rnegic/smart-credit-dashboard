import { z } from 'zod'
import { useSyncExternalStore } from 'react'
import {
  applicationApplicantSubmissionSchema,
  applicationDraftPathsSchema,
  applicationFormSchema,
  type ApplicationDraft,
} from '@/entities/application-form'

const draftSchema = z.object({
  description: z.string(),
  amount: z.string(),
  termDays: z.string(),
  contractTermMonths: z.string().default(''),
  purpose: z.string(),
  ipEdits: z
    .object({
      companyName: z.string(),
      inn: z.string(),
      legalForm: z.string(),
      taxSystem: z.string(),
      monthlyRevenue: z.string(),
      existingDebt: z.string(),
      personalData: z.boolean(),
      bkiRequest: z.boolean(),
      fnsRequest: z.boolean(),
      fullName: z.string(),
      ogrnip: z.string(),
      registrationDate: z.string(),
      okved: z.string(),
      registrationAddress: z.string(),
      phone: z.string(),
      email: z.string(),
      industry: z.string(),
    })
    .partial()
    .default({}),
  oooEdits: z
    .object({
      companyName: z.string(),
      inn: z.string(),
      taxSystem: z.string(),
      monthlyRevenue: z.string(),
      annualRevenue: z.string(),
      averageEmployeeCount: z.string(),
      existingDebt: z.string(),
      otherMonthlyObligations: z.string(),
      personalData: z.boolean(),
      bkiRequest: z.boolean(),
      fnsRequest: z.boolean(),
      ogrn: z.string(),
      kpp: z.string(),
      registrationDate: z.string(),
      okved: z.string(),
      registrationAddress: z.string(),
      phone: z.string(),
      email: z.string(),
      industry: z.string(),
    })
    .partial()
    .default({}),
  externalEdits: z
    .object({
      bkiScore: z.string(),
      delinquencies12m: z.string(),
      inquiries12m: z.string(),
      revenueTrend: z.string(),
      companyAgeYears: z.string(),
    })
    .partial()
    .default({}),
  currentStep: z.number().int().min(0).max(4).default(0),
  wizardVersion: z.literal(2).optional(),
  started: z.boolean().default(false),
  serverForm: applicationFormSchema.nullable().default(null),
  confirmed: z.boolean().default(false),
  needsDebtReview: z.boolean().default(false),
  acceptedAt: z.iso.datetime({ offset: true }).nullable().default(null),
  createdAt: z.iso
    .datetime({ offset: true })
    .default(() => new Date().toISOString()),
  aiFilled: applicationDraftPathsSchema.default([]),
  missingFields: applicationDraftPathsSchema.default([]),
  revision: z.number().int().nonnegative().nullable().default(null),
  updatedAt: z.iso
    .datetime({ offset: true })
    .default(() => new Date().toISOString()),
})

export const localDraftSchema = z.union([
  draftSchema,
  draftSchema
    .omit({ termDays: true, serverForm: true })
    .extend({ termMonths: z.string(), serverForm: z.unknown().optional() })
    .transform((draft) =>
      draftSchema.parse({
        ...draft,
        termDays: '',
        ipEdits: { ...draft.ipEdits, existingDebt: '' },
        oooEdits: { ...draft.oooEdits, existingDebt: '' },
        serverForm: null,
        currentStep: 0,
        needsDebtReview: true,
        missingFields: [
          ...draft.missingFields,
          'step1_financingParameters.termDays',
          'step2_businessData.financials.existingDebt',
        ],
      }),
    ),
]).transform((draft) => ({
  ...draft,
  currentStep:
    draft.wizardVersion !== 2 &&
    draft.serverForm?.step2_businessData.applicant.type === 'OOO' &&
    draft.currentStep >= 3
      ? draft.currentStep - 1
      : Math.min(draft.currentStep, 3),
  wizardVersion: 2 as const,
}))

export function loadLocalDraft(key: string) {
  try {
    const result = localDraftSchema.safeParse(
      JSON.parse(sessionStorage.getItem(key) ?? 'null'),
    )
    return result.success ? result.data : null
  } catch {
    return null
  }
}

function subscribe(callback: () => void) {
  window.addEventListener('application-draft-changed', callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener('application-draft-changed', callback)
    window.removeEventListener('storage', callback)
  }
}

export function useLocalDraft(key: string) {
  const value = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return sessionStorage.getItem(key)
      } catch {
        return null
      }
    },
    () => null,
  )
  if (!value) return null
  try {
    const result = localDraftSchema.safeParse(JSON.parse(value))
    return result.success ? result.data : null
  } catch {
    return null
  }
}

export function numberOrNull(value: string) {
  if (!value.trim()) return null
  const number = Number(value.replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(number) ? number : null
}

/** Corporate UI steps map to the three stages accepted by the draft API. */
export function getServerDraftStep(step: number, legalForm: string | null) {
  return legalForm === 'OOO' ? (step === 0 ? 0 : step < 3 ? 1 : 2) : step
}

/** Restore the UI step from supported form metadata, including on another device. */
export function getApplicationDraftStep(draft: ApplicationDraft | null) {
  if (!draft) return 0
  if (draft.form.step2_businessData.applicant.type !== 'OOO')
    return draft.currentStep
  const events = draft.form.meta?.events ?? []
  const event = events.find((item) => /^ooo_step_v2_[0-3]$/.test(item))
  const step = event ? Number(event.slice(-1)) : null
  if (step !== null && getServerDraftStep(step, 'OOO') === draft.currentStep)
    return step
  const legacyEvent = events.find((item) => /^ooo_step_[0-4]$/.test(item))
  if (legacyEvent) {
    const legacyStep = Number(legacyEvent.slice(-1))
    if (getServerDraftStep(legacyStep, 'OOO') === draft.currentStep)
      return legacyStep >= 3 ? legacyStep - 1 : legacyStep
  }
  return draft.currentStep === 0 ? 0 : 1
}

/** Preserve valid stored dates; missing or invalid legacy input stays absent. */
export function registrationDateValue(value: string) {
  const text = value.trim()
  if (!text) return null
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(text)
  const result =
    applicationApplicantSubmissionSchema.shape.registrationDate.safeParse(
      match ? `${match[3]}-${match[2]}-${match[1]}` : text,
    )
  return result.success ? result.data : null
}
