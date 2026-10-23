import { useId, useRef, useState, type FormEvent } from 'react'
import { Button } from '@alfalab/core-components/button'
import { Input } from '@alfalab/core-components/input'
import { Select } from '@alfalab/core-components/select'
import { Textarea } from '@alfalab/core-components/textarea'
import type { ApplicationView } from '@/entities/loan-application'
import { formatMoney } from '@/shared/lib'
import { decisionSchema, type Decision } from '../../model/decision'
import styles from './DecisionForm.module.scss'

/** Officer decision state and the validated submission callback. */
export interface DecisionFormProps {
  application: ApplicationView
  disabled: boolean
  pending: boolean
  onSubmit: (decision: Decision) => void
}

const actions = [
  { value: 'APPROVE', label: 'Предложить новые условия' },
  { value: 'OFFER_ALTERNATIVE', label: 'Указать условия вручную' },
  { value: 'DECLINE', label: 'Отказать' },
] as const

const termOptions = [30, 60, 90].map((days) => ({
  key: String(days),
  content: `${days} дней`,
}))

type Field = 'action' | 'comment' | 'amount' | 'termDays' | 'finalRate'

/** Validates manual decisions without calculating offer terms in the browser. */
export function DecisionForm({
  application,
  disabled,
  pending,
  onSubmit,
}: DecisionFormProps) {
  const id = useId()
  const formRef = useRef<HTMLFormElement>(null)
  const termRef = useRef<HTMLDivElement>(null)
  const [action, setAction] = useState<Decision['action'] | ''>('')
  const [values, setValues] = useState({
    comment: '',
    amount: '',
    termDays: '',
    finalRate: '',
  })
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})

  function changeField(field: Exclude<Field, 'action'>, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (disabled || pending) return

    const result = decisionSchema.safeParse({ action, ...values })
    if (!result.success) {
      const nextErrors: Partial<Record<Field, string>> = {}
      for (const issue of result.error.issues) {
        const field = issue.path[0]
        if (
          field === 'action' ||
          field === 'comment' ||
          field === 'amount' ||
          field === 'termDays' ||
          field === 'finalRate'
        ) {
          nextErrors[field] ??=
            field === 'action' ? 'Выберите решение' : issue.message
        }
      }
      setErrors(nextErrors)
      const firstField = Object.keys(nextErrors)[0]
      if (firstField === 'termDays') termRef.current?.focus()
      else if (firstField) {
        formRef.current
          ?.querySelector<HTMLElement>(`[name="${firstField}"]`)
          ?.focus()
      }
      return
    }
    setErrors({})
    onSubmit(result.data)
  }

  return (
    <form ref={formRef} className={styles.form} onSubmit={submit} noValidate>
      <fieldset className={styles.choices} disabled={disabled || pending}>
        <legend className={styles.legend}>Решение сотрудника</legend>
        <p className={styles.note}>
          Заявка ожидает ручного решения. Изучите скоринг и выберите действие;
          выбор будет сохранён только после отправки формы.
        </p>
        {actions.map((option) => (
          <label key={option.value} className={styles.choice}>
            <input
              type="radio"
              name="action"
              value={option.value}
              checked={action === option.value}
              aria-invalid={Boolean(errors.action)}
              aria-describedby={
                errors.action ? `${id}-action-error` : undefined
              }
              onChange={() => {
                setAction(option.value)
                setErrors({})
              }}
            />
            <span>{option.label}</span>
          </label>
        ))}
        {errors.action && (
          <p id={`${id}-action-error`} className={styles.error} role="alert">
            {errors.action}
          </p>
        )}
      </fieldset>

      {action === 'APPROVE' && (
        <section
          className={styles.product}
          aria-label="Предложение по параметрам заявки"
        >
          <h3>Краткосрочное финансирование</h3>
          <dl>
            <div>
              <dt>Сумма предложения</dt>
              <dd>{formatMoney(application.amount)}</dd>
            </div>
            <div>
              <dt>Срок</dt>
              <dd>{application.termDays} дней</dd>
            </div>
            <div>
              <dt>Базовая ставка продукта</dt>
              <dd>
                {application.rate == null
                  ? 'Не передана сервером'
                  : `${application.rate}% годовых`}
              </dd>
            </div>
            <div>
              <dt>Расчётный платёж в скоринге</dt>
              <dd>
                {application.scoring?.newMonthlyPayment == null
                  ? 'Расчёт не передан'
                  : formatMoney(application.scoring.newMonthlyPayment)}
              </dd>
            </div>
          </dl>
          <p className={styles.note}>
            Сумма и срок соответствуют заявке. Итоговую ставку и платёж
            рассчитает сервер при сохранении решения. Сейчас показаны базовые
            параметры, а не окончательные условия подписания. Просмотр карточки
            не отправляет предложение клиенту.
          </p>
        </section>
      )}
      {action === 'OFFER_ALTERNATIVE' && (
        <div className={styles.alternative}>
          <Input
            name="amount"
            label="Сумма предложения"
            labelView="outer"
            inputMode="decimal"
            value={values.amount}
            onChange={(_, { value }) => changeField('amount', value)}
            error={errors.amount}
            hint="От 50 000 до 20 000 000 ₽"
            disabled={disabled || pending}
            block
          />
          <Select
            ref={termRef}
            name="termDays"
            label="Срок, дней"
            labelView="outer"
            options={termOptions}
            selected={values.termDays || null}
            onChange={({ selected }) =>
              changeField('termDays', selected?.key ?? '')
            }
            error={errors.termDays}
            hint="30, 60 или 90 дней"
            disabled={disabled || pending}
            block
          />
          <Input
            name="finalRate"
            label="Итоговая годовая ставка, %"
            labelView="outer"
            inputMode="decimal"
            value={values.finalRate}
            onChange={(_, { value }) => changeField('finalRate', value)}
            error={errors.finalRate}
            hint="От 0 до 100% включительно"
            disabled={disabled || pending}
            block
          />
          <p className={styles.note}>
            Сумма, срок и итоговая ставка проверяются сервером. Платёж по
            предложению рассчитает сервер; скоринг здесь не пересчитывается.
          </p>
        </div>
      )}

      <Textarea
        name="comment"
        aria-label="Комментарий к решению"
        label="Комментарий к решению"
        labelView="outer"
        value={values.comment}
        onChange={(_, { value }) => changeField('comment', value)}
        error={errors.comment}
        hint="Обязателен для любого решения. Не более 1000 символов."
        maxLength={1000}
        minRows={3}
        showCounter
        disabled={disabled || pending}
        block
      />
      <p className={styles.note}>
        После отправки изменить решение по этой заявке нельзя.
      </p>
      <Button
        type="submit"
        view="primary"
        size={48}
        block
        loading={pending}
        disabled={disabled || pending}
      >
        Отправить решение
      </Button>
    </form>
  )
}
