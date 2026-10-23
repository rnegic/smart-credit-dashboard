const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { QueryClient, QueryObserver, MutationObserver } = require('@tanstack/react-query')

const root = path.resolve(__dirname, '../..')
const compiled = new Map()
const plain = (value) => JSON.parse(JSON.stringify(value))
const settle = () => new Promise(setImmediate)
const session = {
  userId: 1, fullName: 'Тестовый Предприниматель', role: 'CLIENT', companyId: 1, legalForm: 'IP',
  phone: '+7 (999) 111-00-01', email: 'owner@example.com',
}
const profile = { userId: session.userId, fullName: session.fullName, phone: session.phone, email: session.email }

function load(relative, dependencies) {
  const file = path.join(root, relative)
  if (!compiled.has(file)) compiled.set(file, ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX },
  }).outputText)
  const module = { exports: {} }
  vm.runInNewContext(`(function(require, module, exports) { ${compiled.get(file)}\n})`, { Error }, { filename: file })((id) => {
    if (id === 'react/jsx-runtime') return require(id)
    assert.ok(Object.hasOwn(dependencies, id), `Unexpected dependency: ${id}`)
    return dependencies[id]
  }, module, module.exports)
  return module.exports
}

const contracts = load('entities/profile/index.ts', { zod: require('zod'), '@tanstack/react-query': {}, '@/shared/api': {} })
const auth = load('entities/session/index.ts', { zod: require('zod'), react: {}, '@tanstack/react-query': {}, '@/shared/api': {} })

class ApiError extends Error {
  constructor(status, code, message = code) {
    super(message)
    this.status = status
    this.code = code
  }
}

const Input = ({ name, label, value, error, disabled }) => React.createElement('label', null, label,
  React.createElement('input', { name, value, disabled, readOnly: true }), error)
const Button = ({ children, disabled }) => React.createElement('button', { disabled }, children)
const Typography = { TitleResponsive: ({ tag, id, children }) => React.createElement(tag, { id }, children) }
const RequestState = ({ error, children, retry }) => React.createElement('div', { role: error ? 'alert' : 'status' },
  error ? error.message : children, error && retry ? React.createElement('button', null, 'Повторить') : null)

function elements(element) {
  return React.isValidElement(element) ? [element, ...React.Children.toArray(element.props.children).flatMap(elements)] : []
}

function hookRuntime() {
  const slots = []
  let cursor = 0
  let effects = []
  let mounted = true
  let staleWrites = 0
  return {
    begin() { cursor = 0 },
    flush() { const pending = effects; effects = []; pending.forEach((effect) => effect()) },
    useState(initial) {
      const index = cursor++
      if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial }
      return [slots[index].value, (next) => {
        if (!mounted) { staleWrites++; return }
        slots[index].value = typeof next === 'function' ? next(slots[index].value) : next
      }]
    },
    useRef(initial) { return this.useState(() => ({ current: initial }))[0] },
    useId() { return this.useState(() => `profile-${cursor}`)[0] },
    useEffect(effect, dependencies) {
      const index = cursor++
      const previous = slots[index]
      if (previous && dependencies?.every((value, i) => Object.is(value, previous.dependencies[i]))) return
      const slot = { dependencies }
      slots[index] = slot
      effects.push(() => { previous?.cleanup?.(); slot.cleanup = effect() })
    },
    unmount() { mounted = false; slots.forEach((slot) => slot.cleanup?.()) },
    get staleWrites() { return staleWrites },
  }
}

function editor(t, { scope = 1, initialSession = session } = {}) {
  const cache = new QueryClient({ defaultOptions: {
    queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity },
  } })
  cache.setQueryData(['session'], initialSession)
  const requests = []
  const invalidations = []
  const runtimes = []
  const state = { scope, generation: 0, switching: false }
  let runtime
  let key
  let element
  const hooks = Object.fromEntries(['useId', 'useRef', 'useState', 'useEffect'].map((name) => [name, (...args) => runtime[name](...args)]))
  const invalidate = cache.invalidateQueries.bind(cache)
  cache.invalidateQueries = (filters) => { invalidations.push(filters); return invalidate(filters) }
  const api = {
    ApiError, useApiScope: () => state.scope, useSessionTransition: () => state,
    getSessionGeneration: () => state.generation, isSessionSwitching: () => state.switching, syncSessionChanges() {},
    apiRequest: (url, schema, options = {}) => {
      let resolve
      let reject
      const pending = new Promise((done, fail) => { resolve = done; reject = fail })
      requests.push({ url, options, resolve, reject })
      return pending.then((value) => {
        const parsed = schema.safeParse(value)
        if (!parsed.success) throw new ApiError(200, 'INVALID_RESPONSE')
        return parsed.data
      })
    },
  }
  const query = {
    useQueryClient: () => cache,
    useQuery: (options) => {
      const [observer] = hooks.useState(() => new QueryObserver(cache, options))
      hooks.useEffect(() => observer.setOptions(options), [observer, options])
      hooks.useEffect(() => observer.subscribe(() => {}), [observer])
      return observer.getCurrentResult()
    },
    useMutation: (options) => {
      const [observer] = hooks.useState(() => new MutationObserver(cache, options))
      hooks.useEffect(() => observer.setOptions(options), [observer, options])
      hooks.useEffect(() => observer.subscribe(() => {}), [observer])
      return {
        ...observer.getCurrentResult(),
        mutate: (variables, callbacks) => { void observer.mutate(variables, callbacks).catch(() => {}) },
      }
    },
  }
  const sessionEntity = load('entities/session/index.ts', { react: hooks, zod: require('zod'), '@tanstack/react-query': query, '@/shared/api': api })
  const profileEntity = load('entities/profile/index.ts', { zod: require('zod'), '@tanstack/react-query': query, '@/shared/api': api })
  const { ProfileContacts } = load('features/edit-profile/ui/ProfileContacts/ProfileContacts.tsx', {
    react: hooks, '@tanstack/react-query': query, '@/shared/api': api, '@/entities/profile': profileEntity,
    '@/entities/session': { ...sessionEntity, useSession: () => ({ data: cache.getQueryData(['session']) }) },
    '@alfalab/core-components/input': { Input }, '@alfalab/core-components/button': { Button },
    '@alfalab/core-components/typography': { Typography }, '@/shared/ui': { RequestState },
    './ProfileContacts.module.scss': { __esModule: true, default: new Proxy({}, { get: (_, name) => String(name) }) },
  })
  const h = {
    cache, state, requests, invalidations, runtimes,
    render() {
      const outer = ProfileContacts()
      if (!outer) { runtime?.unmount(); runtime = null; element = null; return null }
      if (!runtime || key !== outer.key) {
        runtime?.unmount()
        runtime = hookRuntime()
        runtimes.push(runtime)
        key = outer.key
      }
      runtime.begin()
      element = outer.type(outer.props)
      runtime.flush()
      return element
    },
    find(predicate) { return elements(element).find(predicate) },
    field(name) { return this.find((item) => item.type === Input && item.props.name === name) },
    get form() { return this.find((item) => item.type === 'form') },
    get button() { return this.find((item) => item.type === Button) },
    get requestState() { return this.find((item) => item.type === RequestState) },
    html() { return renderToStaticMarkup(element) },
    edit(name, value) { this.field(name).props.onChange(null, { value }); this.render() },
    submit() { this.form.props.onSubmit({ preventDefault() {} }); this.render() },
    latest(url = '/api/profile', method) { return requests.findLast((item) => item.url === url && item.options.method === method) },
    async resolveProfile(value = profile) {
      await settle()
      this.latest().resolve(value)
      await settle()
      this.render()
    },
    observeSession() {
      const observer = new QueryObserver(cache, {
        queryKey: ['session'], staleTime: Infinity,
        queryFn: ({ signal }) => api.apiRequest('/api/auth/me', auth.sessionSchema, { signal }),
      })
      t.after(observer.subscribe(() => {}))
    },
    unmount() { runtime?.unmount(); runtime = null },
  }
  h.render()
  t.after(() => { h.unmount(); cache.clear() })
  return h
}

test('profile and login/me contracts require present nullable contacts and positive user IDs', () => {
  for (const [schema, data] of [[contracts.profileSchema, profile], [auth.sessionSchema, session]]) {
    assert.deepEqual(plain(schema.parse({ ...data, phone: null, email: null })), { ...data, phone: null, email: null })
    for (const field of ['phone', 'email']) {
      const incomplete = { ...data }
      delete incomplete[field]
      assert.equal(schema.safeParse(incomplete).success, false)
    }
    for (const userId of [0, -1, 1.5]) assert.equal(schema.safeParse({ ...data, userId }).success, false)
  }
})

test('optional PUT validation matches the backend phone expression without trimming or a digit-count rule', () => {
  for (const [phone, valid] of [
    [null, true], ['', true], ['1234567890', true], ['+7 (999) 111-00-01', true],
    ['1'.repeat(19), true], [`+${'1'.repeat(19)}`, true], ['7         ', true], ['1234567890 ', true],
    ['123456789', false], ['1'.repeat(20), false], ['+1'.repeat(10), false], [' 1234567890', false],
    ['(999)1110001', false], ['          ', false], ['+7999abc0000', false],
  ]) assert.equal(contracts.profileContactsSchema.safeParse({ phone, email: null }).success, valid, String(phone))
  const raw = { phone: '1234567890 ', email: 'Owner+bank@Example.com' }
  assert.deepEqual(plain(contracts.profileContactsSchema.parse(raw)), raw)
  const email255 = `a@${['b'.repeat(63), 'c'.repeat(63), 'd'.repeat(63), 'e'.repeat(58), 'ru'].join('.')}`
  assert.equal(email255.length, 255)
  for (const email of ['', null, 'owner@example.com', email255]) {
    assert.equal(contracts.profileContactsSchema.safeParse({ phone: null, email }).success, true)
  }
  for (const email of ['invalid', ' owner@example.com', 'owner@example.com ', ' ', `a${email255}`]) {
    assert.equal(contracts.profileContactsSchema.safeParse({ phone: null, email }).success, false)
  }
  assert.equal(contracts.profileContactsSchema.safeParse({ phone: null }).success, false)
  assert.equal(contracts.profileContactsSchema.safeParse({ email: null }).success, false)
})

test('mount loads the scoped profile with loading, backend errors, retry and optional Alfa inputs', async (t) => {
  const h = editor(t)
  assert.ok(h.html().includes('Загружаем профиль'))
  await settle()
  assert.equal(h.requests.length, 1)
  assert.equal(h.requests[0].url, '/api/profile')
  assert.ok(h.requests[0].options.signal instanceof AbortSignal)
  assert.ok(h.cache.getQueryState(['client', 1, 'profile']))
  h.requests[0].reject(new ApiError(503, 'PROFILE_UNAVAILABLE', 'Профиль временно недоступен'))
  await settle()
  h.render()
  assert.ok(h.html().includes('Профиль временно недоступен'))
  assert.ok(h.html().includes('Повторить'))
  h.requestState.props.retry()
  await h.resolveProfile()
  assert.ok(h.html().includes(profile.fullName))
  assert.equal(h.field('phone').props.type, 'tel')
  assert.equal(h.field('email').props.type, 'email')
  for (const field of ['phone', 'email']) {
    assert.equal(h.field(field).props.labelView, 'outer')
    assert.equal(h.field(field).props.block, true)
    assert.equal(h.field(field).props.required, undefined)
    assert.equal(h.field(field).props.value, profile[field])
  }
  assert.equal(h.button.props.disabled, true)
})

test('the embeddable UI does not request a profile for a missing scope, another user or an officer', async (t) => {
  for (const options of [
    { scope: null }, { initialSession: null }, { scope: 2 },
    { initialSession: { ...session, role: 'BANK_OFFICER', companyId: null, legalForm: null } },
  ]) {
    const h = editor(t, options)
    await settle()
    assert.equal(h.render(), null)
    assert.equal(h.requests.length, 0)
  }
})

test('refetches, including a clear or a failure, never wipe dirty contact inputs', async (t) => {
  const h = editor(t)
  await h.resolveProfile()
  h.edit('phone', '')
  void h.cache.refetchQueries({ queryKey: ['client', 1, 'profile'] })
  await h.resolveProfile({ ...profile, phone: '+79991110002', email: 'refetched@example.com' })
  assert.equal(h.field('phone').props.value, '')
  assert.equal(h.field('email').props.value, 'refetched@example.com')
  h.edit('email', 'typed@example.com')
  void h.cache.refetchQueries({ queryKey: ['client', 1, 'profile'] })
  await settle()
  h.latest().reject(new ApiError(500, 'PROFILE_ERROR', 'Не удалось обновить профиль'))
  await settle()
  h.render()
  assert.ok(h.form)
  assert.ok(h.html().includes('Не удалось обновить профиль'))
  h.requestState.props.retry()
  await h.resolveProfile({ ...profile, phone: null, email: null })
  assert.equal(h.field('phone').props.value, '')
  assert.equal(h.field('email').props.value, 'typed@example.com')
})

test('PUT always sends both contacts, prevents duplicate saves and reconciles normalized contacts with me', async (t) => {
  for (const field of ['phone', 'email']) {
    const h = editor(t)
    await h.resolveProfile()
    h.observeSession()
    const value = field === 'phone' ? '1234567890 ' : 'new@example.com'
    h.edit(field, value)
    const submit = h.form.props.onSubmit
    submit({ preventDefault() {} })
    submit({ preventDefault() {} })
    await settle()
    h.render()
    assert.equal(h.requests.filter((request) => request.options.method === 'PUT').length, 1)
    const request = h.latest('/api/profile', 'PUT')
    assert.deepEqual(JSON.parse(request.options.body), { phone: profile.phone, email: profile.email, [field]: value })
    assert.equal(h.form.props['aria-busy'], true)
    assert.equal(h.button.props.loading, true)
    assert.ok(h.html().includes('Сохраняем контакты'))
    assert.equal(h.field('phone').props.disabled, true)
    assert.equal(h.field('email').props.disabled, true)
    const saved = { ...profile, [field]: value.trim() }
    request.resolve(saved)
    await settle()
    h.render()
    assert.deepEqual(plain(h.cache.getQueryData(['client', 1, 'profile'])), saved)
    assert.equal(h.cache.getQueryData(['session'])[field], saved[field])
    assert.ok(h.latest('/api/auth/me'))
    assert.equal(h.button.props.loading, true)
    assert.ok(!h.html().includes('Контакты сохранены.'))
    h.latest('/api/auth/me').resolve({ ...session, phone: saved.phone, email: saved.email })
    await settle()
    h.render()
    assert.equal(h.field(field).props.value, saved[field])
    assert.equal(h.field(field).props.disabled, false)
    assert.equal(h.button.props.disabled, true)
    assert.ok(h.html().includes('Контакты сохранены.'))
    assert.deepEqual(plain(h.invalidations), [{ queryKey: ['session'], exact: true }])
    h.edit(field, '')
    assert.ok(!h.html().includes('Контакты сохранены.'))
  }
})

test('empty input clears a contact and preserves the other nullable field in the PUT body', async (t) => {
  const h = editor(t)
  await h.resolveProfile({ ...profile, email: null })
  h.edit('phone', '')
  h.submit()
  await settle()
  assert.deepEqual(JSON.parse(h.latest('/api/profile', 'PUT').options.body), { phone: '', email: null })
  h.latest('/api/profile', 'PUT').resolve({ ...profile, phone: null, email: null })
  await settle()
  h.render()
  assert.equal(h.field('phone').props.value, '')
  assert.equal(h.field('email').props.value, '')
  assert.equal(h.cache.getQueryData(['session']).phone, null)
  assert.equal(h.cache.getQueryData(['session']).email, null)
  assert.ok(h.html().includes('Контакты сохранены.'))
})

test('invalid input is blocked locally; server validation errors remain visible and retry preserves edits', async (t) => {
  const h = editor(t)
  await h.resolveProfile()
  h.edit('email', 'invalid')
  h.submit()
  assert.ok(h.field('email').props.error)
  assert.equal(h.requests.length, 1)
  h.edit('email', 'valid@example.com')
  h.submit()
  await settle()
  h.latest('/api/profile', 'PUT').reject(new ApiError(400, 'VALIDATION_ERROR', 'email: rejected by server'))
  await settle()
  h.render()
  assert.ok(h.html().includes('email: rejected by server'))
  assert.equal(h.field('email').props.value, 'valid@example.com')
  assert.equal(h.button.props.disabled, false)
  assert.ok(!h.html().includes('Контакты сохранены.'))
  assert.equal(h.invalidations.length, 0)
  h.submit()
  await settle()
  assert.deepEqual(JSON.parse(h.latest('/api/profile', 'PUT').options.body), { phone: profile.phone, email: 'valid@example.com' })
})

test('GET and PUT responses for another user are rejected without updating private caches', async (t) => {
  const h = editor(t)
  await h.resolveProfile({ ...profile, userId: 2 })
  assert.equal(h.form, undefined)
  assert.ok(h.html().includes('Не удалось проверить владельца профиля'))
  h.requestState.props.retry()
  await h.resolveProfile()
  h.edit('email', 'new@example.com')
  h.submit()
  await settle()
  h.latest('/api/profile', 'PUT').resolve({ ...profile, userId: 2, email: 'other@example.com' })
  await settle()
  h.render()
  assert.ok(h.html().includes('Не удалось проверить владельца профиля'))
  assert.deepEqual(plain(h.cache.getQueryData(['session'])), session)
  assert.deepEqual(plain(h.cache.getQueryData(['client', 1, 'profile'])), profile)
  assert.equal(h.invalidations.length, 0)
})

test('older in-flight profile and me responses cannot overwrite a successful PUT', async (t) => {
  const h = editor(t)
  await h.resolveProfile()
  h.observeSession()
  void h.cache.refetchQueries()
  await settle()
  const oldReads = h.requests.slice(1)
  assert.equal(oldReads.length, 2)
  h.edit('email', 'saved@example.com')
  h.submit()
  await settle()
  const saved = { ...profile, email: 'saved@example.com' }
  h.latest('/api/profile', 'PUT').resolve(saved)
  await settle()
  assert.ok(oldReads.every((request) => request.options.signal.aborted))
  for (const request of oldReads) request.resolve(request.url === '/api/auth/me' ? session : profile)
  await settle()
  assert.equal(h.cache.getQueryData(['session']).email, saved.email)
  assert.equal(h.cache.getQueryData(['client', 1, 'profile']).email, saved.email)
  h.latest('/api/auth/me').resolve({ ...session, email: saved.email })
  await settle()
  h.render()
  assert.equal(h.field('email').props.value, saved.email)
})

test('scope and generation fences apply before PUT, after its response and after query cancellation', async (t) => {
  for (const moment of ['before-request', 'response', 'after-cancel', 'same-user-generation', 'different-scope']) {
    const h = editor(t)
    await h.resolveProfile()
    h.edit('email', 'stale@example.com')
    const nextSession = { ...session, userId: moment === 'same-user-generation' ? 1 : 2, email: 'current@example.com' }
    const change = () => {
      if (moment !== 'different-scope') h.state.generation++
      h.cache.setQueryData(['session'], nextSession)
    }
    if (moment === 'after-cancel') {
      const cancel = h.cache.cancelQueries.bind(h.cache)
      h.cache.cancelQueries = async (...args) => { await cancel(...args); change() }
    }
    h.submit()
    if (moment === 'before-request') change()
    await settle()
    if (moment === 'before-request') assert.equal(h.latest('/api/profile', 'PUT'), undefined)
    else {
      if (moment !== 'after-cancel') change()
      h.latest('/api/profile', 'PUT').resolve({ ...profile, email: 'stale@example.com' })
      await settle()
    }
    assert.deepEqual(plain(h.cache.getQueryData(['session'])), nextSession, moment)
    assert.deepEqual(plain(h.cache.getQueryData(['client', 1, 'profile'])), profile, moment)
    assert.equal(h.invalidations.length, 0, moment)
  }
})

test('closing the panel still reconciles a valid save without writing to the unmounted form', async (t) => {
  const h = editor(t)
  await h.resolveProfile()
  h.edit('email', 'saved@example.com')
  h.submit()
  await settle()
  h.unmount()
  h.latest('/api/profile', 'PUT').resolve({ ...profile, email: 'saved@example.com' })
  await settle()
  assert.equal(h.cache.getQueryData(['session']).email, 'saved@example.com')
  assert.equal(h.runtimes[0].staleWrites, 0)
})
