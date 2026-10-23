import { useId, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@alfalab/core-components/button'
import { Input } from '@alfalab/core-components/input'
import { Typography } from '@alfalab/core-components/typography'
import {
  profileContactsSchema,
  profileKey,
  profileSchema,
  useProfile,
  type ProfileContactsInput,
} from '@/entities/profile'
import {
  isCurrentSession,
  sessionKey,
  useSession,
  type Session,
} from '@/entities/session'
import {
  apiRequest,
  ApiError,
  useApiScope,
  useSessionTransition,
} from '@/shared/api'
import { RequestState } from '@/shared/ui'
import styles from './ProfileContacts.module.scss'

/** Optional client contacts for embedding in the existing company profile panel. */
export function ProfileContacts() {
  const scope = useApiScope()
  const session = useSession()
  const transition = useSessionTransition()
  if (
    scope === null ||
    transition.switching ||
    session.data?.userId !== scope ||
    session.data.role !== 'CLIENT'
  )
    return null
  return (
    <ProfileContactsEditor
      key={`${scope}:${transition.generation}`}
      scope={scope}
      generation={transition.generation}
    />
  )
}

function ProfileContactsEditor({
  scope,
  generation,
}: {
  scope: number
  generation: number
}) {
  const id = useId()
  const cache = useQueryClient()
  const profile = useProfile()
  const [edits, setEdits] = useState<Partial<Record<'phone' | 'email', string>>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const formRef = useRef<HTMLFormElement>(null)
  const saving = useRef(false)
  const contacts = {
    phone: edits.phone ?? profile.data?.phone ?? null,
    email: edits.email ?? profile.data?.email ?? null,
  }
  const save = useMutation({
    mutationFn: async (body: ProfileContactsInput) => {
      if (!isCurrentSession(cache, scope, generation))
        throw new ApiError(
          409,
          'SESSION_CHANGED',
          'Профиль изменился. Повторите действие.',
        )
      const saved = await apiRequest('/api/profile', profileSchema, {
        method: 'PUT',
        body: JSON.stringify(body),
      })
      if (saved.userId !== scope)
        throw new ApiError(
          200,
          'INVALID_RESPONSE',
          'Не удалось проверить владельца профиля.',
        )
      return saved
    },
    onSuccess: async (saved) => {
      if (!isCurrentSession(cache, scope, generation)) return
      await Promise.all([
        cache.cancelQueries({ queryKey: profileKey(scope), exact: true }),
        cache.cancelQueries({ queryKey: sessionKey, exact: true }),
      ])
      if (!isCurrentSession(cache, scope, generation)) return
      cache.setQueryData(profileKey(scope), saved)
      cache.setQueryData<Session | null>(sessionKey, (current) =>
        current?.userId === scope
          ? { ...current, phone: saved.phone, email: saved.email }
          : current,
      )
      await cache.invalidateQueries({ queryKey: sessionKey, exact: true })
    },
    onSettled: () => {
      saving.current = false
    },
    retry: false,
  })

  function edit(field: 'phone' | 'email', value: string) {
    if (saving.current) return
    setEdits((previous) => ({ ...previous, [field]: value }))
    setErrors({})
    save.reset()
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (
      saving.current ||
      !profile.data ||
      !isCurrentSession(cache, scope, generation)
    )
      return
    const result = profileContactsSchema.safeParse(contacts)
    if (!result.success) {
      setErrors(
        Object.fromEntries(
          result.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
        ),
      )
      const field = String(result.error.issues[0]?.path[0])
      formRef.current?.querySelector<HTMLInputElement>(`[name="${field}"]`)?.focus()
      return
    }
    setErrors({})
    saving.current = true
    save.mutate(result.data, {
      onSuccess: () => {
        if (isCurrentSession(cache, scope, generation)) setEdits({})
      },
    })
  }

  if (!profile.data)
    return (
      <RequestState
        error={profile.error}
        retry={() => {
          void profile.refetch()
        }}
      >
        Загружаем профиль...
      </RequestState>
    )

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
        Контактные данные
      </Typography.TitleResponsive>
      <dl className={styles.identity}>
        <dt>ФИО</dt>
        <dd>{profile.data.fullName}</dd>
      </dl>
      <p className={styles.hint} id={`${id}-hint`}>
        Контакты подставляются в новые заявки. Поля необязательны: оставьте поле
        пустым, чтобы удалить контакт.
      </p>
      <Input
        id={`${id}-phone`}
        name="phone"
        type="tel"
        autoComplete="tel"
        block
        label="Телефон"
        labelView="outer"
        aria-describedby={`${id}-hint`}
        value={contacts.phone ?? ''}
        error={errors.phone}
        disabled={save.isPending}
        onChange={(_, { value }) => edit('phone', value)}
      />
      <Input
        id={`${id}-email`}
        name="email"
        type="email"
        autoComplete="email"
        block
        label="Email"
        labelView="outer"
        maxLength={255}
        aria-describedby={`${id}-hint`}
        value={contacts.email ?? ''}
        error={errors.email}
        disabled={save.isPending}
        onChange={(_, { value }) => edit('email', value)}
      />
      {profile.error && (
        <RequestState
          error={profile.error}
          retry={() => {
            void profile.refetch()
          }}
        />
      )}
      {save.error && <RequestState error={save.error} />}
      <Button
        type="submit"
        view="primary"
        size={48}
        block
        loading={save.isPending}
        disabled={save.isPending || Object.keys(edits).length === 0}
      >
        Сохранить контакты
      </Button>
      <p
        className={styles.status}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {save.isPending
          ? 'Сохраняем контакты...'
          : save.isSuccess
            ? 'Контакты сохранены.'
            : ''}
      </p>
    </form>
  )
}
