import { useId, useRef, useState, type FormEvent } from 'react'
import { Button } from '@alfalab/core-components/button'
import { Input } from '@alfalab/core-components/input'
import { Textarea } from '@alfalab/core-components/textarea'
import { decisionSchema, type Decision } from '../../model/decision'
import styles from './DecisionForm.module.scss'

export interface DecisionFormProps {
  disabled: boolean
  pending: boolean
  onSubmit: (decision: Decision) => void
}

const actions = [
  { value: 'APPROVE', label: 'Одобрить запрошенные условия' },
  { value: 'OFFER_ALTERNATIVE', label: 'Предложить другие условия' },
  { value: 'DECLINE', label: 'Отказать' },
] as const

type Field = 'action' | 'comment' | 'amount' | 'termMonths' | 'ratePercent'

export function DecisionForm({
  disabled,
  pending,
  onSubmit,
}: DecisionFormProps) {
  const id = useId()
  const formRef = useRef<HTMLFormElement>(null)
  const [action, setAction] = useState<Decision['action'] | ''>('')
  const [values, setValues] = useState({
    comment: '',
    amount: '',
    termMonths: '',
    ratePercent: '',
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
          field === 'termMonths' ||
          field === 'ratePercent'
        ) {
          nextErrors[field] ??=
            field === 'action' ? 'Выберите решение' : issue.message
        }
      }
      setErrors(nextErrors)
      const firstField = Object.keys(nextErrors)[0]
      if (firstField) {
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
          Выберите решение самостоятельно. Скоринговая оценка не отправляет
          решение автоматически.
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
        <p className={styles.note}>
          Сумма и срок останутся запрошенными. Ставку и платёж рассчитает сервер
          по правилам прототипа.
        </p>
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
            hint="От 10 000 ₽"
            disabled={disabled || pending}
            block
          />
          <Input
            name="termMonths"
            label="Срок, месяцев"
            labelView="outer"
            inputMode="numeric"
            value={values.termMonths}
            onChange={(_, { value }) => changeField('termMonths', value)}
            error={errors.termMonths}
            hint="Целое число от 1 до 120"
            disabled={disabled || pending}
            block
          />
          <Input
            name="ratePercent"
            label="Годовая ставка, %"
            labelView="outer"
            inputMode="decimal"
            value={values.ratePercent}
            onChange={(_, { value }) => changeField('ratePercent', value)}
            error={errors.ratePercent}
            hint="Больше 0, не более 100%"
            disabled={disabled || pending}
            block
          />
          <p className={styles.note}>
            Границы суммы, срока и ставки служат проверкой ввода в прототипе, а
            не кредитной политикой Альфа-Банка.
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
