import { useId, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@alfalab/core-components/button'
import { Input } from '@alfalab/core-components/input'
import { Typography } from '@alfalab/core-components/typography'
import {
  companySchema,
  companyUpdateSchema,
  type CompanyUpdate,
} from '@/entities/company'
import { useDashboard, type Dashboard } from '@/entities/dashboard'
import { isCurrentSession, useSession } from '@/entities/session'
import {
  apiRequest,
  ApiError,
  useApiScope,
  useSessionTransition,
} from '@/shared/api'
import { RequestState } from '@/shared/ui'
import styles from './ProfileCompany.module.scss'

/** Editable company details, embedded in the company profile side panel. */
export function ProfileCompany({ onSaved }: { onSaved?: () => void }) {
  const scope = useApiScope()
  const session = useSession()
  const transition = useSessionTransition()
  if (
    scope === null ||
    transition.switching ||
    session.data?.userId !== scope ||
    session.data?.role !== 'CLIENT'
  )
    return null
  return (
    <ProfileCompanyEditor
      key={`${scope}:${transition.generation}`}
      scope={scope}
      generation={transition.generation}
      onSaved={onSaved}
    />
  )
}

function ProfileCompanyEditor({
  scope,
  generation,
  onSaved,
}: {
  scope: number
  generation: number
  onSaved?: () => void
}) {
  const id = useId()
  const cache = useQueryClient()
  const dashboard = useDashboard()
  const company = dashboard.data?.company
  const [edits, setEdits] = useState<Partial<CompanyUpdate>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const formRef = useRef<HTMLFormElement>(null)
  const saving = useRef(false)
  const values = {
    name: edits.name ?? company?.name ?? '',
    inn: edits.inn ?? company?.inn ?? '',
    okved: edits.okved ?? company?.okved ?? '',
  }
  const save = useMutation({
    mutationFn: async (body: CompanyUpdate) => {
      if (!isCurrentSession(cache, scope, generation))
        throw new ApiError(
          409,
          'SESSION_CHANGED',
          'Профиль изменился. Повторите действие.',
        )
      const saved = await apiRequest('/api/company', companySchema, {
        method: 'PUT',
        body: JSON.stringify(body),
      })
      if (saved.id !== company?.id)
        throw new ApiError(
          200,
          'INVALID_RESPONSE',
          'Не удалось проверить компанию.',
        )
      return saved
    },
    onSuccess: async (saved) => {
      if (!isCurrentSession(cache, scope, generation)) return
      await cache.cancelQueries({
        queryKey: ['client', scope, 'dashboard'],
        exact: true,
      })
      if (!isCurrentSession(cache, scope, generation)) return
      cache.setQueryData<Dashboard>(
        ['client', scope, 'dashboard'],
        (current) => (current ? { ...current, company: saved } : current),
      )
      setEdits({})
      onSaved?.()
    },
    onSettled: () => {
      saving.current = false
    },
    retry: false,
  })

  function edit(field: keyof CompanyUpdate, value: string) {
    if (saving.current) return
    setEdits((previous) => ({ ...previous, [field]: value }))
    setErrors({})
    save.reset()
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (
      saving.current ||
      !company ||
      !isCurrentSession(cache, scope, generation)
    )
      return
    const result = companyUpdateSchema.safeParse(values)
    if (!result.success) {
      setErrors(
        Object.fromEntries(
          result.error.issues.map((issue) => [
            String(issue.path[0]),
            issue.message,
          ]),
        ),
      )
      const field = String(result.error.issues[0]?.path[0])
      formRef.current
        ?.querySelector<HTMLInputElement>(`[name="${field}"]`)
        ?.focus()
      return
    }
    setErrors({})
    saving.current = true
    save.mutate(result.data)
  }

  if (!company)
    return (
      <RequestState
        error={dashboard.error}
        retry={() => {
          void dashboard.refetch()
        }}
      >
        Загружаем данные компании...
      </RequestState>
    )

  const ip = company.legalForm === 'IP'
  return (
    <form
      ref={formRef}
      className={styles.form}
      onSubmit={submit}
      noValidate
      aria-labelledby={`${id}-title`}
      aria-busy={save.isPending}
    >
      <Typography.TitleResponsive
        id={`${id}-title`}
        tag="h3"
        view="xsmall"
        font="system"
        className={styles.title}
      >
        Данные компании
      </Typography.TitleResponsive>
      <p className={styles.hint}>
        Эти сведения подставляются в заявку. После сохранения они обновятся в
        профиле.
      </p>
      <Input
        id={`${id}-name`}
        name="name"
        block
        label={ip ? 'Название ИП' : 'Название организации'}
        labelView="outer"
        autoComplete="organization"
        maxLength={255}
        value={values.name}
        error={errors.name}
        disabled={save.isPending}
        onChange={(_, { value }) => edit('name', value)}
      />
      <Input
        id={`${id}-inn`}
        name="inn"
        block
        label="ИНН"
        labelView="outer"
        inputMode="numeric"
        maxLength={12}
        value={values.inn}
        error={errors.inn}
        disabled={save.isPending}
        onChange={(_, { value }) => edit('inn', value)}
      />
      <Input
        id={`${id}-okved`}
        name="okved"
        block
        label="Основной ОКВЭД"
        labelView="outer"
        inputMode="numeric"
        maxLength={12}
        value={values.okved}
        error={errors.okved}
        disabled={save.isPending}
        onChange={(_, { value }) => edit('okved', value)}
      />
      {save.error && <RequestState error={save.error} />}
      <Button
        type="submit"
        view="primary"
        size={48}
        block
        loading={save.isPending}
        disabled={save.isPending || Object.keys(edits).length === 0}
      >
        Сохранить данные
      </Button>
      <p
        className={styles.status}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {save.isPending
          ? 'Сохраняем данные...'
          : save.isSuccess
            ? 'Данные компании сохранены.'
            : ''}
      </p>
    </form>
  )
}
