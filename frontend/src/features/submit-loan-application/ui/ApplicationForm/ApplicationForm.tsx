import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from 'react'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Button } from '@alfalab/core-components/button'
import { Input } from '@alfalab/core-components/input'
import { Select } from '@alfalab/core-components/select'
import { Textarea } from '@alfalab/core-components/textarea'
import { Modal } from '@alfalab/core-components/modal'
import { Typography } from '@alfalab/core-components/typography'
import { ArrowRightMIcon } from '@alfalab/icons/glyph/dist/ArrowRightMIcon'
import { CrossMIcon } from '@alfalab/icons/glyph/dist/CrossMIcon'
import { DocumentMIcon } from '@alfalab/icons/glyph/dist/DocumentMIcon'
import {
  applicationViewSchema,
  createApplicationSchema,
} from '@/entities/loan-application'
import {
  applicationApplicantSubmissionSchema,
  applicationFormSubmissionSchema,
  applicationFormSchema,
  applicationDraftSchema,
  prefillResponseSchema,
  useApplicationDraft,
  type ApplicationDraft,
  type ApplicationForm,
  type PrefillResponse,
} from '@/entities/application-form'
import { useDashboard } from '@/entities/dashboard'
import { getIndustryGroup } from '@/entities/company'
import { sessionKey } from '@/entities/session'
import {
  apiRequest,
  apiOptionalRequest,
  apiEmpty,
  ApiError,
  useApiScope,
} from '@/shared/api'
import { ROUTES } from '@/shared/config'
import { formatMoney } from '@/shared/lib'
import { FieldLabel, RequestState } from '@/shared/ui'
import {
  IpApplicationFields,
  type IpApplicationData,
} from '../IpApplicationFields'
import {
  loadLocalDraft,
  numberOrNull,
  registrationDateValue,
  useLocalDraft,
} from '../../model/local-draft'
import styles from './ApplicationForm.module.scss'

const emptyDraft = { description: '', amount: '', termDays: '', purpose: '' }
const termOptions = [30, 60, 90].map((days) => ({
  key: String(days),
  content: `${days} дней`,
}))
const registrationSchema = applicationApplicantSubmissionSchema.pick({
  firstName: true,
  lastName: true,
  ogrnip: true,
  registrationDate: true,
  mainOkved: true,
  industry: true,
  registrationAddress: true,
  phone: true,
  email: true,
})
const formSteps = [
  'Параметры финансирования',
  'Данные бизнеса',
  'Проверка заявки',
]
const ipFormSteps = [
  'Параметры финансирования',
  'Данные бизнеса',
  'Регистрационные данные',
  'Проверка заявки',
]
export interface ApplicationFormProps {
  headingTag?: 'h1' | 'h2'
  resumeOnly?: boolean
}

function inputValue(value: string | number | null) {
  return value === null ? '' : String(value)
}

function applicantName(
  applicant: ApplicationForm['step2_businessData']['applicant'],
) {
  return [applicant.lastName, applicant.firstName, applicant.middleName]
    .filter(Boolean)
    .join(' ')
}

function splitApplicantName(value: string) {
  const [lastName, firstName, ...middleName] = value.trim().split(/\s+/)
  return {
    lastName: lastName || null,
    firstName: firstName || null,
    middleName: middleName.join(' ') || null,
  }
}

function nullableText(value: string) {
  const normalized = value.trim()
  return normalized || null
}

function financingFields(responseForm: ApplicationForm) {
  return {
    description: responseForm.step1_financingParameters.businessTask ?? '',
    amount: inputValue(responseForm.step1_financingParameters.amount),
    termDays: inputValue(responseForm.step1_financingParameters.termDays),
    purpose: responseForm.step1_financingParameters.purpose ?? '',
  }
}

function applicantFields(responseForm: ApplicationForm): IpApplicationData {
  const applicant = responseForm.step2_businessData.applicant
  const financials = responseForm.step2_businessData.financials
  const consents = responseForm.step3_verification.consents
  return {
    companyName: applicant.companyName ?? '',
    inn: applicant.inn ?? '',
    legalForm:
      applicant.type === 'IP'
        ? 'ИП'
        : applicant.type === 'OOO'
          ? 'ООО'
          : (applicant.type ?? ''),
    taxSystem: applicant.taxSystem ?? '',
    monthlyRevenue: inputValue(financials.monthlyRevenue),
    existingDebt: inputValue(financials.existingDebt),
    personalData: consents.personalData,
    bkiRequest: consents.bkiRequest,
    fnsRequest: consents.fnsRequest,
    fullName: applicantName(applicant),
    ogrnip: applicant.ogrnip ?? '',
    registrationDate: applicant.registrationDate ?? '',
    okved: applicant.mainOkved ?? '',
    registrationAddress: applicant.registrationAddress ?? '',
    phone: applicant.phone ?? '',
    email: applicant.email ?? '',
    industry:
      getIndustryGroup(applicant.mainOkved)?.key ?? applicant.industry ?? '',
  }
}

export function ApplicationForm(props: ApplicationFormProps) {
  const scope = useApiScope()
  const draft = useApplicationDraft()
  const local = useLocalDraft(`application-draft:${scope}`)
  if (props.resumeOnly && !local?.started && !draft.data) return null
  if (draft.isPending) return <RequestState />
  if (draft.error)
    return (
      <RequestState
        error={draft.error}
        retry={() => {
          void draft.refetch()
        }}
      />
    )
  return (
    <ApplicationFormEditor key={scope} {...props} initialDraft={draft.data} />
  )
}

function ApplicationFormEditor({
  headingTag = 'h1',
  resumeOnly = false,
  initialDraft,
}: ApplicationFormProps & { initialDraft: ApplicationDraft | null }) {
  const scope = useApiScope()
  const storageKey = `application-draft:${scope}`
  const [localDraft] = useState(() => {
    const local = loadLocalDraft(storageKey)
    if (
      (!initialDraft && local?.revision === null) ||
      (local?.started && local.revision === initialDraft?.revision)
    )
      return local
    return null
  })
  const needsFinancingReview = Boolean(
    !localDraft &&
    initialDraft &&
    initialDraft.currentStep > 0 &&
    initialDraft.form.step1_financingParameters.termDays === null,
  )
  const [form, setForm] = useState(() =>
    localDraft
      ? {
          description: localDraft.description,
          amount: localDraft.amount,
          termDays: localDraft.termDays,
          purpose: localDraft.purpose,
        }
      : initialDraft
        ? financingFields(initialDraft.form)
        : emptyDraft,
  )
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(
    localDraft?.currentStep ??
      (needsFinancingReview ? 0 : (initialDraft?.currentStep ?? 0)),
  )
  const [started, setStarted] = useState(
    localDraft?.started ?? Boolean(initialDraft),
  )
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [revision, setRevision] = useState<number | null>(
    initialDraft?.revision ?? null,
  )
  const [draftCreatedAt, setDraftCreatedAt] = useState(
    localDraft?.createdAt ??
      initialDraft?.form.createdAt ??
      new Date().toISOString(),
  )
  const [acceptedAt, setAcceptedAt] = useState<string | null>(
    localDraft?.acceptedAt ??
      initialDraft?.form.step3_verification.consents.acceptedAt ??
      null,
  )
  const [prefillMessage, setPrefillMessage] = useState('')
  const [serverForm, setServerForm] = useState<ApplicationForm | null>(
    localDraft?.serverForm ?? initialDraft?.form ?? null,
  )
  const [aiFilled, setAiFilled] = useState<ReadonlySet<string>>(
    new Set(localDraft?.aiFilled ?? initialDraft?.aiFilled),
  )
  const [missingFields, setMissingFields] = useState<ReadonlySet<string>>(
    new Set(localDraft?.missingFields ?? initialDraft?.missingFields),
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const formRef = useRef<HTMLFormElement>(null)
  const termRef = useRef<HTMLDivElement>(null)
  const stepHeadingRef = useRef<HTMLHeadingElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const discardButtonRef = useRef<HTMLButtonElement>(null)
  const submitting = useRef(false)
  const saving = useRef(false)
  const savedSnapshot = useRef(
    initialDraft
      ? JSON.stringify({
          form: initialDraft.form,
          currentStep: initialDraft.currentStep,
          aiFilled: initialDraft.aiFilled,
          missingFields: initialDraft.missingFields,
        })
      : '',
  )
  const id = useId()
  const cache = useQueryClient()
  const dashboard = useDashboard()
  const draft = useApplicationDraft()
  const draftKey = ['client', scope, 'application-draft']
  const navigate = useNavigate()
  const company = dashboard.data?.company
  const isIp = company?.legalForm === 'IP'
  const steps = isIp ? ipFormSteps : formSteps
  const [ipEdits, setIpEdits] = useState<Partial<IpApplicationData>>(
    localDraft?.ipEdits ??
      (initialDraft
        ? {
            ...applicantFields(initialDraft.form),
            ...(needsFinancingReview ? { existingDebt: '' } : {}),
          }
        : {}),
  )
  const [ipConfirmed, setIpConfirmed] = useState(
    localDraft?.confirmed ??
      initialDraft?.form.prefilled?.confirmedByUser ??
      false,
  )
  const [needsDebtReview, setNeedsDebtReview] = useState(
    localDraft?.needsDebtReview ?? needsFinancingReview,
  )
  const ipData: IpApplicationData = {
    companyName: company?.name ?? '',
    inn: company?.inn ?? '',
    legalForm: 'ИП',
    taxSystem: '',
    monthlyRevenue: '',
    existingDebt: '0',
    personalData: false,
    bkiRequest: false,
    fnsRequest: false,
    fullName: company?.name.replace(/^ИП\s+/, '') ?? '',
    ogrnip: '',
    registrationDate: '',
    okved: company?.okved ?? '',
    registrationAddress: '',
    phone: '',
    email: '',
    ...ipEdits,
    industry:
      getIndustryGroup(ipEdits.okved ?? company?.okved)?.key ??
      ipEdits.industry ??
      '',
  }

  function updateIpData(patch: Partial<IpApplicationData>) {
    const next = { ...ipData, ...patch }
    if (patch.existingDebt !== undefined && patch.existingDebt.trim())
      setNeedsDebtReview(false)
    if (next.personalData && next.bkiRequest && next.fnsRequest) {
      if (!acceptedAt) setAcceptedAt(new Date().toISOString())
    } else {
      setAcceptedAt(null)
    }
    setIpEdits((previous) => ({ ...previous, ...patch }))
    if (
      !Object.keys(patch).length ||
      Object.keys(patch).some((key) =>
        [
          'companyName',
          'inn',
          'legalForm',
          'fullName',
          'ogrnip',
          'registrationDate',
          'okved',
          'registrationAddress',
        ].includes(key),
      )
    )
      setIpConfirmed(false)
  }

  function restoreFields(responseForm: ApplicationForm) {
    const consents = responseForm.step3_verification.consents
    setServerForm(responseForm)
    setForm(financingFields(responseForm))
    setIpEdits(applicantFields(responseForm))
    setIpConfirmed(responseForm.prefilled?.confirmedByUser ?? false)
    setNeedsDebtReview(false)
    setAcceptedAt(consents.acceptedAt)
    setDraftCreatedAt(responseForm.createdAt ?? new Date().toISOString())
  }

  function applyPrefill(response: PrefillResponse) {
    restoreFields(response.form)
    setAiFilled(new Set(response.aiFilled))
    setMissingFields(new Set(response.missingFields))
    setStarted(true)
    setPrefillMessage(
      'Поля заполнены по вашему запросу. Проверьте их перед отправкой.',
    )
    setErrors({})
    setStep(0)
    setOpen(true)
  }

  function buildSubmission(): ApplicationForm {
    const name = splitApplicantName(ipData.fullName)
    const accepted =
      ipData.personalData && ipData.bkiRequest && ipData.fnsRequest
    return {
      applicationId: serverForm?.applicationId ?? null,
      createdAt: draftCreatedAt,
      status: 'DRAFT',
      step1_financingParameters: {
        businessTask:
          nullableText(form.description) ?? nullableText(form.purpose),
        amount: numberOrNull(form.amount),
        termDays: numberOrNull(form.termDays),
        purpose: nullableText(form.purpose),
      },
      step2_businessData: {
        applicant: {
          type: company?.legalForm ?? null,
          companyName: nullableText(ipData.companyName),
          inn: nullableText(ipData.inn),
          taxSystem: nullableText(ipData.taxSystem),
          ...name,
          ogrnip: nullableText(ipData.ogrnip),
          ogrn: serverForm?.step2_businessData.applicant.ogrn ?? null,
          registrationDate: registrationDateValue(ipData.registrationDate),
          mainOkved: nullableText(ipData.okved),
          industry: nullableText(ipData.industry),
          phone: nullableText(ipData.phone),
          email: nullableText(ipData.email),
          registrationAddress: nullableText(ipData.registrationAddress),
        },
        financials: {
          monthlyRevenue: numberOrNull(ipData.monthlyRevenue),
          existingDebt: numberOrNull(ipData.existingDebt),
        },
      },
      prefilled: {
        source: serverForm?.prefilled?.source ?? 'PROFILE',
        fetchedAt: serverForm?.prefilled?.fetchedAt ?? draftCreatedAt,
        confirmedByUser: ipConfirmed,
      },
      step3_verification: {
        consents: {
          personalData: ipData.personalData,
          bkiRequest: ipData.bkiRequest,
          fnsRequest: ipData.fnsRequest,
          acceptedAt: accepted ? acceptedAt : null,
        },
      },
      meta: serverForm?.meta ?? {
        formVersion: '1.3',
        events: ['form_started'],
      },
    }
  }

  useEffect(() => {
    try {
      if (!started && !Object.values(form).some(Boolean)) {
        sessionStorage.removeItem(storageKey)
        return
      }
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({
          ...form,
          ipEdits,
          currentStep: step,
          started,
          serverForm,
          confirmed: ipConfirmed,
          needsDebtReview,
          acceptedAt,
          createdAt: draftCreatedAt,
          aiFilled: [...aiFilled],
          missingFields: [...missingFields],
          revision,
          updatedAt: new Date().toISOString(),
        }),
      )
      window.dispatchEvent(new Event('application-draft-changed'))
    } catch {
      /* Storage may be unavailable. */
    }
  }, [
    form,
    ipEdits,
    step,
    started,
    serverForm,
    ipConfirmed,
    needsDebtReview,
    acceptedAt,
    draftCreatedAt,
    aiFilled,
    missingFields,
    revision,
    storageKey,
  ])
  useEffect(() => {
    if (open) stepHeadingRef.current?.focus()
  }, [step, open])

  const saveDraft = useMutation({
    mutationFn: async (snapshot: {
      form: ApplicationForm
      currentStep: number
      aiFilled: string[]
      missingFields: string[]
    }) => {
      const save = (currentRevision: number | null) =>
        apiRequest('/api/applications/draft', applicationDraftSchema, {
          method: 'PUT',
          body: JSON.stringify({ ...snapshot, revision: currentRevision }),
        })
      try {
        return await save(revision)
      } catch (error) {
        if (!(error instanceof ApiError) || error.code !== 'DRAFT_CONFLICT')
          throw error
        const current = await apiOptionalRequest(
          '/api/applications/draft',
          applicationDraftSchema,
        )
        return save(current?.revision ?? null)
      }
    },
    onSuccess: (saved) => {
      cache.setQueryData(draftKey, saved)
      setRevision(saved.revision)
      setServerForm(saved.form)
      setDraftCreatedAt(saved.form.createdAt ?? draftCreatedAt)
      setStep(saved.currentStep)
      setStarted(true)
      savedSnapshot.current = JSON.stringify({
        form: saved.form,
        currentStep: saved.currentStep,
        aiFilled: saved.aiFilled,
        missingFields: saved.missingFields,
      })
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'LEGAL_FORM_REQUIRED') {
        setOpen(false)
        void cache.invalidateQueries({ queryKey: sessionKey })
      }
    },
    onSettled: () => {
      saving.current = false
    },
  })

  const discardDraft = useMutation({
    mutationFn: () => apiEmpty('/api/applications/draft', { method: 'DELETE' }),
    onSuccess: () => {
      cache.setQueryData(draftKey, null)
      setForm(emptyDraft)
      setIpEdits({})
      setIpConfirmed(false)
      setNeedsDebtReview(false)
      setAcceptedAt(null)
      setRevision(null)
      setServerForm(null)
      setStarted(false)
      setStep(0)
      setAiFilled(new Set())
      setMissingFields(new Set())
      setErrors({})
      setConfirmDiscard(false)
      setPrefillMessage('')
      setDraftCreatedAt(new Date().toISOString())
      savedSnapshot.current = ''
      try {
        sessionStorage.removeItem(storageKey)
      } catch {
        /* Storage may be unavailable. */
      }
    },
  })

  const prefill = useMutation({
    mutationFn: (text: string) =>
      apiRequest('/api/ai/prefill', prefillResponseSchema, {
        method: 'POST',
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(60_000),
      }),
    onSuccess: applyPrefill,
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'LEGAL_FORM_REQUIRED') {
        void cache.invalidateQueries({ queryKey: sessionKey })
        return
      }
      if (error instanceof ApiError && error.code === 'SESSION_CHANGED') return
      if (error instanceof ApiError && [400, 401, 403].includes(error.status)) {
        setErrors({ prefill: error.message })
        return
      }
      setPrefillMessage(
        'Не удалось заполнить поля автоматически. Заполните эту же форму вручную.',
      )
      setErrors({})
      setStarted(true)
      setStep(0)
      setOpen(true)
    },
  })

  const submit = useMutation({
    mutationFn: (body: z.infer<typeof applicationFormSubmissionSchema>) =>
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
      setIpEdits({})
      setIpConfirmed(false)
      setNeedsDebtReview(false)
      setServerForm(null)
      setAiFilled(new Set())
      setMissingFields(new Set())
      setPrefillMessage('')
      setStarted(false)
      setAcceptedAt(null)
      setRevision(null)
      setStep(0)
      savedSnapshot.current = ''
      cache.setQueryData(draftKey, null)
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
    if (prefill.isPending || saveDraft.isPending || submit.isPending) return
    if (!manualInput && !form.description.trim()) {
      setErrors({ description: 'Опишите, на что нужны деньги' })
      return
    }
    returnFocusRef.current = trigger
    setErrors({})
    if (manualInput) {
      setPrefillMessage('')
      setStep(0)
      setStarted(true)
      setOpen(true)
      return
    }
    setPrefillMessage('')
    prefill.mutate(form.description.trim())
  }
  function handleNext(event: FormEvent) {
    event.preventDefault()
    if (submitting.current || saving.current) return
    const result = createApplicationSchema.safeParse({
      amount: Number(form.amount.replace(/\s/g, '').replace(',', '.')),
      termDays: Number(form.termDays),
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
      else {
        const field = String(result.error.issues[0]?.path[0])
        if (field === 'termDays') termRef.current?.focus()
        else
          formRef.current
            ?.querySelector<HTMLInputElement>(`[name="${field}"]`)
            ?.focus()
      }
      return
    }
    const businessTask = form.description.trim() || result.data.purpose
    if (businessTask.length > 500) {
      setErrors({
        description: 'Бизнес-задача должна быть не длиннее 500 символов',
      })
      if (step !== 0) setStep(0)
      return
    }
    if (isIp && (step === 1 || step === steps.length - 1)) {
      const revenue = numberOrNull(ipData.monthlyRevenue)
      const debt = numberOrNull(ipData.existingDebt)
      const businessErrors: Record<string, string> = {}
      if (!ipData.companyName.trim())
        businessErrors.companyName = 'Укажите название'
      if (!/^\d{12}$/.test(ipData.inn))
        businessErrors.inn = 'ИНН ИП должен содержать 12 цифр'
      if (!ipData.legalForm.trim())
        businessErrors.legalForm = 'Укажите форму бизнеса'
      if (!ipData.taxSystem)
        businessErrors.taxSystem = 'Выберите систему налогообложения'
      if (revenue === null || revenue <= 0)
        businessErrors.monthlyRevenue =
          'Среднемесячная выручка должна быть больше 0 ₽'
      if (debt === null || debt < 0)
        businessErrors.existingDebt = 'Укажите ежемесячный платеж от 0 ₽'
      if (!ipData.personalData)
        businessErrors.personalData = 'Подтвердите согласие'
      if (!ipData.bkiRequest) businessErrors.bkiRequest = 'Подтвердите согласие'
      if (!ipData.fnsRequest) businessErrors.fnsRequest = 'Подтвердите согласие'
      if (Object.keys(businessErrors).length) {
        setErrors(businessErrors)
        focusInvalidField(Object.keys(businessErrors)[0])
        return
      }
    }
    if (isIp && step >= 2) {
      const registration = registrationSchema.safeParse(
        buildSubmission().step2_businessData.applicant,
      )
      if (!registration.success) {
        const registrationErrors = Object.fromEntries(
          registration.error.issues.map((issue) => {
            const name = String(issue.path[0])
            const field =
              name === 'firstName' || name === 'lastName'
                ? 'fullName'
                : name === 'mainOkved'
                  ? 'okved'
                  : name
            return [field, issue.message]
          }),
        )
        setErrors(registrationErrors)
        focusInvalidField(Object.keys(registrationErrors)[0])
        return
      }
    }
    setErrors({})
    if (step < steps.length - 1) {
      const snapshotForm = applicationFormSchema.safeParse(buildSubmission())
      if (!snapshotForm.success) {
        setErrors({
          registrationDate: 'Укажите дату в формате ДД.ММ.ГГГГ',
          submission: 'Проверьте формат полей перед сохранением',
        })
        return
      }
      const snapshot = {
        form: snapshotForm.data,
        currentStep: step + 1,
        aiFilled: [...aiFilled],
        missingFields: [...missingFields],
      }
      if (savedSnapshot.current === JSON.stringify(snapshot)) {
        setStep(step + 1)
      } else {
        saving.current = true
        const previousStep = step
        setStep(step + 1)
        saveDraft.mutate(snapshot, {
          onError: () => setStep(previousStep),
        })
      }
      return
    }
    if (!isIp) {
      setErrors({
        submission: 'Расширенная анкета для ООО будет подключена отдельно.',
      })
      return
    }
    const submission =
      applicationFormSubmissionSchema.safeParse(buildSubmission())
    if (!submission.success) {
      setErrors({
        submission:
          submission.error.issues[0]?.message ?? 'Проверьте поля анкеты',
      })
      return
    }
    submitting.current = true
    submit.mutate(submission.data)
  }
  function focusInvalidField(name: string | undefined) {
    if (!name) return
    formRef.current
      ?.querySelector<HTMLElement>(
        `[name="${name}"]:not([type="hidden"]), [id$="-${name}-input"]`,
      )
      ?.focus()
  }
  const busy =
    prefill.isPending ||
    saveDraft.isPending ||
    submit.isPending ||
    discardDraft.isPending

  return (
    <>
      {!resumeOnly && (
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
          <p id={`${id}-intent-terms`}>
            <strong>В этой анкете доступны только 30, 60 или 90 дней.</strong>{' '}
            Укажите один из этих сроков в описании. Это срок транша, а не всего
            договора.
          </p>
          <Textarea
            id={`${id}-intent`}
            name="description"
            aria-label="На что нужны деньги"
            aria-describedby={`${id}-intent-terms`}
            block
            autosize
            minRows={4}
            maxRows={8}
            maxLength={2000}
            value={form.description}
            error={errors.description}
            placeholder="Например: нужно 1,5 млн ₽ на закупку товара на 60 дней"
            onChange={(_, { value }) =>
              setForm({ ...form, description: value })
            }
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
              loading={prefill.isPending}
              disabled={
                prefill.isPending ||
                busy ||
                draft.isPending ||
                dashboard.isPending ||
                Boolean(dashboard.error)
              }
              onClick={(event: MouseEvent<HTMLButtonElement>) =>
                start(false, event.currentTarget)
              }
            >
              Продолжить
            </Button>
            <Button
              view="secondary"
              disabled={
                prefill.isPending ||
                busy ||
                draft.isPending ||
                dashboard.isPending ||
                Boolean(dashboard.error)
              }
              onClick={(event: MouseEvent<HTMLButtonElement>) =>
                start(true, event.currentTarget)
              }
            >
              Выбрать самостоятельно
            </Button>
          </div>
          {prefill.isPending && (
            <p role="status">Анализируем запрос и заполняем поля…</p>
          )}
          {errors.prefill && <p role="alert">{errors.prefill}</p>}
        </section>
      )}
      {started && !open && (
        <section
          className={styles.resumeCard}
          aria-labelledby={`${id}-resume-title`}
        >
          <div className={styles.resumeIcon}>
            <DocumentMIcon aria-hidden="true" />
          </div>
          <div className={styles.resumeContent}>
            <Typography.Text view="primary-small" color="secondary">
              Заявка начата
            </Typography.Text>
            <h2 id={`${id}-resume-title`}>
              Продолжите с того места, где остановились
            </h2>
            <p>
              Шаг {step + 1} из {steps.length}: {steps[step]}
              {form.amount
                ? ` · ${formatMoney(numberOrNull(form.amount) ?? 0)}`
                : ''}
            </p>
            <p>
              {revision === null
                ? 'Поля сохранены в этом браузере. При переходе к следующему шагу сохраним анкету в кабинете.'
                : 'Пройденные шаги сохранены в кабинете.'}
            </p>
          </div>
          <div className={styles.resumeActions}>
            <Button
              view="primary"
              size={48}
              disabled={busy || draft.isPending}
              onClick={(event: MouseEvent<HTMLButtonElement>) => {
                returnFocusRef.current = event.currentTarget
                setErrors({})
                setOpen(true)
              }}
            >
              Продолжить заявку
            </Button>
            <Button
              view="text"
              size={32}
              ref={discardButtonRef}
              disabled={busy}
              onClick={() => setConfirmDiscard(true)}
            >
              Сбросить заявку
            </Button>
          </div>
          {discardDraft.error && (
            <p role="alert">{discardDraft.error.message}</p>
          )}
        </section>
      )}
      {draft.error && (
        <RequestState
          error={draft.error}
          retry={() => {
            void draft.refetch()
          }}
        />
      )}
      <Modal
        open={confirmDiscard}
        size={600}
        fixedPosition
        scrollLock
        disableEscapeKeyDown={discardDraft.isPending}
        disableBackdropClick={discardDraft.isPending}
        onClose={() => {
          if (!discardDraft.isPending) setConfirmDiscard(false)
        }}
        wrapperProps={{ 'aria-labelledby': `${id}-discard-title` }}
        onUnmount={() =>
          requestAnimationFrame(() => {
            if (
              discardButtonRef.current?.isConnected &&
              !document.querySelector('[role="dialog"]')
            )
              discardButtonRef.current.focus()
          })
        }
      >
        <Modal.Header
          hasCloser={!discardDraft.isPending}
          title={<span id={`${id}-discard-title`}>Сбросить заявку?</span>}
          closerProps={{ 'aria-label': 'Закрыть подтверждение' }}
        />
        <Modal.Content>
          <p className={styles.discardText}>
            Текущий черновик и несохраненные изменения будут удалены. Уже
            отправленные заявки не изменятся.
          </p>
          {discardDraft.error && (
            <p role="alert">{discardDraft.error.message}</p>
          )}
        </Modal.Content>
        <Modal.Footer>
          <div className={styles.footer}>
            <Button
              view="secondary"
              disabled={discardDraft.isPending}
              onClick={() => setConfirmDiscard(false)}
            >
              Продолжить заполнение
            </Button>
            <Button
              view="primary"
              loading={discardDraft.isPending}
              disabled={discardDraft.isPending}
              onClick={() => discardDraft.mutate()}
            >
              Сбросить заявку
            </Button>
          </div>
        </Modal.Footer>
      </Modal>
      <Modal
        open={open}
        size={800}
        fixedPosition
        scrollLock
        disableRestoreFocus
        className={styles.modal}
        disableEscapeKeyDown={saveDraft.isPending || submit.isPending}
        disableBackdropClick={saveDraft.isPending || submit.isPending}
        onClose={() => {
          if (!saveDraft.isPending && !submit.isPending) setOpen(false)
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
          hasCloser={!saveDraft.isPending && !submit.isPending}
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
            className={`${styles.form} ${isIp && step > 0 && step < 3 ? styles.ipForm : ''}`}
            noValidate
            aria-busy={saveDraft.isPending || submit.isPending}
          >
            <ol className={styles.stepper} aria-label="Заполнение заявки">
              {steps.map((title, index) => (
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
              Шаг {step + 1} из {steps.length}
            </Typography.Text>
            <h2 ref={stepHeadingRef} tabIndex={-1} className={styles.stepTitle}>
              {steps[step]}
            </h2>
            <p>
              Все поля анкеты обязательны. Если кредитов нет, укажите платеж 0
              ₽.
            </p>
            {needsDebtReview && (
              <p role="status">
                Условия изменились: выберите срок в днях и повторно укажите
                ежемесячный платеж по кредитам. Остальные данные черновика
                сохранены.
              </p>
            )}
            {step === 0 && (
              <>
                {form.description.trim() && (
                  <div className={styles.context}>
                    <strong>Ваша бизнес-задача</strong>
                    <p>{form.description}</p>
                    {aiFilled.has('step1_financingParameters.businessTask') && (
                      <Typography.Text view="primary-small" color="secondary">
                        Заполнено ИИ, проверьте
                      </Typography.Text>
                    )}
                  </div>
                )}
                {prefillMessage && <p role="status">{prefillMessage}</p>}
                {errors.description && <p role="alert">{errors.description}</p>}
                <div className={styles.fields}>
                  <Input
                    name="amount"
                    required
                    block
                    label="Сумма, ₽"
                    labelView="outer"
                    inputMode="decimal"
                    value={form.amount}
                    hint={
                      aiFilled.has('step1_financingParameters.amount')
                        ? 'Заполнено ИИ, проверьте'
                        : undefined
                    }
                    error={
                      errors.amount ??
                      (missingFields.has('step1_financingParameters.amount') &&
                      !form.amount.trim()
                        ? 'Заполните поле'
                        : undefined)
                    }
                    onChange={(_, { value }) =>
                      setForm({ ...form, amount: value })
                    }
                  />
                  <Select
                    ref={termRef}
                    id={`${id}-termDays`}
                    name="termDays"
                    block
                    label="Срок, дней"
                    labelView="outer"
                    fieldProps={{ 'aria-required': true }}
                    options={termOptions}
                    selected={form.termDays || null}
                    placeholder="Выберите срок"
                    hint={
                      aiFilled.has('step1_financingParameters.termDays')
                        ? 'Заполнено ИИ, проверьте'
                        : undefined
                    }
                    error={
                      errors.termDays ??
                      (missingFields.has(
                        'step1_financingParameters.termDays',
                      ) && !form.termDays.trim()
                        ? 'Заполните поле'
                        : undefined)
                    }
                    onChange={({ selected }) =>
                      setForm({ ...form, termDays: selected?.key ?? '' })
                    }
                  />
                  <Input
                    name="purpose"
                    required
                    block
                    label="Цель финансирования"
                    labelView="outer"
                    placeholder="Например, закупка товара"
                    maxLength={100}
                    value={form.purpose}
                    hint={
                      aiFilled.has('step1_financingParameters.purpose')
                        ? 'Заполнено ИИ, проверьте'
                        : undefined
                    }
                    error={
                      errors.purpose ??
                      (missingFields.has('step1_financingParameters.purpose') &&
                      !form.purpose.trim()
                        ? 'Заполните поле'
                        : undefined)
                    }
                    onChange={(_, { value }) =>
                      setForm({ ...form, purpose: value })
                    }
                  />
                </div>
                <p>
                  Сумма от 50 000 до 20 000 000 ₽, срок 30, 60 или 90 дней.
                  Подходящие продукты и условия будут доступны после
                  рассмотрения заявки.
                </p>
              </>
            )}
            {step === 1 && isIp && (
              <IpApplicationFields
                section="business"
                value={ipData}
                onChange={updateIpData}
                aiFilled={aiFilled}
                missingFields={missingFields}
                errors={errors}
              />
            )}
            {step === 2 && isIp && (
              <IpApplicationFields
                section="registration"
                value={ipData}
                onChange={updateIpData}
                profileMatches={ipData.inn === company?.inn}
                confirmed={ipConfirmed}
                onConfirm={() => setIpConfirmed(true)}
                aiFilled={aiFilled}
                missingFields={missingFields}
                errors={errors}
              />
            )}
            {step === 1 && !isIp && (
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
            {step === steps.length - 1 && (
              <>
                <p>
                  Убедитесь, что параметры соответствуют вашей задаче. После
                  отправки заявка поступит на рассмотрение.
                </p>
                {isIp ? (
                  <div className={styles.reviewParameters}>
                    <h3 className={styles.reviewTitle}>
                      Параметры финансирования
                    </h3>
                    {form.description.trim() && (
                      <div>
                        <FieldLabel
                          htmlFor={`${id}-reviewDescription`}
                          text="Бизнес-задача"
                          hint="Ваш исходный запрос о финансировании"
                        />
                        <Textarea
                          id={`${id}-reviewDescription`}
                          name="reviewDescription"
                          aria-label="Бизнес-задача"
                          block
                          autosize
                          minRows={2}
                          maxRows={6}
                          maxLength={2000}
                          value={form.description}
                          onChange={(_, { value }) =>
                            setForm({ ...form, description: value })
                          }
                        />
                      </div>
                    )}
                    <div>
                      <FieldLabel
                        htmlFor={`${id}-reviewAmount`}
                        text="Сумма, ₽"
                        hint="Запрашиваемая сумма финансирования"
                      />
                      <Input
                        id={`${id}-reviewAmount`}
                        name="reviewAmount"
                        required
                        block
                        aria-label="Сумма, ₽"
                        inputMode="decimal"
                        value={form.amount}
                        onChange={(_, { value }) =>
                          setForm({ ...form, amount: value })
                        }
                      />
                    </div>
                    <div>
                      <Select
                        id={`${id}-reviewTermDays`}
                        name="reviewTermDays"
                        block
                        label="Срок, дней"
                        labelView="outer"
                        fieldProps={{ 'aria-required': true }}
                        hint="Доступные сроки: 30, 60 или 90 дней"
                        options={termOptions}
                        selected={form.termDays || null}
                        placeholder="Выберите срок"
                        onChange={({ selected }) =>
                          setForm({ ...form, termDays: selected?.key ?? '' })
                        }
                      />
                    </div>
                    <div>
                      <FieldLabel
                        htmlFor={`${id}-reviewPurpose`}
                        text="Цель финансирования"
                        hint="Бизнес-задача, для которой требуется кредит"
                      />
                      <Input
                        id={`${id}-reviewPurpose`}
                        name="reviewPurpose"
                        required
                        block
                        aria-label="Цель финансирования"
                        maxLength={100}
                        value={form.purpose}
                        onChange={(_, { value }) =>
                          setForm({ ...form, purpose: value })
                        }
                      />
                    </div>
                  </div>
                ) : (
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
                      <dd>{form.termDays} дней</dd>
                    </div>
                    <div>
                      <dt>Цель</dt>
                      <dd>{form.purpose}</dd>
                    </div>
                  </dl>
                )}
                {isIp && (
                  <>
                    <h3 className={styles.reviewTitle}>Данные бизнеса</h3>
                    <IpApplicationFields
                      section="business"
                      value={ipData}
                      onChange={updateIpData}
                      aiFilled={aiFilled}
                      missingFields={missingFields}
                      errors={errors}
                    />
                    <h3 className={styles.reviewTitle}>
                      Регистрационные данные
                    </h3>
                    <IpApplicationFields
                      section="registration"
                      value={ipData}
                      onChange={updateIpData}
                      aiFilled={aiFilled}
                      missingFields={missingFields}
                      errors={errors}
                    />
                  </>
                )}
                <p>
                  Ставка и платеж будут указаны в предложении банка. Отправка
                  заявки не означает одобрение кредита.
                </p>
              </>
            )}
            {errors.submission && <p role="alert">{errors.submission}</p>}
            {saveDraft.error && <RequestState error={saveDraft.error} />}
            {submit.error && <RequestState error={submit.error} />}
          </form>
        </Modal.Content>
        <Modal.Footer sticky>
          <div className={styles.footer}>
            <Button
              view="secondary"
              disabled={saveDraft.isPending || submit.isPending}
              onClick={() => (step > 0 ? setStep(step - 1) : setOpen(false))}
            >
              {step > 0 ? 'Назад' : 'К бизнес-задаче'}
            </Button>
            <Button
              form={`${id}-form`}
              type="submit"
              view="primary"
              disabled={
                saveDraft.isPending ||
                submit.isPending ||
                Boolean(dashboard.error) ||
                !company
              }
              loading={submit.isPending}
            >
              {step === steps.length - 1 ? 'Отправить заявку' : 'Продолжить'}
            </Button>
          </div>
        </Modal.Footer>
      </Modal>
    </>
  )
}
