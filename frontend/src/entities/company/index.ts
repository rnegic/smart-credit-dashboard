import { z } from 'zod'

export const companySchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  inn: z.string(),
  okved: z.string().nullable(),
  legalForm: z.string().nullable(),
})
export type Company = z.infer<typeof companySchema>

export const industryGroups = [
  { key: 'IT', label: 'IT, связь (62, 63)', from: 62, to: 63 },
  { key: 'TRADE', label: 'Торговля (45–47)', from: 45, to: 47 },
  { key: 'PRODUCTION', label: 'Производство (10–33)', from: 10, to: 33 },
  { key: 'CONSTRUCTION', label: 'Строительство (41–43)', from: 41, to: 43 },
  { key: 'CATERING', label: 'Общепит, гостиницы (55, 56)', from: 55, to: 56 },
  { key: 'DEFAULT', label: 'По умолчанию', from: null, to: null },
] as const

/** Classifies an OKVED code for display, without calculating credit terms. */
export function getIndustryGroup(okved: string | null | undefined) {
  const match = okved?.trim().match(/^(\d{2})(?:\.|$)/)
  if (!match) return null
  const code = Number(match[1])
  return (
    industryGroups.find(
      (group) =>
        group.from !== null &&
        group.to !== null &&
        code >= group.from &&
        code <= group.to,
    ) ?? industryGroups[5]
  )
}

/** Formats completed calendar years/months at the application date, or days for a new company. */
export function getCompanyAge(
  registrationDate: string | null | undefined,
  applicationDate: string,
) {
  if (!registrationDate) return null
  const start = new Date(`${registrationDate}T00:00:00Z`)
  const end = new Date(`${applicationDate.slice(0, 10)}T00:00:00Z`)
  if (
    !Number.isFinite(start.getTime()) ||
    !Number.isFinite(end.getTime()) ||
    start > end ||
    start.toISOString().slice(0, 10) !== registrationDate
  )
    return null

  const months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    end.getUTCMonth() -
    start.getUTCMonth() -
    (end.getUTCDate() < start.getUTCDate() ? 1 : 0)
  const format = (value: number, unit: 'year' | 'month' | 'day') =>
    new Intl.NumberFormat('ru-RU', {
      style: 'unit',
      unit,
      unitDisplay: 'long',
    }).format(value)

  if (months < 1) {
    const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000)
    return days === 0 ? 'Зарегистрирована сегодня' : format(days, 'day')
  }
  return [
    months >= 12 ? format(Math.floor(months / 12), 'year') : '',
    months % 12 ? format(months % 12, 'month') : '',
  ]
    .filter(Boolean)
    .join(' ')
}
