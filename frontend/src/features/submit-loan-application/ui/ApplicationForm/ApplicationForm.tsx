import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Button } from '@alfalab/core-components/button'
import { Input } from '@alfalab/core-components/input'
import { Textarea } from '@alfalab/core-components/textarea'
import { Modal } from '@alfalab/core-components/modal'
import { Typography } from '@alfalab/core-components/typography'
import { ArrowRightMIcon } from '@alfalab/icons/glyph/dist/ArrowRightMIcon'
import { CrossMIcon } from '@alfalab/icons/glyph/dist/CrossMIcon'
import {
  applicationViewSchema,
  createApplicationSchema,
} from '@/entities/loan-application'
import { useDashboard } from '@/entities/dashboard'
import { sessionKey } from '@/entities/session'
import { apiRequest, ApiError, useApiScope } from '@/shared/api'
import { ROUTES } from '@/shared/config'
import { formatMoney } from '@/shared/lib'
import { RequestState } from '@/shared/ui'
import styles from './ApplicationForm.module.scss'

const draftSchema = z.object({
  description: z.string(),
  amount: z.string(),
  termMonths: z.string(),
  purpose: z.string(),
})
const emptyDraft = { description: '', amount: '', termMonths: '', purpose: '' }
const formSteps = [
  'Параметры финансирования',
  'Данные бизнеса',
  'Проверка заявки',
]

export interface ApplicationFormProps {
  headingTag?: 'h1' | 'h2'
}

export function ApplicationForm({ headingTag = 'h1' }: ApplicationFormProps) {
  const scope = useApiScope()
  const storageKey = `application-draft:${scope}`
  const [form, setForm] = useState(() => {
    try {
      const result = draftSchema.safeParse(
        JSON.parse(sessionStorage.getItem(storageKey) ?? 'null'),
      )
      return result.success ? result.data : emptyDraft
    } catch {
      return emptyDraft
    }
  })
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [manual, setManual] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const formRef = useRef<HTMLFormElement>(null)
  const stepHeadingRef = useRef<HTMLHeadingElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const submitting = useRef(false)
  const id = useId()
  const cache = useQueryClient()
  const dashboard = useDashboard()
  const navigate = useNavigate()

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(form))
    } catch {
      /* Storage may be unavailable. */
    }
  }, [form, storageKey])
  useEffect(() => {
    if (open) stepHeadingRef.current?.focus()
  }, [step, open])

  const submit = useMutation({
    mutationFn: (body: z.infer<typeof createApplicationSchema>) =>
      apiRequest('/api/applications', applicationViewSchema, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      try {
        sessionStorage.removeItem(storageKey)
      } catch {
        /* Storage may be unavailable. */
      }
      setForm(emptyDraft)
      setOpen(false)
      await cache.invalidateQueries({ queryKey: ['client', scope] })
      void navigate(ROUTES.applications, { replace: true })
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'LEGAL_FORM_REQUIRED') {
        setOpen(false)
        void cache.invalidateQueries({ queryKey: sessionKey })
      }
    },
    onSettled: () => {
      submitting.current = false
    },
  })

  function start(manualInput: boolean, trigger: HTMLButtonElement) {
    if (!manualInput && !form.description.trim()) {
      setErrors({ description: 'Опишите, на что нужны деньги' })
      return
    }
    returnFocusRef.current = trigger
    setErrors({})
    setManual(manualInput)
    setStep(0)
    setOpen(true)
  }
  function handleNext(event: FormEvent) {
    event.preventDefault()
    if (submitting.current) return
    const result = createApplicationSchema.safeParse({
      amount: Number(form.amount.replace(/\s/g, '').replace(',', '.')),
      termMonths: Number(form.termMonths),
      purpose: form.purpose,
    })
    if (!result.success) {
      setErrors(
        Object.fromEntries(
          result.error.issues.map((issue) => [
            String(issue.path[0]),
            issue.message,
          ]),
        ),
      )
      if (step !== 0) setStep(0)
      else
        formRef.current
          ?.querySelector<HTMLInputElement>(
            `[name="${String(result.error.issues[0]?.path[0])}"]`,
          )
          ?.focus()
      return
    }
    setErrors({})
    if (step < formSteps.length - 1) {
      setStep(step + 1)
      return
    }
    submitting.current = true
    submit.mutate(result.data)
  }
  const company = dashboard.data?.company
  return (
    <>
      <section className={styles.card}>
        <Typography.TitleResponsive
          tag={headingTag}
          view="large"
          font="system"
          weight="bold"
        >
          На что нужны деньги
        </Typography.TitleResponsive>
        <p>
          Расскажите о задаче бизнеса своими словами. Например, сколько нужно,
          на что и на какой срок.
        </p>
        <Textarea
          id={`${id}-intent`}
          name="description"
          aria-label="На что нужны деньги"
          block
          autosize
          minRows={4}
          maxRows={8}
          maxLength={2000}
          value={form.description}
          error={errors.description}
          placeholder="Нужно 3 млн ₽ на закупку товара перед сезоном, примерно на два года"
          onChange={(_, { value }) => setForm({ ...form, description: value })}
        />
        {dashboard.error && (
          <RequestState
            error={dashboard.error}
            retry={() => {
              void dashboard.refetch()
            }}
          />
        )}
        <div className={styles.actions}>
          <Button
            view="primary"
            rightAddons={<ArrowRightMIcon aria-hidden="true" />}
            disabled={dashboard.isPending || Boolean(dashboard.error)}
            onClick={(event) => start(false, event.currentTarget)}
          >
            Продолжить
          </Button>
          <Button
            view="secondary"
            disabled={dashboard.isPending || Boolean(dashboard.error)}
            onClick={(event) => start(true, event.currentTarget)}
          >
            Выбрать самостоятельно
          </Button>
        </div>
      </section>
      <Modal
        open={open}
        size={800}
        fixedPosition
        scrollLock
        disableRestoreFocus
        className={styles.modal}
        disableEscapeKeyDown={submit.isPending}
        disableBackdropClick={submit.isPending}
        onClose={() => {
          if (!submit.isPending) setOpen(false)
        }}
        wrapperProps={{ 'aria-labelledby': `${id}-title` }}
        onUnmount={() =>
          requestAnimationFrame(() => {
            if (
              returnFocusRef.current?.isConnected &&
              !document.querySelector('[role="dialog"]')
            )
              returnFocusRef.current.focus()
          })
        }
      >
        <Modal.Header
          sticky
          hasCloser={!submit.isPending}
          closerProps={{
            icon: () => <CrossMIcon aria-hidden="true" />,
            'aria-label': 'Закрыть заявку',
          }}
          title={<span id={`${id}-title`}>Заявка на финансирование</span>}
        />
        <Modal.Content>
          <form
            id={`${id}-form`}
            ref={formRef}
            onSubmit={handleNext}
            className={styles.form}
            noValidate
          >
            <ol className={styles.stepper} aria-label="Заполнение заявки">
              {formSteps.map((title, index) => (
                <li
                  key={title}
                  aria-current={step === index ? 'step' : undefined}
                  className={step === index ? styles.currentStep : undefined}
                >
                  <span>{index + 1}</span>
                  {title}
                </li>
              ))}
            </ol>
            <Typography.Text view="primary-small" color="secondary">
              Шаг {step + 1} из {formSteps.length}
            </Typography.Text>
            <h2 ref={stepHeadingRef} tabIndex={-1} className={styles.stepTitle}>
              {formSteps[step]}
            </h2>
            {step === 0 && (
              <>
                {form.description.trim() && (
                  <div className={styles.context}>
                    <strong>Ваша бизнес-задача</strong>
                    <p>{form.description}</p>
                  </div>
                )}
                {!manual && (
                  <p role="status">
                    Автозаполнение сейчас недоступно. Уточните параметры ниже,
                    ваш запрос сохранен.
                  </p>
                )}
                <div className={styles.fields}>
                  <Input
                    name="amount"
                    block
                    label="Сумма, ₽"
                    labelView="outer"
                    inputMode="decimal"
                    value={form.amount}
                    error={errors.amount}
                    onChange={(_, { value }) =>
                      setForm({ ...form, amount: value })
                    }
                  />
                  <Input
                    name="termMonths"
                    block
                    label="Срок, месяцев"
                    labelView="outer"
                    inputMode="numeric"
                    value={form.termMonths}
                    error={errors.termMonths}
                    onChange={(_, { value }) =>
                      setForm({ ...form, termMonths: value })
                    }
                  />
                  <Input
                    name="purpose"
                    block
                    label="Цель финансирования"
                    labelView="outer"
                    placeholder="Например, закупка товара"
                    maxLength={100}
                    value={form.purpose}
                    error={errors.purpose}
                    onChange={(_, { value }) =>
                      setForm({ ...form, purpose: value })
                    }
                  />
                </div>
                <p>
                  Сумма от 10 000 ₽, срок от 1 до 120 месяцев. Подходящие
                  продукты и условия будут доступны после рассмотрения заявки.
                </p>
              </>
            )}
            {step === 1 && (
              <>
                <p>
                  Данные уже заполнены из профиля компании. Проверьте их,
                  повторный ввод не нужен.
                </p>
                {company && (
                  <dl className={styles.summary}>
                    <div>
                      <dt>Название</dt>
                      <dd>{company.name}</dd>
                    </div>
                    <div>
                      <dt>ИНН</dt>
                      <dd>{company.inn}</dd>
                    </div>
                    <div>
                      <dt>Форма бизнеса</dt>
                      <dd>
                        {company.legalForm === 'IP'
                          ? 'ИП'
                          : company.legalForm === 'OOO'
                            ? 'ООО'
                            : 'Не указана'}
                      </dd>
                    </div>
                    {company.okved && (
                      <div>
                        <dt>ОКВЭД</dt>
                        <dd>{company.okved}</dd>
                      </div>
                    )}
                  </dl>
                )}
              </>
            )}
            {step === 2 && (
              <>
                <p>
                  Убедитесь, что параметры соответствуют вашей задаче. После
                  отправки заявка поступит на рассмотрение.
                </p>
                <dl className={styles.summary}>
                  <div>
                    <dt>Компания</dt>
                    <dd>{company?.name}</dd>
                  </div>
                  <div>
                    <dt>ИНН</dt>
                    <dd>{company?.inn}</dd>
                  </div>
                  <div>
                    <dt>Сумма</dt>
                    <dd>
                      {formatMoney(
                        Number(
                          form.amount.replace(/\s/g, '').replace(',', '.'),
                        ),
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Срок</dt>
                    <dd>{form.termMonths} мес.</dd>
                  </div>
                  <div>
                    <dt>Цель</dt>
                    <dd>{form.purpose}</dd>
                  </div>
                </dl>
                <p>
                  Ставка и платеж будут указаны в предложении банка. Отправка
                  заявки не означает одобрение кредита.
                </p>
              </>
            )}
            {submit.error && <RequestState error={submit.error} />}
          </form>
        </Modal.Content>
        <Modal.Footer sticky>
          <div className={styles.footer}>
            <Button
              view="secondary"
              disabled={submit.isPending}
              onClick={() => (step > 0 ? setStep(step - 1) : setOpen(false))}
            >
              {step > 0 ? 'Назад' : 'К бизнес-задаче'}
            </Button>
            <Button
              form={`${id}-form`}
              type="submit"
              view="primary"
              disabled={
                submit.isPending || Boolean(dashboard.error) || !company
              }
              loading={submit.isPending}
            >
              {step === formSteps.length - 1
                ? 'Отправить заявку'
                : 'Продолжить'}
            </Button>
          </div>
        </Modal.Footer>
      </Modal>
    </>
  )
}
