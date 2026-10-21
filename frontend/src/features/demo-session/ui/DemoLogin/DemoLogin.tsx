import { useId, useRef, useState, type FormEvent } from 'react'
import {
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { Button } from '@alfalab/core-components/button'
import { Input } from '@alfalab/core-components/input'
import { Modal } from '@alfalab/core-components/modal'
import { Typography } from '@alfalab/core-components/typography'
import {
  changeSession,
  demoProfilesSchema,
  sessionSchema,
} from '@/entities/session'
import { ApiError, apiRequest, useSessionTransition } from '@/shared/api'
import { AlfaMark, RequestState } from '@/shared/ui'
import styles from './DemoLogin.module.scss'

interface LoginCredentials {
  login: string
  password: string
  quick?: boolean
}

/** Signs in with credentials or a profile returned by the quick-entry service. */
export function DemoLogin() {
  const cache = useQueryClient()
  const transition = useSessionTransition()
  const mutations = useIsMutating()
  const id = useId()
  const loginRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [missing, setMissing] = useState({ login: false, password: false })
  const [clientPickerOpen, setClientPickerOpen] = useState(false)
  const clientButtonRef = useRef<HTMLButtonElement>(null)
  const profiles = useQuery({
    queryKey: ['demo-profiles'],
    queryFn: ({ signal }) =>
      apiRequest('/api/demo/profiles', demoProfilesSchema, { signal }),
    enabled: !transition.switching,
  })
  const login = useMutation({
    networkMode: 'always',
    mutationFn: (credentials: LoginCredentials) =>
      changeSession(cache, () =>
        apiRequest('/api/auth/login', sessionSchema, {
          method: 'POST',
          body: JSON.stringify({
            login: credentials.login,
            password: credentials.password,
          }),
        }),
      ),
  })
  const busy = transition.switching || mutations > 0
  const error = login.error ?? transition.error
  const badCredentials =
    error instanceof ApiError && error.code === 'BAD_CREDENTIALS'
  const newIp = profiles.data?.find((profile) => profile.login === 'client_ip')
  const newOoo = profiles.data?.find(
    (profile) => profile.login === 'client_ooo',
  )
  const officer = profiles.data?.find(
    (profile) => profile.role === 'BANK_OFFICER',
  )
  const otherProfiles =
    profiles.data?.filter(
      (profile) =>
        profile.role === 'CLIENT' &&
        profile.login !== 'client_ip' &&
        profile.login !== 'client_ooo',
    ) ?? []

  function quickLogin(profile: NonNullable<typeof officer>) {
    if (busy) return
    setClientPickerOpen(false)
    setMissing({ login: false, password: false })
    login.mutate({
      login: profile.login,
      password: profile.password,
      quick: true,
    })
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const required = { login: !username.trim(), password: !password }
    setMissing(required)
    if (required.login || required.password) {
      const firstMissing = required.login ? loginRef : passwordRef
      firstMissing.current?.focus()
      return
    }
    login.mutate({ login: username.trim(), password })
  }
  return (
    <main className={styles.page}>
      <AlfaMark />
      <Typography.TitleResponsive
        tag="h1"
        view="large"
        font="system"
        weight="bold"
      >
        Вход в кредитный кабинет предпринимателя
      </Typography.TitleResponsive>
      <Typography.Text tag="p" color="secondary">
        Войдите в кредитный кабинет, чтобы работать с заявками и данными
        компании.
      </Typography.Text>
      <form
        className={`${styles.card} ${styles.form}`}
        onSubmit={handleSubmit}
        noValidate
        aria-labelledby={`${id}-login-title`}
        aria-busy={busy}
      >
        <Typography.TitleResponsive
          id={`${id}-login-title`}
          tag="h2"
          view="small"
          font="system"
        >
          Вход в аккаунт
        </Typography.TitleResponsive>
        <Input
          ref={loginRef}
          id={`${id}-login`}
          name="login"
          type="text"
          label="Логин"
          labelView="outer"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          block
          required
          disabled={busy}
          value={username}
          error={
            missing.login && <span id={`${id}-login-error`}>Введите логин</span>
          }
          aria-invalid={missing.login || badCredentials}
          aria-describedby={
            missing.login
              ? `${id}-login-error`
              : error
                ? `${id}-auth-error`
                : undefined
          }
          onChange={(_, { value }) => {
            setUsername(value)
            setMissing((previous) => ({ ...previous, login: false }))
          }}
        />
        <Input
          ref={passwordRef}
          id={`${id}-password`}
          name="password"
          type="password"
          label="Пароль"
          labelView="outer"
          autoComplete="current-password"
          block
          required
          disabled={busy}
          value={password}
          error={
            missing.password && (
              <span id={`${id}-password-error`}>Введите пароль</span>
            )
          }
          aria-invalid={missing.password || badCredentials}
          aria-describedby={
            missing.password
              ? `${id}-password-error`
              : error
                ? `${id}-auth-error`
                : undefined
          }
          onChange={(_, { value }) => {
            setPassword(value)
            setMissing((previous) => ({ ...previous, password: false }))
          }}
        />
        {error && (
          <p id={`${id}-auth-error`} role="alert">
            {badCredentials ? 'Неверный логин или пароль' : error.message}
          </p>
        )}
        <Button
          type="submit"
          view="primary"
          block
          disabled={busy}
          loading={login.isPending && !login.variables?.quick}
        >
          Войти
        </Button>
      </form>
      <section
        className={styles.quickEntry}
        aria-labelledby={`${id}-profiles-title`}
      >
        <Typography.TitleResponsive
          id={`${id}-profiles-title`}
          tag="h2"
          view="small"
          font="system"
        >
          Быстрый вход
        </Typography.TitleResponsive>
        {profiles.isPending ? (
          <RequestState />
        ) : profiles.error ? (
          <RequestState
            error={profiles.error}
            retry={() => {
              void profiles.refetch()
            }}
          />
        ) : profiles.data.length === 0 ? (
          <Typography.Text tag="p" color="secondary">
            Нет доступных профилей
          </Typography.Text>
        ) : (
          <>
            <div className={styles.cards}>
              <section className={styles.card}>
                <Typography.TitleResponsive tag="h3" view="small" font="system">
                  Новая бизнес-задача
                </Typography.TitleResponsive>
                <p>
                  Начните с нуля: выберите ИП или ООО, опишите, на что нужны
                  деньги, и оформите первую заявку.
                </p>
                <Button
                  ref={clientButtonRef}
                  view="primary"
                  block
                  disabled={busy || (!newIp && !newOoo)}
                  onClick={() => setClientPickerOpen(true)}
                >
                  Зайти под пользователем
                </Button>
              </section>
              <section className={styles.card}>
                <Typography.TitleResponsive tag="h3" view="small" font="system">
                  Работа с заявками
                </Typography.TitleResponsive>
                <p>
                  Рассмотрите заявки клиентов, изучите оценку риска и примите
                  решение о финансировании.
                </p>
                <Button
                  view="secondary"
                  block
                  disabled={busy || !officer}
                  onClick={() => {
                    if (officer) quickLogin(officer)
                  }}
                >
                  Зайти под сотрудником банка
                </Button>
              </section>
            </div>
            <Typography.TitleResponsive tag="h3" view="xsmall" font="system">
              Другие сценарии
            </Typography.TitleResponsive>
            <div className={styles.secondaryCards}>
              {otherProfiles.map((profile) => (
                <section
                  className={`${styles.card} ${styles.secondaryCard}`}
                  key={profile.login}
                >
                  <Typography.TitleResponsive
                    tag="h3"
                    view="xsmall"
                    font="system"
                  >
                    {profile.fullName}
                  </Typography.TitleResponsive>
                  <p>
                    {profile.login === 'ivanov'
                      ? 'Первый вход: выбор формы бизнеса и новая заявка.'
                      : profile.login === 'romashka'
                        ? 'Заявка на рассмотрении: статус и следующий шаг.'
                        : profile.login === 'petrova'
                          ? 'Результат рассмотрения: условия и подписание.'
                          : profile.login === 'vektor'
                            ? 'Действующий кредит: остаток долга и ближайший платеж.'
                            : (profile.description ??
                              'Кабинет компании и ее заявки.')}
                  </p>
                  <Button
                    type="button"
                    view="secondary"
                    block
                    aria-label={`Выбрать профиль: ${profile.fullName}`}
                    disabled={busy}
                    loading={
                      login.isPending &&
                      login.variables?.quick === true &&
                      login.variables?.login === profile.login
                    }
                    onClick={() => quickLogin(profile)}
                  >
                    Выбрать профиль
                  </Button>
                </section>
              ))}
            </div>
          </>
        )}
      </section>
      <Modal
        open={clientPickerOpen}
        size={600}
        fixedPosition
        scrollLock
        wrapperProps={{ 'aria-labelledby': `${id}-client-picker` }}
        onClose={() => setClientPickerOpen(false)}
        onUnmount={() =>
          requestAnimationFrame(() => {
            if (
              clientButtonRef.current?.isConnected &&
              !document.querySelector('[role="dialog"]')
            )
              clientButtonRef.current.focus()
          })
        }
      >
        <Modal.Header
          hasCloser
          title={<span id={`${id}-client-picker`}>Выберите форму бизнеса</span>}
          closerProps={{ 'aria-label': 'Закрыть выбор формы бизнеса' }}
        />
        <Modal.Content>
          <div className={styles.picker}>
            <p>
              Выберите аккаунт для первой заявки. Данные бизнеса уже заполнены.
            </p>
            <Button
              view="primary"
              block
              disabled={busy || !newIp}
              onClick={() => {
                if (newIp) quickLogin(newIp)
              }}
            >
              Зайти под ИП
            </Button>
            <Button
              view="secondary"
              block
              disabled={busy || !newOoo}
              onClick={() => {
                if (newOoo) quickLogin(newOoo)
              }}
            >
              Зайти под ООО
            </Button>
            {(!newIp || !newOoo) && (
              <p role="status">
                Не все стартовые профили доступны. Обновите список после запуска
                сервера.
              </p>
            )}
          </div>
        </Modal.Content>
      </Modal>
    </main>
  )
}
