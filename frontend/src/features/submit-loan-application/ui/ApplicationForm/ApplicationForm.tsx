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
  applicationPurposeLabels,
  createApplicationSchema,
} from '@/entities/loan-application'
import {
  applicationApplicantSubmissionSchema,
  applicationFormSubmissionSchema,
  applicationFormSchema,
  applicationDraftSchema,
  oooApplicantSubmissionSchema,
  oooFinancialsSubmissionSchema,
  useApplicationDraft,
  type ApplicationDraft,
  type ApplicationForm,
  type PrefillResponse,
} from '@/entities/application-form'
import { useDashboard } from '@/entities/dashboard'
import { getIndustryGroup } from '@/entities/company'
import { isCurrentSession, sessionKey, useSession } from '@/entities/session'
import {
  apiRequest,
  apiOptionalRequest,
  apiEmpty,
  ApiError,
  getSessionGeneration,
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
  OooApplicationFields,
  type OooApplicationData,
} from '../OooApplicationFields'
import { ApplicationPreparation } from '../ApplicationPreparation'
import { useApplicationPrefill } from '../../model/use-application-prefill'
import {
  loadLocalDraft,
  getApplicationDraftStep,
  getServerDraftStep,
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
const oooPurposeOptions = Object.entries(applicationPurposeLabels).map(
  ([key, content]) => ({ key, content }),
)
const registrationSchema = applicationApplicantSubmissionSchema.pick({
  firstName: true,
  lastName: true,
  ogrnip: true,
  mainOkved: true,
  industry: true,
  registrationAddress: true,
  phone: true,
  email: true,
})
const oooBusinessSchema = oooApplicantSubmissionSchema.pick({
  companyName: true,
  inn: true,
  taxSystem: true,
})
const oooRegistrationSchema = oooApplicantSubmissionSchema.pick({
  ogrn: true,
  kpp: true,
  mainOkved: true,
  industry: true,
  registrationAddress: true,
  phone: true,
  email: true,
})
const oooFormSteps = [
  'Параметры финансирования',
  'ООО и финансы',
  'Проверка организации',
  'Документы и согласия',
  'Проверка и отправка',
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

function inputValue(value: string | number | null | undefined) {
  return value == null ? '' : String(value)
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

function applicantFields(
  responseForm: ApplicationForm,
): IpApplicationData & OooApplicationData {
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
    annualRevenue: inputValue(financials.annualRevenue),
    averageEmployeeCount: inputValue(financials.averageEmployeeCount),
    otherMonthlyObligations: inputValue(financials.otherMonthlyObligations ?? 0),
    personalData: consents.personalData,
    bkiRequest: consents.bkiRequest,
    fnsRequest: consents.fnsRequest,
    fullName: applicantName(applicant),
    ogrnip: applicant.ogrnip ?? '',
    ogrn: applicant.ogrn ?? '',
    kpp: applicant.kpp ?? '',
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
      (needsFinancingReview ? 0 : getApplicationDraftStep(initialDraft)),
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
  const session = useSession()
  const dashboard = useDashboard()
  const draft = useApplicationDraft()
  const draftKey = ['client', scope, 'application-draft']
  const navigate = useNavigate()
  const company = dashboard.data?.company
  const contacts = session.data?.userId === scope ? session.data : null
  const legalForm =
    company?.legalForm ??
    serverForm?.step2_businessData.applicant.type ??
    contacts?.legalForm
  const isIp = legalForm === 'IP'
  const isOoo = legalForm === 'OOO'
  const steps = isOoo ? oooFormSteps : ipFormSteps
  const purposeOptions =
    oooPurposeOptions.some(({ key }) => key === form.purpose) || !form.purpose
      ? oooPurposeOptions
      : [...oooPurposeOptions, { key: form.purpose, content: form.purpose }]
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
  const [oooEdits, setOooEdits] = useState<Partial<OooApplicationData>>(() => {
    const source = localDraft?.serverForm ?? initialDraft?.form
    return {
      ...(source ? applicantFields(source) : {}),
      ...localDraft?.oooEdits,
      ...(needsFinancingReview ? { existingDebt: '' } : {}),
    }
  })
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
    phone: serverForm
      ? (serverForm.step2_businessData.applicant.phone ?? '')
      : (contacts?.phone ?? ''),
    email: serverForm
      ? (serverForm.step2_businessData.applicant.email ?? '')
      : (contacts?.email ?? ''),
    ...ipEdits,
    industry:
      getIndustryGroup(ipEdits.okved ?? company?.okved)?.key ??
      ipEdits.industry ??
      '',
  }
  const oooData: OooApplicationData = {
    taxSystem: '',
    monthlyRevenue: '',
    annualRevenue: '',
    averageEmployeeCount: '',
    existingDebt: '0',
    otherMonthlyObligations: '0',
    personalData: false,
    bkiRequest: false,
    fnsRequest: false,
    ogrn: serverForm?.step2_businessData.applicant.ogrn ?? '',
    kpp: serverForm?.step2_businessData.applicant.kpp ?? '',
    registrationAddress: '',
    phone: serverForm
      ? (serverForm.step2_businessData.applicant.phone ?? '')
      : (contacts?.phone ?? ''),
    email: serverForm
      ? (serverForm.step2_businessData.applicant.email ?? '')
      : (contacts?.email ?? ''),
    ...oooEdits,
    companyName: company?.name ?? oooEdits.companyName ?? '',
    inn: company?.inn ?? oooEdits.inn ?? '',
    okved: company?.okved ?? oooEdits.okved ?? '',
    registrationDate:
      registrationDateValue(
        serverForm?.step2_businessData.applicant.registrationDate ??
          oooEdits.registrationDate ??
          '',
      ) ?? '',
    industry:
      getIndustryGroup(company?.okved ?? oooEdits.okved)?.key ??
      oooEdits.industry ??
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

  function updateOooData(patch: Partial<OooApplicationData>) {
    const next = { ...oooData, ...patch }
    setOooEdits((previous) => ({ ...previous, ...patch }))
    if (next.personalData && next.bkiRequest && next.fnsRequest) {
      if (!acceptedAt) setAcceptedAt(new Date().toISOString())
    } else {
      setAcceptedAt(null)
    }
    if (patch.existingDebt !== undefined && patch.existingDebt.trim())
      setNeedsDebtReview(false)
    if (
      !Object.keys(patch).length ||
      Object.keys(patch).some((key) =>
        [
          'companyName',
          'inn',
          'ogrn',
          'kpp',
          'okved',
          'registrationAddress',
        ].includes(key),
      )
    )
      setIpConfirmed(false)
    setErrors((previous) =>
      Object.fromEntries(
        Object.entries(previous).filter(
          ([key]) => !(key in patch) && key !== 'submission',
        ),
      ),
    )
  }

  function applyPrefill(response: PrefillResponse, description: string) {
    const responseForm = response.form
    const consents = responseForm.step3_verification.consents
    setServerForm(responseForm)
    setForm({ ...financingFields(responseForm), description })
    setIpEdits(applicantFields(responseForm))
    setOooEdits(applicantFields(responseForm))
    setIpConfirmed(responseForm.prefilled?.confirmedByUser ?? false)
    setNeedsDebtReview(false)
    setAcceptedAt(consents.acceptedAt)
    setDraftCreatedAt(responseForm.createdAt ?? new Date().toISOString())
    setAiFilled(new Set(response.aiFilled))
    setMissingFields(new Set(response.missingFields))
    setStarted(true)
    setPrefillMessage(
      response.missingFields.length
        ? 'Основные поля подготовлены. Проверьте их и дополните отмеченное'
        : 'Поля подготовлены. Проверьте их перед отправкой.',
    )
    setErrors({})
    setStep(0)
    setOpen(true)
  }

  function buildSubmission(currentStep = step): ApplicationForm {
    const data = isOoo ? oooData : ipData
    const name = isOoo
      ? { firstName: null, lastName: null, middleName: null }
      : splitApplicantName(ipData.fullName)
    const accepted =
      data.personalData && data.bkiRequest && data.fnsRequest
    const meta = serverForm?.meta ?? {
      formVersion: '1.3',
      events: ['form_started'],
    }
    return {
      applicationId: serverForm?.applicationId ?? null,
      createdAt: draftCreatedAt,
      status: 'DRAFT',
      step1_financingParameters: {
        businessTask:
          nullableText(form.description) ??
          (isOoo ? null : nullableText(form.purpose)),
        amount: numberOrNull(form.amount),
        termDays: numberOrNull(form.termDays),
        purpose: nullableText(form.purpose),
      },
      step2_businessData: {
        applicant: {
          type: legalForm ?? null,
          companyName: nullableText(data.companyName),
          inn: nullableText(data.inn),
          taxSystem: nullableText(data.taxSystem),
          ...name,
          ogrnip: isOoo ? null : nullableText(ipData.ogrnip),
          ogrn: isOoo ? nullableText(oooData.ogrn) : null,
          kpp: isOoo ? nullableText(oooData.kpp) : null,
          registrationDate: registrationDateValue(
            serverForm?.step2_businessData.applicant.registrationDate ??
              data.registrationDate,
          ),
          mainOkved: nullableText(data.okved),
          industry: nullableText(data.industry),
          phone: nullableText(data.phone),
          email: nullableText(data.email),
          registrationAddress: nullableText(data.registrationAddress),
        },
        financials: {
          monthlyRevenue: numberOrNull(data.monthlyRevenue),
          existingDebt: numberOrNull(data.existingDebt),
          ...(isOoo
            ? {
                annualRevenue: numberOrNull(oooData.annualRevenue),
                averageEmployeeCount: numberOrNull(oooData.averageEmployeeCount),
                otherMonthlyObligations: numberOrNull(
                  oooData.otherMonthlyObligations,
                ),
              }
            : {}),
        },
      },
      prefilled: {
        source: serverForm?.prefilled?.source ?? 'PROFILE',
        fetchedAt: serverForm?.prefilled?.fetchedAt ?? draftCreatedAt,
        confirmedByUser: ipConfirmed,
      },
      step3_verification: {
        consents: {
          personalData: data.personalData,
          bkiRequest: data.bkiRequest,
          fnsRequest: data.fnsRequest,
          acceptedAt: accepted ? acceptedAt : null,
        },
      },
      meta: isOoo
        ? {
            ...meta,
            events: [
              ...(meta.events ?? []).filter(
                (event) => !/^ooo_step_[0-4]$/.test(event),
              ),
              `ooo_step_${currentStep}`,
            ],
          }
        : meta,
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
          oooEdits,
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
    oooEdits,
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
      if (saved.form.step2_businessData.applicant.type === 'OOO') {
        const applicant = saved.form.step2_businessData.applicant
        setOooEdits((previous) => ({
          ...previous,
          companyName: applicant.companyName ?? '',
          inn: applicant.inn ?? '',
          okved: applicant.mainOkved ?? '',
          registrationDate: applicant.registrationDate ?? '',
        }))
        if (applicant.mainOkved !== oooData.okved)
          setIpConfirmed(false)
      }
      setDraftCreatedAt(saved.form.createdAt ?? draftCreatedAt)
      setStep(getApplicationDraftStep(saved))
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
      setOooEdits({})
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

  const prefill = useApplicationPrefill({
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
        'Не удалось заполнить поля автоматически. Продолжите в этой форме самостоятельно',
      )
      setErrors({})
      setStarted(true)
      setStep(0)
      setOpen(true)
    },
  })

  const submit = useMutation({
    mutationFn: ({
      body,
      generation,
    }: {
      body: z.infer<typeof applicationFormSubmissionSchema>
      generation: number
    }) => {
      if (!isCurrentSession(cache, scope, generation))
        throw new ApiError(
          409,
          'SESSION_CHANGED',
          'Профиль изменился. Повторите действие.',
        )
      return apiRequest('/api/applications', applicationViewSchema, {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    onSuccess: async (_, { generation }) => {
      if (!isCurrentSession(cache, scope, generation)) return
      await Promise.all([
        cache.cancelQueries({ queryKey: sessionKey, exact: true }),
        cache.cancelQueries({ queryKey: ['client', scope] }),
      ])
      if (!isCurrentSession(cache, scope, generation)) return
      try {
        sessionStorage.removeItem(storageKey)
      } catch {
        /* Storage may be unavailable. */
      }
      setForm(emptyDraft)
      setIpEdits({})
      setOooEdits({})
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
      await Promise.all([
        cache.invalidateQueries({ queryKey: ['client', scope] }),
        cache.invalidateQueries({ queryKey: sessionKey, exact: true }),
      ])
      if (isCurrentSession(cache, scope, generation))
        void navigate(ROUTES.applications, { replace: true })
    },
    onError: (error, { generation }) => {
      if (!isCurrentSession(cache, scope, generation)) return
      if (error instanceof ApiError && error.code === 'LEGAL_FORM_REQUIRED') {
        setOpen(false)
        void cache.invalidateQueries({ queryKey: sessionKey })
      }
    },
    onSettled: () => {
      submitting.current = false
    },
    retry: false,
  })

  function start(manualInput: boolean, trigger: HTMLButtonElement) {
    if (saveDraft.isPending || submit.isPending || discardDraft.isPending) return
    if (!manualInput && prefill.isPending) return
    if (!manualInput && !form.description.trim()) {
      setErrors({ description: 'Опишите, на что нужны деньги' })
      return
    }
    returnFocusRef.current = trigger
    setErrors({})
    if (manualInput) {
      prefill.cancel()
      setPrefillMessage('')
      setStep(0)
      setStarted(true)
      setOpen(true)
      return
    }
    setPrefillMessage('')
    prefill.start(form.description)
  }

  function getOooErrors(section: 'business' | 'registration' | 'consents') {
    const submission = buildSubmission()
    const data = submission.step2_businessData
    const checks =
      section === 'business'
        ? [
            oooBusinessSchema.safeParse(data.applicant),
            oooFinancialsSubmissionSchema.safeParse(data.financials),
          ]
        : section === 'registration'
          ? [oooRegistrationSchema.safeParse(data.applicant)]
          : [
              applicationFormSubmissionSchema.shape.step3_verification.safeParse(
                submission.step3_verification,
              ),
            ]
    const fieldErrors: Record<string, string> = {}
    for (const result of checks) {
      if (result.success) continue
      for (const issue of result.error.issues) {
        const name = String(issue.path.at(-1))
        const field =
          name === 'mainOkved'
            ? 'okved'
            : name === 'acceptedAt'
              ? 'fnsRequest'
              : name
        fieldErrors[field] =
          name === 'acceptedAt'
            ? 'Повторно подтвердите согласия'
            : issue.message
      }
    }
    if (section === 'registration' && !ipConfirmed)
      fieldErrors.confirmed =
        'Подтвердите, что сведения относятся к вашей организации'
    return fieldErrors
  }

  function validateOooField(name: keyof OooApplicationData) {
    const section =
      ['personalData', 'bkiRequest', 'fnsRequest'].includes(name)
        ? 'consents'
        : [
              'companyName',
              'inn',
              'taxSystem',
              'monthlyRevenue',
              'annualRevenue',
              'averageEmployeeCount',
              'existingDebt',
              'otherMonthlyObligations',
            ].includes(name)
          ? 'business'
          : 'registration'
    const message = getOooErrors(section)[name]
    setErrors((previous) => {
      const next = { ...previous }
      if (message) next[name] = message
      else delete next[name]
      return next
    })
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
    const businessTask =
      form.description.trim() || (isOoo ? '' : result.data.purpose)
    if (!businessTask) {
      setErrors({ description: 'Опишите бизнес-задачу' })
      if (step !== 0) setStep(0)
      else focusInvalidField('businessTask')
      return
    }
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
    if (isOoo && step > 0) {
      const sections = [
        { name: 'business', step: 1 },
        { name: 'registration', step: 2 },
        { name: 'consents', step: 3 },
      ] as const
      for (const section of sections) {
        if (step < section.step) continue
        const fieldErrors = getOooErrors(section.name)
        if (Object.keys(fieldErrors).length) {
          setErrors(fieldErrors)
          if (step !== section.step && step !== steps.length - 1)
            setStep(section.step)
          else focusInvalidField(Object.keys(fieldErrors)[0])
          return
        }
      }
    }
    setErrors({})
    if (step < steps.length - 1) {
      const snapshotForm = applicationFormSchema.safeParse(
        buildSubmission(step + 1),
      )
      if (!snapshotForm.success) {
        setErrors({
          submission: 'Проверьте формат полей перед сохранением',
        })
        return
      }
      const snapshot = {
        form: snapshotForm.data,
        currentStep: getServerDraftStep(step + 1, legalForm ?? null),
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
    if (!isIp && !isOoo) {
      setErrors({
        submission: 'Выберите форму бизнеса в профиле компании',
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
    submit.mutate({ body: submission.data, generation: getSessionGeneration() })
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
  const showPreparation =
    !open && (prefill.stage === 'preparing' || prefill.stage === 'slow')
  const oooReadyToSubmit =
    !isOoo ||
    (ipConfirmed &&
      applicationFormSubmissionSchema.safeParse(buildSubmission()).success)
  const oooFieldProps = {
    value: oooData,
    onChange: updateOooData,
    onBlur: validateOooField,
    confirmed: ipConfirmed,
    onConfirm: () => {
      const fieldErrors = getOooErrors('registration')
      delete fieldErrors.confirmed
      if (Object.keys(fieldErrors).length) {
        setErrors(fieldErrors)
        focusInvalidField(Object.keys(fieldErrors)[0])
        return
      }
      setIpConfirmed(true)
      setErrors((previous) => {
        const next = { ...previous }
        delete next.confirmed
        return next
      })
    },
    onEdit: () => updateOooData({}),
    aiFilled,
    missingFields,
    errors,
  }

  return (
    <>
      {!resumeOnly && (
        <>
          <section className={styles.card} aria-busy={prefill.isPending}>
            <div className={styles.startContent}>
              <div
                className={styles.intent}
                data-hidden={showPreparation}
                aria-hidden={showPreparation || undefined}
                inert={showPreparation}
              >
                <header className={styles.intentHeader}>
                  <div className={styles.intentHeading}>
                    <Typography.TitleResponsive
                      tag={headingTag}
                      view="large"
                      font="system"
                      weight="bold"
                    >
                      На что нужны деньги
                    </Typography.TitleResponsive>
                  </div>
                  <p className={styles.intentLead} id={`${id}-intent-help`}>
                    Опишите задачу своими словами. Перенесём детали в анкету,
                    которую вы сможете проверить и изменить.
                  </p>
                </header>
                <div className={styles.intentEditor}>
                  <div className={styles.intentPrompt}>
                    <label htmlFor={`${id}-intent`}>Ваша бизнес-задача</label>
                    <span>Сумма, срок и цель</span>
                  </div>
                  <Textarea
                    id={`${id}-intent`}
                    name="description"
                    aria-label="Ваша бизнес-задача"
                    aria-describedby={`${id}-intent-help ${id}-intent-terms`}
                    block
                    autosize
                    minRows={4}
                    maxRows={8}
                    maxLength={2000}
                    readOnly={prefill.isPending}
                    value={form.description}
                    error={errors.description}
                    placeholder="Например: нужно 1,5 млн ₽ на закупку товара на 60 дней"
                    onChange={(_, { value }) =>
                      setForm({ ...form, description: value })
                    }
                  />
                  <p className={styles.intentTerms} id={`${id}-intent-terms`}>
                    <strong>Срок транша: только 30, 60 или 90 дней.</strong>{' '}
                    Укажите его в описании. Это не срок всего договора.
                  </p>
                </div>
              </div>
              <ApplicationPreparation
                headingTag={headingTag}
                visible={showPreparation}
                slow={prefill.stage === 'slow'}
              />
            </div>
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
                disabled={
                  busy ||
                  draft.isPending ||
                  dashboard.isPending ||
                  Boolean(dashboard.error)
                }
                onClick={(event: MouseEvent<HTMLButtonElement>) =>
                  start(false, event.currentTarget)
                }
              >
                Подготовить заявку
              </Button>
              <Button
                view="secondary"
                disabled={
                  saveDraft.isPending ||
                  submit.isPending ||
                  discardDraft.isPending ||
                  (!prefill.isPending &&
                    (draft.isPending ||
                      dashboard.isPending ||
                      Boolean(dashboard.error)))
                }
                onClick={(event: MouseEvent<HTMLButtonElement>) =>
                  start(true, event.currentTarget)
                }
              >
                Заполнить самостоятельно
              </Button>
            </div>
            {errors.prefill && <p role="alert">{errors.prefill}</p>}
          </section>
          <div
            className={styles.preparationStatus}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {prefill.stage === 'slow'
              ? 'Подготовка ещё идёт. Можно подождать или заполнить заявку самостоятельно.'
              : prefill.isPending
                ? 'Готовим вашу заявку'
                : ''}
          </div>
        </>
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
            className={`${styles.form} ${step > 0 && step < steps.length - 1 ? styles.detailsForm : ''}`}
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
              {isOoo
                ? 'Заполните обязательные сведения об организации. Если обязательств нет, оставьте 0.'
                : 'Все поля анкеты обязательны.'}
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
                {!isOoo && form.description.trim() && (
                  <div className={styles.context}>
                    <strong>Ваша бизнес-задача</strong>
                    <p>{form.description}</p>
                    {aiFilled.has('step1_financingParameters.businessTask') && (
                      <Typography.Text view="primary-small" color="secondary">
                        Заполнено автоматически, проверьте
                      </Typography.Text>
                    )}
                  </div>
                )}
                {prefillMessage && <p role="status">{prefillMessage}</p>}
                {errors.description && <p role="alert">{errors.description}</p>}
                <div className={styles.fields}>
                  {isOoo && (
                    <Textarea
                      name="businessTask"
                      required
                      block
                      label="Бизнес-задача"
                      labelView="outer"
                      autosize
                      minRows={2}
                      maxRows={6}
                      maxLength={500}
                      value={form.description}
                      error={errors.description}
                      placeholder="Например, оплата поставщика до поступления денег от покупателя"
                      onChange={(_, { value }) =>
                        setForm({ ...form, description: value })
                      }
                    />
                  )}
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
                        ? 'Заполнено автоматически, проверьте'
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
                        ? 'Заполнено автоматически, проверьте'
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
                  {isOoo ? (
                    <Select
                      id={`${id}-purpose`}
                      name="purpose"
                      block
                      label="Цель финансирования"
                      labelView="outer"
                      fieldProps={{ 'aria-required': true }}
                      options={purposeOptions}
                      selected={form.purpose || null}
                      placeholder="Выберите цель"
                      hint={
                        aiFilled.has('step1_financingParameters.purpose')
                          ? 'Заполнено автоматически, проверьте'
                          : undefined
                      }
                      error={errors.purpose}
                      onChange={({ selected }) =>
                        setForm({ ...form, purpose: selected?.key ?? '' })
                      }
                    />
                  ) : (
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
                          ? 'Заполнено автоматически, проверьте'
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
                  )}
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
            {step === 1 && isOoo && (
              <OooApplicationFields section="business" {...oooFieldProps} />
            )}
            {step === 2 && isOoo && (
              <OooApplicationFields section="registration" {...oooFieldProps} />
            )}
            {step === 3 && isOoo && (
              <OooApplicationFields section="consents" {...oooFieldProps} />
            )}
            {step === steps.length - 1 && (
              <>
                <p>
                  Убедитесь, что параметры соответствуют вашей задаче. После
                  отправки заявка поступит на рассмотрение.
                </p>
                <div className={styles.reviewParameters}>
                  <h3 className={styles.reviewTitle}>
                    Параметры финансирования
                  </h3>
                  {(isOoo || form.description.trim()) && (
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
                        maxLength={isOoo ? 500 : 2000}
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
                      htmlFor={`${id}-reviewPurpose${isOoo ? '-input' : ''}`}
                      text="Цель финансирования"
                      hint="Бизнес-задача, для которой требуется кредит"
                    />
                    {isOoo ? (
                      <Select
                        id={`${id}-reviewPurpose`}
                        name="reviewPurpose"
                        block
                        fieldProps={{
                          'aria-required': true,
                          'aria-label': 'Цель финансирования',
                        }}
                        options={purposeOptions}
                        selected={form.purpose || null}
                        placeholder="Выберите цель"
                        onChange={({ selected }) =>
                          setForm({ ...form, purpose: selected?.key ?? '' })
                        }
                      />
                    ) : (
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
                    )}
                  </div>
                </div>
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
                {isOoo && (
                  <>
                    <h3 className={styles.reviewTitle}>ООО и финансы</h3>
                    <OooApplicationFields section="business" {...oooFieldProps} />
                    <h3 className={styles.reviewTitle}>Проверка организации</h3>
                    <OooApplicationFields
                      section="registration"
                      {...oooFieldProps}
                    />
                    <h3 className={styles.reviewTitle}>Документы и согласия</h3>
                    <OooApplicationFields section="consents" {...oooFieldProps} />
                    {!oooReadyToSubmit && (
                      <p role="status">
                        Для отправки заполните обязательные поля, подтвердите
                        сведения об организации и все согласия.
                      </p>
                    )}
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
                !company ||
                (step === steps.length - 1 && !oooReadyToSubmit)
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
