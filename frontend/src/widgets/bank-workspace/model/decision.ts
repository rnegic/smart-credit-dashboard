import { z } from 'zod'

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

export const decisionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('APPROVE'), comment: commentSchema }),
  z.object({ action: z.literal('DECLINE'), comment: commentSchema }),
  z.object({
    action: z.literal('OFFER_ALTERNATIVE'),
    comment: commentSchema,
    amount: decimalSchema.pipe(
      z
        .number()
        .min(50_000, 'Минимальная сумма 50 000 ₽')
        .max(20_000_000, 'Максимальная сумма 20 000 000 ₽'),
    ),
    termDays: z
      .enum(['30', '60', '90'], {
        error: 'Выберите срок 30, 60 или 90 дней',
      })
      .transform(Number),
    finalRate: decimalSchema.pipe(
      z
        .number()
        .min(0, 'Ставка не может быть отрицательной')
        .max(100, 'Ставка не более 100%'),
    ),
  }),
])

export type Decision = z.infer<typeof decisionSchema>
