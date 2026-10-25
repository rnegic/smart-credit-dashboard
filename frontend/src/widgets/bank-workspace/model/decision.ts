import { z } from 'zod'
import { contractTermMonthsSchema } from '@/entities/loan-application'

const commentSchema = z
  .string()
  .max(1000, 'Не более 1000 символов')
  .trim()
  .min(1, 'Объясните решение в комментарии')

const decimalSchema = z
  .string()
  .trim()
  .min(1, 'Заполните поле')
  .regex(/^\d+(?:[.,]\d+)?$/, 'Введите число без пробелов')
  .transform((value) => Number(value.replace(',', '.')))

const optionalInputSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === '' ? undefined : value))

const optionalRateSchema = optionalInputSchema.pipe(
  decimalSchema.pipe(
    z.number().min(0, 'Ставка не может быть отрицательной').max(100, 'Ставка не более 100%'),
  ).optional(),
)

export const decisionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('APPROVE'),
    comment: commentSchema,
    finalRate: optionalRateSchema,
  }),
  z.object({ action: z.literal('DECLINE'), comment: commentSchema }),
  z.object({
    action: z.literal('OFFER_ALTERNATIVE'),
    comment: commentSchema,
    amount: optionalInputSchema.pipe(
      decimalSchema
        .pipe(
          z
            .number()
            .min(50_000, 'Минимальный лимит 50 000 ₽')
            .max(20_000_000, 'Максимальный лимит 20 000 000 ₽'),
        )
        .optional(),
    ),
    termDays: optionalInputSchema.pipe(
      z
        .enum(['30', '60', '90'], {
          error: 'Выберите срок 30, 60 или 90 дней',
        })
        .transform(Number)
        .optional(),
    ),
    contractTermMonths: optionalInputSchema.pipe(
      z
        .enum(['6', '12', '24'], {
          error: 'Выберите срок договора 6, 12 или 24 месяца',
        })
        .transform(Number)
        .pipe(contractTermMonthsSchema)
        .optional(),
    ),
    finalRate: optionalRateSchema,
  }),
])

export type Decision = z.infer<typeof decisionSchema>
