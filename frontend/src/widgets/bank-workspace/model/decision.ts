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
        .min(10_000, 'Минимальная сумма в прототипе: 10 000')
        .max(
          Number.MAX_SAFE_INTEGER,
          'Сумма слишком велика для точного расчёта',
        ),
    ),
    termMonths: z
      .string()
      .trim()
      .min(1, 'Укажите срок')
      .regex(/^\d+$/, 'Введите целое число месяцев')
      .transform(Number)
      .pipe(
        z
          .number()
          .int('Введите целое число месяцев')
          .min(1, 'Срок от 1 месяца')
          .max(120, 'Срок не более 120 месяцев'),
      ),
    ratePercent: decimalSchema.pipe(
      z
        .number()
        .positive('Ставка должна быть больше нуля')
        .max(100, 'Проверьте ставку: не более 100% в прототипе'),
    ),
  }),
])

export type Decision = z.infer<typeof decisionSchema>
