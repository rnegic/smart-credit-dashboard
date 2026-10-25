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
  type ContractTermMonths,
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
    label: 'Одобрить запрошенные лимит и сроки',
    Icon: CheckmarkMIcon,
  },
  {
    value: 'OFFER_ALTERNATIVE',
    label: 'Предложить другие условия',
    Icon: ArrowsRightLeftMIcon,
  },
  { value: 'DECLINE', label: 'Отказать', Icon: CrossMIcon },
] as const

const contractTermOptions = [6, 12, 24].map((months) => ({
  key: String(months),
  content: `${months} мес.`,
}))

type Field = 'action' | 'comment' | 'amount' | 'contractTermMonths' | 'finalRate'

type SuggestionBody = {
  action: 'APPROVE' | 'OFFER_ALTERNATIVE' | 'DECLINE'
  amount?: number
  contractTermMonths?: ContractTermMonths
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
  const contractTermRef = useRef<HTMLDivElement>(null)
  const [action, setAction] = useState<Decision['action'] | ''>('')
  const [values, setValues] = useState({
    comment: '',
    amount: '',
    contractTermMonths: '',
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
        values.contractTermMonths === '6' ||
        values.contractTermMonths === '12' ||
        values.contractTermMonths === '24'
      )
        body.contractTermMonths = Number(values.contractTermMonths) as ContractTermMonths
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
      setErrors({ finalRate: 'Укажите ставку по договору: сервер не передал расчётную ставку для этой заявки' })
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
          field === 'contractTermMonths' ||
          field === 'finalRate'
        ) {
          nextErrors[field] ??=
            field === 'action' ? 'Выберите решение' : issue.message
        }
      }
      setErrors(nextErrors)
      const firstField = Object.keys(nextErrors)[0]
      if (firstField === 'contractTermMonths') contractTermRef.current?.focus()
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
          <h3 className={styles.sectionTitle}>Договор овердрафта</h3>
          <dl>
            <div>
              <dt>Лимит договора</dt>
              <dd>{formatMoney(application.amount)}</dd>
            </div>
            <div>
              <dt>Запрошенный срок договора</dt>
              <dd>{application.contractTermMonths} мес.</dd>
            </div>
            <div>
              <dt>Срок транша</dt>
              <dd>{application.termDays} дней</dd>
            </div>
            <div>
              <dt>Ставка по договору при одобрении</dt>
              <dd>
                {recommendedRate == null
                  ? requiresManualRate ? 'Укажите ставку вручную' : 'Рассчитает сервер при сохранении'
                  : `${recommendedRate}% годовых из рекомендации`}
              </dd>
            </div>
            <div>
              <dt>Пример платежа по базовой ставке</dt>
              <dd>
                {application.scoring?.newMonthlyPayment == null
                  ? 'Расчёт не передан'
                  : formatMoney(application.scoring.newMonthlyPayment)}
              </dd>
            </div>
          </dl>
          <Input
            name="finalRate"
            label="Ставка по договору, % годовых"
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
            Лимит, срок договора и срок транша соответствуют заявке.
            Срок транша выбран клиентом на первом шаге и не меняется банком;
            после одобрения он фиксируется в индивидуальных условиях договора.
            Указанная сотрудником ставка имеет приоритет.
            Без неё сервер использует рекомендацию или тарифную
            матрицу; при отсутствии расчётной ставки требуется ручной ввод.
            Показанный платёж скоринга рассчитан по базовой ставке, если взять
            весь лимит одним траншем на {application.termDays} дней, а не по
            ставке предложения. Это не график погашения. Пример платежа
            предложения рассчитает сервер.
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
          <p className={styles.note}>
            Срок транша: <strong>{application.termDays} дней</strong>.
            Выбран клиентом на первом шаге заявки и не меняется банком.
            После одобрения фиксируется в индивидуальных условиях договора.
          </p>
          <Input
            name="amount"
            label="Изменить лимит договора"
            labelView="outer"
            inputMode="decimal"
            value={values.amount}
            onChange={(_, { value }) => changeField('amount', value)}
            error={errors.amount}
            hint={`Необязательно. Без изменения: ${
              recommendedAmount == null
                ? 'лимит рассчитает сервер'
                : `${formatMoney(recommendedAmount)} из рекомендации`
            }. От 50 000 до 20 000 000 ₽.`}
            disabled={disabled || pending}
            block
          />
          <Select
            ref={contractTermRef}
            name="contractTermMonths"
            label="Изменить срок договора, месяцев"
            labelView="outer"
            options={contractTermOptions}
            selected={values.contractTermMonths || null}
            onChange={({ selected }) =>
              changeField('contractTermMonths', selected?.key ?? '')
            }
            allowUnselect
            clear={values.contractTermMonths !== ''}
            onClear={() => changeField('contractTermMonths', '')}
            error={errors.contractTermMonths}
            hint={`Необязательно. Без изменения: ${application.contractTermMonths} мес. из заявки. Можно выбрать 6, 12 или 24 месяца.`}
            disabled={disabled || pending}
            block
          />
          <Input
            name="finalRate"
            label="Изменить ставку по договору, % годовых"
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
          <p className={styles.note}>
            Лимит и срок договора можно оставить без изменений. Пустой срок договора
            берётся из заявки. Ставка обязательна, если
            сервер не может её рассчитать. Пустые поля не отправляются;
            сервер применит доступные значения по умолчанию. Пример платежа
            для всего лимита одним траншем на {application.termDays} дней
            рассчитает сервер; это не график погашения. Скоринг исходной заявки
            здесь не пересчитывается.
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
