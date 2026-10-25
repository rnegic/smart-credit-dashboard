import { useId, useRef, useState, type FormEvent } from 'react'
import { Button } from '@alfalab/core-components/button'
import { Input } from '@alfalab/core-components/input'
import { Select } from '@alfalab/core-components/select'
import { Textarea } from '@alfalab/core-components/textarea'
import { ArrowsRightLeftMIcon } from '@alfalab/icons/glyph/dist/ArrowsRightLeftMIcon'
import { CheckmarkMIcon } from '@alfalab/icons/glyph/dist/CheckmarkMIcon'
import { CrossMIcon } from '@alfalab/icons/glyph/dist/CrossMIcon'
import { MagicWandMIcon } from '@alfalab/icons/glyph/dist/MagicWandMIcon'
import { useMutation } from '@tanstack/react-query'
import {
  commentSuggestionSchema,
  type BankApplicationView,
} from '@/entities/loan-application'
import { apiRequest } from '@/shared/api'
import { formatMoney } from '@/shared/lib'
import { decisionSchema, type Decision } from '../../model/decision'
import styles from './DecisionForm.module.scss'

/** Officer decision state and the validated submission callback. */
export interface DecisionFormProps {
  application: BankApplicationView
  disabled: boolean
  pending: boolean
  onSubmit: (decision: Decision) => void
}

const actions = [
  {
    value: 'APPROVE',
    label: 'Одобрить запрошенные сумму и срок',
    Icon: CheckmarkMIcon,
  },
  {
    value: 'OFFER_ALTERNATIVE',
    label: 'Предложить другие условия',
    Icon: ArrowsRightLeftMIcon,
  },
  { value: 'DECLINE', label: 'Отказать', Icon: CrossMIcon },
] as const

const termOptions = [30, 60, 90].map((days) => ({
  key: String(days),
  content: `${days} дней`,
}))

type Field = 'action' | 'comment' | 'amount' | 'termDays' | 'finalRate'

type SuggestionBody = {
  action: 'APPROVE' | 'OFFER_ALTERNATIVE' | 'DECLINE'
  amount?: number
  termDays?: 30 | 60 | 90
  finalRate?: number
}

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
  const recommendedRate = application.recommendation?.finalRate
  const recommendedAmount = application.recommendation?.amount
  const requiresManualRate = recommendedRate == null && application.rate == null

  function changeField(field: Exclude<Field, 'action'>, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  function parseNumber(value: string): number | null {
    const trimmed = value.trim()
    if (!trimmed) return null
    const parsed = Number(trimmed.replace(/\s/g, '').replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : null
  }

  function buildSuggestionBody(): SuggestionBody | null {
    if (!action) return null
    const body: SuggestionBody = { action }
    if (action === 'OFFER_ALTERNATIVE') {
      const amount = parseNumber(values.amount)
      if (amount !== null && amount >= 50_000 && amount <= 20_000_000)
        body.amount = amount
      if (
        values.termDays === '30' ||
        values.termDays === '60' ||
        values.termDays === '90'
      )
        body.termDays = Number(values.termDays) as 30 | 60 | 90
    }
    const rate = parseNumber(values.finalRate)
    if (action !== 'DECLINE' && rate !== null && rate >= 0 && rate <= 100)
      body.finalRate = rate
    return body
  }

  const generate = useMutation({
    mutationFn: async () => {
      const body = buildSuggestionBody()
      if (!body) throw new Error('Выберите решение')
      return apiRequest(
        `/api/bank/applications/${application.id}/comment-suggestion`,
        commentSuggestionSchema,
        { method: 'POST', body: JSON.stringify(body) },
      )
    },
    onSuccess: (result) => changeField('comment', result.comment),
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (disabled || pending) return
    if (action && action !== 'DECLINE' && requiresManualRate && !values.finalRate.trim()) {
      setErrors({ finalRate: 'Укажите итоговую ставку: сервер не передал расчётную ставку для этой заявки' })
      formRef.current?.querySelector<HTMLElement>('[name="finalRate"]')?.focus()
      return
    }

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
      <fieldset
        className={styles.choices}
        disabled={disabled || pending}
        aria-describedby={`${id}-action-note`}
      >
        <legend className={styles.legend}>Решение сотрудника</legend>
        <p id={`${id}-action-note`} className={styles.note}>
          Заявка ожидает решения сотрудника независимо от рекомендации скоринга.
          Изучите данные и выберите действие; решение будет сохранено только
          после отправки формы.
        </p>
        <div className={styles.choiceList}>
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
                  generate.reset()
                }}
              />
              <option.Icon
                className={styles.choiceIcon}
                aria-hidden="true"
                focusable="false"
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
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
          <h3 className={styles.sectionTitle}>Краткосрочное финансирование</h3>
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
              <dt>Ставка при одобрении</dt>
              <dd>
                {recommendedRate == null
                  ? requiresManualRate ? 'Укажите ставку вручную' : 'Рассчитает сервер при сохранении'
                  : `${recommendedRate}% годовых из рекомендации`}
              </dd>
            </div>
            <div>
              <dt>Платёж скоринга по базовой ставке</dt>
              <dd>
                {application.scoring?.newMonthlyPayment == null
                  ? 'Расчёт не передан'
                  : formatMoney(application.scoring.newMonthlyPayment)}
              </dd>
            </div>
          </dl>
          <Input
            name="finalRate"
            label="Итоговая годовая ставка, %"
            labelView="outer"
            inputMode="decimal"
            required={requiresManualRate}
            value={values.finalRate}
            onChange={(_, { value }) => changeField('finalRate', value)}
            error={errors.finalRate}
            hint={requiresManualRate
              ? 'Расчётная ставка отсутствует. Для ручного одобрения укажите ставку от 0 до 100%.'
              : 'Необязательно. Укажите свою ставку или оставьте поле пустым для серверного расчёта.'}
            disabled={disabled || pending}
            block
          />
          <p className={styles.note}>
            Сумма и срок соответствуют заявке. Указанная сотрудником ставка
            имеет приоритет. Без неё сервер использует рекомендацию или тарифную
            матрицу; при отсутствии расчётной ставки требуется ручной ввод.
            Показанный платёж скоринга рассчитан по базовой ставке, а не по
            ставке предложения. Платёж предложения рассчитает сервер.
            Просмотр условий не отправляет предложение клиенту.
          </p>
        </section>
      )}
      {action === 'OFFER_ALTERNATIVE' && (
        <section
          className={styles.alternative}
          aria-labelledby={`${id}-alternative-title`}
        >
          <h3 id={`${id}-alternative-title`} className={styles.sectionTitle}>
            Другие условия предложения
          </h3>
          <Input
            name="amount"
            label="Изменить сумму предложения"
            labelView="outer"
            inputMode="decimal"
            value={values.amount}
            onChange={(_, { value }) => changeField('amount', value)}
            error={errors.amount}
            hint={`Необязательно. Без изменения: ${
              recommendedAmount == null
                ? 'сумму рассчитает сервер'
                : `${formatMoney(recommendedAmount)} из рекомендации`
            }. От 50 000 до 20 000 000 ₽.`}
            disabled={disabled || pending}
            block
          />
          <Select
            ref={termRef}
            name="termDays"
            label="Изменить срок, дней"
            labelView="outer"
            options={termOptions}
            selected={values.termDays || null}
            onChange={({ selected }) =>
              changeField('termDays', selected?.key ?? '')
            }
            allowUnselect
            clear={values.termDays !== ''}
            onClear={() => changeField('termDays', '')}
            error={errors.termDays}
            hint={`Необязательно. Без изменения: ${application.termDays} дней из заявки. Можно выбрать 30, 60 или 90 дней.`}
            disabled={disabled || pending}
            block
          />
          <Input
            name="finalRate"
            label="Изменить итоговую годовую ставку, %"
            labelView="outer"
            inputMode="decimal"
            required={requiresManualRate}
            value={values.finalRate}
            onChange={(_, { value }) => changeField('finalRate', value)}
            error={errors.finalRate}
            hint={requiresManualRate
              ? 'Обязательно: расчётная ставка отсутствует. Укажите значение от 0 до 100%.'
              : `Необязательно. Без изменения: ${
              recommendedRate == null
                ? 'ставку рассчитает сервер'
                : `${recommendedRate}% из рекомендации`
            }. От 0 до 100% включительно.`}
            disabled={disabled || pending}
            block
          />
          {values.termDays !== '' &&
            values.termDays !== String(application.termDays) &&
            values.finalRate.trim() === '' &&
            recommendedRate != null && (
              <p className={styles.warning} role="status">
                Срок изменён, но ставка не задана. Сервер использует ставку из
                рекомендации {recommendedRate}% без пересчёта под новый срок.
                Укажите ставку вручную, если требуется её изменить.
              </p>
            )}
          <p className={styles.note}>
            Сумму и срок можно оставить без изменений. Ставка обязательна, если
            сервер не может её рассчитать. Пустые поля не отправляются;
            сервер применит доступные значения по умолчанию. Платёж
            предложения рассчитает сервер; скоринг исходной заявки здесь не
            пересчитывается.
          </p>
        </section>
      )}

      <div className={styles.confirmation}>
        <div className={styles.commentActions}>
          <Button
            type="button"
            view="secondary"
            size={40}
            leftAddons={<MagicWandMIcon aria-hidden="true" focusable="false" />}
            loading={generate.isPending}
            disabled={!action || disabled || pending || generate.isPending}
            onClick={() => generate.mutate()}
          >
            {generate.isPending
              ? 'Генерируем…'
              : values.comment.trim()
                ? 'Сгенерировать заново'
                : 'Сгенерировать комментарий с ИИ'}
          </Button>
          {!action && (
            <span className={styles.note}>Сначала выберите решение</span>
          )}
        </div>
        {generate.isError && (
          <p className={styles.error} role="alert">
            {generate.error instanceof Error
              ? generate.error.message
              : 'Не удалось сгенерировать комментарий'}
          </p>
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
        <div className={styles.submit}>
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
        </div>
      </div>
    </form>
  )
}
