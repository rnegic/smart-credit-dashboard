import { z } from 'zod'
import { useSyncExternalStore } from 'react'
import {
  applicationDraftPathsSchema,
  applicationFormSchema,
} from '@/entities/application-form'

const draftSchema = z.object({
  description: z.string(),
  amount: z.string(),
  termDays: z.string(),
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
  currentStep: z.number().int().min(0).max(3).default(0),
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
])

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

export function registrationDateValue(value: string) {
  const text = value.trim()
  if (!text) return null
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(text)
  return match ? `${match[3]}-${match[2]}-${match[1]}` : text
}
