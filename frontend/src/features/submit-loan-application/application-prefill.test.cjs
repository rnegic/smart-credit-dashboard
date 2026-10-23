const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { QueryClient, MutationObserver } = require('@tanstack/react-query')

const root = path.resolve(__dirname, '../..')
const feature = 'features/submit-loan-application'
const compiledFiles = new Map()
const styles = new Proxy({}, { get: (_, key) => String(key) })
const cssModule = { __esModule: true, default: styles }
const fallbackMessage = 'Не удалось заполнить поля автоматически. Продолжите в этой форме самостоятельно'
const partialMessage = 'Основные поля подготовлены. Проверьте их и дополните отмеченное'
const description = '  Нужны средства на закупку товара на 60 дней.  '

function load(relative, dependencies = {}, globals = {}) {
  const file = path.join(root, relative)
  if (!compiledFiles.has(file)) {
    compiledFiles.set(file, ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2023,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText)
  }
  const module = { exports: {} }
  vm.runInNewContext(`(function(require, module, exports) { ${compiledFiles.get(file)}\n})`, globals, { filename: file })((id) => {
    if (id === 'react/jsx-runtime') return require(id)
    assert.ok(Object.hasOwn(dependencies, id), `Unexpected dependency: ${id}`)
    return dependencies[id]
  }, module, module.exports)
  return module.exports
}

const formEntity = load('entities/application-form/index.ts', {
  zod: require('zod'), '@tanstack/react-query': {}, '@/shared/api': {},
})
const loanEntity = load('entities/loan-application/index.ts', {
  zod: require('zod'), '@tanstack/react-query': {}, '@/shared/api': {},
  './get-application-progress': load('entities/loan-application/get-application-progress.ts'),
})

const Text = ({ children, tag = 'span' }) => React.createElement(tag, null, children)
const Typography = { Text, TitleResponsive: Text }
const Button = ({ children, disabled, className }) => React.createElement('button', { disabled, className }, children)
const Input = ({ name, value, hint, error }) => React.createElement('label', null,
  React.createElement('input', { name, value, readOnly: true }), hint, error)
const Textarea = ({ name, value, error }) => React.createElement('label', null,
  React.createElement('textarea', { name, value, readOnly: true }), error)
const Select = ({ label, hint, error }) => React.createElement('div', null, label, hint, error)
const Modal = ({ open, children }) => open ? React.createElement('section', { role: 'dialog' }, children) : null
Modal.Header = ({ title }) => React.createElement('header', null, title)
Modal.Content = Modal.Footer = Text
const IpApplicationFields = () => null
const companyEntity = { getIndustryGroup: (code) => code?.startsWith('47') ? { key: 'trade' } : undefined }
const { ApplicationPreparation, ApplicationPreparationVisual } = load(`${feature}/ui/ApplicationPreparation/ApplicationPreparation.tsx`, {
  '@alfalab/core-components/typography': { Typography },
  './ApplicationPreparation.module.scss': cssModule,
})

class ApiError extends Error {
  constructor(status, code, message = code) {
    super(message)
    this.status = status
    this.code = code
  }
}

function response(financing = {}, missingFields = []) {
  return {
    form: {
      applicationId: null, createdAt: '2026-10-01T12:00:00Z', status: 'DRAFT',
      step1_financingParameters: {
        businessTask: 'Подготовленное описание', amount: 200000, termDays: 60,
        purpose: 'Закупка товара', ...financing,
      },
      step2_businessData: {
        applicant: {
          type: 'IP', companyName: 'ИП Тестовый Предприниматель', inn: '123456789012',
          taxSystem: 'USN', firstName: 'Предприниматель', lastName: 'Тестовый', middleName: null,
          ogrnip: '123456789012345', ogrn: null, registrationDate: '2020-01-01',
          mainOkved: '47.11', industry: 'trade', phone: '+79990000000',
          email: 'test@example.com', registrationAddress: 'Тестовый адрес',
        },
        financials: { monthlyRevenue: 500000, existingDebt: 0 },
      },
      prefilled: { source: 'PROFILE', fetchedAt: '2026-10-01T12:00:00Z', confirmedByUser: false },
      step3_verification: {
        consents: { personalData: false, bkiRequest: false, fnsRequest: false, acceptedAt: null },
      },
      meta: { formVersion: '1.3', events: ['form_started'] },
    },
    aiFilled: ['step1_financingParameters.amount', 'step1_financingParameters.termDays', 'step2_businessData.financials.monthlyRevenue'],
    missingFields,
  }
}

function clock() {
  let now = 0
  let id = 0
  const timers = new Map()
  return {
    setTimeout(callback, delay) {
      timers.set(++id, { callback, at: now + delay })
      return id
    },
    clearTimeout: (key) => timers.delete(key),
    get size() { return timers.size },
    advance(milliseconds) {
      const target = now + milliseconds
      for (;;) {
        const next = [...timers].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0]
        if (!next) break
        now = next[1].at
        timers.delete(next[0])
        next[1].callback()
      }
      now = target
    },
  }
}

function hookRuntime() {
  const slots = []
  let cursor = 0
  let effects = []
  let mounted = true
  let staleWrites = 0
  return {
    begin() { cursor = 0 },
    flush() {
      const pending = effects
      effects = []
      pending.forEach((effect) => effect())
    },
    useState(initial) {
      const index = cursor++
      if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial }
      return [slots[index].value, (next) => {
        if (!mounted) { staleWrites++; return }
        slots[index].value = typeof next === 'function' ? next(slots[index].value) : next
      }]
    },
    useRef(initial) { return this.useState(() => ({ current: initial }))[0] },
    useId() { return this.useState(() => `field-${cursor}`)[0] },
    useEffect(effect, dependencies) {
      const index = cursor++
      const previous = slots[index]
      if (previous && dependencies?.every((value, i) => Object.is(value, previous.dependencies[i]))) return
      const slot = { dependencies, effect }
      slots[index] = slot
      effects.push(() => {
        previous?.cleanup?.()
        slot.cleanup = effect()
      })
    },
    replayEffects() {
      slots.filter((slot) => slot.effect).forEach((slot) => {
        slot.cleanup?.()
        slot.cleanup = slot.effect()
      })
    },
    unmount() {
      mounted = false
      slots.forEach((slot) => slot.cleanup?.())
    },
    get staleWrites() { return staleWrites },
  }
}

function elements(element) {
  if (!React.isValidElement(element)) return []
  return [element, ...React.Children.toArray(element.props.children).flatMap(elements)]
}

const settle = () => new Promise(setImmediate)
const plain = (value) => JSON.parse(JSON.stringify(value))

function editor(t, { abortAware = false, localDraft: initialLocal = null, initialDraft = null } = {}) {
  const time = clock()
  const storage = new Map()
  if (initialLocal) storage.set('application-draft:client:first', JSON.stringify(initialLocal))
  const sessionEvents = new EventTarget()
  const requests = []
  const invalidations = []
  const runtimes = []
  const observers = []
  const cache = new QueryClient({ defaultOptions: { mutations: { retry: 2, gcTime: Infinity } } })
  const invalidate = cache.invalidateQueries.bind(cache)
  cache.invalidateQueries = (options) => { invalidations.push(options); return invalidate(options) }
  let scope = 'client:first'
  let generation = 0
  let switching = false
  let runtime
  let key
  let element
  const hooks = Object.fromEntries(['useState', 'useRef', 'useEffect', 'useId'].map((name) => [name, (...args) => runtime[name](...args)]))
  const api = {
    ApiError, sessionEvents, useApiScope: () => scope,
    getSessionGeneration: () => generation, isSessionSwitching: () => switching,
    apiRequest: (url, schema, options) => {
      let resolve
      let reject
      const promise = new Promise((done, fail) => { resolve = done; reject = fail })
      requests.push({ url, options, resolve, reject })
      const abort = () => reject(options.signal.reason)
      if (abortAware) options.signal?.addEventListener('abort', abort, { once: true })
      return promise.then((value) => {
        const result = schema.safeParse(value)
        if (!result.success) throw new ApiError(200, 'INVALID_RESPONSE')
        return result.data
      }).finally(() => options.signal?.removeEventListener('abort', abort))
    },
  }
  const query = {
    useQueryClient: () => cache,
    useMutation: (options) => {
      const [observer] = hooks.useState(() => {
        const instance = new MutationObserver(cache, options)
        observers.push(instance)
        return instance
      })
      hooks.useEffect(() => observer.setOptions(options), [observer, options])
      hooks.useEffect(() => observer.subscribe(() => {}), [observer])
      return {
        ...observer.getCurrentResult(),
        mutate: (variables, callbacks) => { void observer.mutate(variables, callbacks).catch(() => {}) },
      }
    },
  }
  const globals = {
    AbortController, DOMException, Error, Event,
    setTimeout: time.setTimeout, clearTimeout: time.clearTimeout,
    sessionStorage: {
      getItem: (name) => storage.get(name) ?? null,
      setItem: (name, value) => storage.set(name, value),
      removeItem: (name) => storage.delete(name),
    },
    window: new EventTarget(),
    document: { querySelector: () => null },
    requestAnimationFrame: (callback) => callback(),
  }
  const draft = { data: initialDraft, isPending: false, error: null }
  const dashboard = {
    data: { company: { legalForm: 'IP', inn: '123456789012', name: 'ИП Тестовый Предприниматель', okved: '47.11' } },
    isPending: false, error: null,
  }
  const localDraft = load(`${feature}/model/local-draft.ts`, {
    zod: require('zod'), react: hooks, '@/entities/application-form': formEntity,
  }, globals)
  const prefill = load(`${feature}/model/use-application-prefill.ts`, {
    react: hooks, '@tanstack/react-query': query, '@/entities/application-form': formEntity, '@/shared/api': api,
  }, globals)
  const { ApplicationForm } = load(`${feature}/ui/ApplicationForm/ApplicationForm.tsx`, {
    react: hooks, zod: require('zod'), '@tanstack/react-query': query,
    'react-router-dom': { useNavigate: () => () => {} },
    '@alfalab/core-components/button': { Button }, '@alfalab/core-components/input': { Input },
    '@alfalab/core-components/select': { Select }, '@alfalab/core-components/textarea': { Textarea },
    '@alfalab/core-components/modal': { Modal }, '@alfalab/core-components/typography': { Typography },
    '@alfalab/icons/glyph/dist/ArrowRightMIcon': { ArrowRightMIcon: () => null },
    '@alfalab/icons/glyph/dist/CrossMIcon': { CrossMIcon: () => null },
    '@alfalab/icons/glyph/dist/DocumentMIcon': { DocumentMIcon: () => null },
    '@/entities/loan-application': loanEntity,
    '@/entities/application-form': { ...formEntity, useApplicationDraft: () => draft },
    '@/entities/dashboard': { useDashboard: () => dashboard }, '@/entities/company': companyEntity,
    '@/entities/session': { sessionKey: ['session'] }, '@/shared/api': api,
    '@/shared/config': { ROUTES: { applications: '/applications' } },
    '@/shared/lib': { formatMoney: (value) => String(value) },
    '@/shared/ui': { FieldLabel: () => null, RequestState: () => null },
    '../IpApplicationFields': { IpApplicationFields }, '../ApplicationPreparation': { ApplicationPreparation, ApplicationPreparationVisual },
    '../../model/local-draft': { ...localDraft, useLocalDraft: localDraft.loadLocalDraft },
    '../../model/use-application-prefill': prefill,
    './ApplicationForm.module.scss': cssModule,
  }, globals)
  const h = {
    time, requests, storage, invalidations, observers, dashboard, runtimes,
    render() {
      const outer = ApplicationForm({ headingTag: 'h2' })
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
    get card() { return this.find((item) => item.props.className === 'card') },
    get preparation() { return this.find((item) => item.type === ApplicationPreparation) },
    get live() { return this.find((item) => item.props['aria-live'] === 'polite') },
    get modal() { return this.find((item) => item.type === Modal && item.props.className === 'modal') },
    get form() { return this.find((item) => item.type === 'form') },
    get buttons() { return React.Children.toArray(this.find((item) => item.props.className === 'actions').props.children) },
    field(name) { return this.find((item) => item.props.name === name) },
    change(name, value) {
      const field = this.field(name)
      if (field.type === Select) field.props.onChange({ selected: { key: value } })
      else field.props.onChange(null, { value })
      this.render()
    },
    click(index) { this.buttons[index].props.onClick({ currentTarget: { isConnected: true, focus() {} } }) },
    begin(text = description) { this.change('description', text); this.click(0) },
    html() { return renderToStaticMarkup(element) },
    next() { this.form.props.onSubmit({ preventDefault() {} }) },
    editIp(patch, section = 'business') {
      this.find((item) => item.type === IpApplicationFields && item.props.section === section).props.onChange(patch)
      this.render()
    },
    async resolveDraft(registrationDate) {
      await settle()
      const request = requests.at(-1)
      assert.equal(request.url, '/api/applications/draft')
      const snapshot = JSON.parse(request.options.body)
      const savedForm = plain(snapshot.form)
      if (registrationDate !== undefined) savedForm.step2_businessData.applicant.registrationDate = registrationDate
      request.resolve({
        ...snapshot, form: savedForm, revision: (snapshot.revision ?? -1) + 1,
        updatedAt: '2026-10-23T12:00:00Z',
      })
      await settle()
      this.render()
      return snapshot
    },
    resume() {
      this.find((item) => item.type === Button && item.props.children === 'Продолжить заявку').props.onClick({ currentTarget: {} })
      this.render()
    },
    close() { this.modal.props.onClose(); this.render() },
    changeScope() { scope = 'client:second'; this.render() },
    changeSession(notify = true) {
      generation++
      switching = true
      if (notify) sessionEvents.dispatchEvent(new Event('change'))
    },
    replayEffects() { runtime.replayEffects() },
    unmount() { runtime.unmount() },
  }
  h.render()
  t.after(() => { h.unmount(); cache.clear() })
  return h
}

test('empty input still validates, while manual entry needs no preparation request', (t) => {
  const h = editor(t)
  h.click(0)
  h.render()
  assert.equal(h.requests.length, 0)
  assert.equal(h.field('description').props.error, 'Опишите, на что нужны деньги')
  assert.equal(h.modal.props.open, false)
  h.click(1)
  h.render()
  assert.equal(h.modal.props.open, true)
  assert.equal(h.requests.length, 0)
})

test('a double click sends one request and a fast response opens the form without waiting for animation', async (t) => {
  const h = editor(t)
  h.replayEffects()
  h.change('description', description)
  const click = h.buttons[0].props.onClick
  click({ currentTarget: {} })
  click({ currentTarget: {} })
  await settle()
  h.render()
  assert.equal(h.requests.length, 1)
  assert.equal(h.requests[0].url, '/api/ai/prefill')
  assert.equal(h.requests[0].options.method, 'POST')
  assert.deepEqual(JSON.parse(h.requests[0].options.body), { text: description.trim() })
  assert.equal(h.card.props['aria-busy'], true)
  assert.equal(h.buttons[0].props.disabled, true)
  assert.equal(h.buttons[1].props.disabled, false)
  assert.equal(h.field('description').props.readOnly, true)
  assert.equal(h.preparation.props.visible, false)
  h.time.advance(100)
  h.requests[0].resolve(response())
  await settle()
  h.render()
  assert.equal(h.modal.props.open, true)
  assert.equal(h.card.props['aria-busy'], false)
  assert.equal(h.preparation.props.visible, false)
  assert.equal(h.time.size, 0)
  assert.equal(h.field('amount').props.value, '200000')
  assert.equal(h.field('description').props.value, description)
  assert.equal(h.requests.length, 1)
})

test('preparation appears at 150 ms, adds the slow hint at 8 s and retains the same actions', async (t) => {
  const h = editor(t)
  const labels = h.buttons.map((button) => button.props.children)
  h.begin()
  await settle()
  h.time.advance(149)
  h.render()
  assert.equal(h.preparation.props.visible, false)
  h.time.advance(1)
  h.render()
  assert.equal(h.preparation.props.visible, true)
  assert.equal(h.preparation.props.slow, false)
  assert.equal(h.find((item) => item.props.className === 'intent').props.inert, true)
  assert.equal(h.modal.props.open, false)
  assert.equal(h.live.props['aria-atomic'], 'true')
  assert.equal(elements(h.card).includes(h.live), false)
  h.time.advance(7849)
  h.render()
  assert.equal(h.preparation.props.slow, false)
  h.time.advance(1)
  h.render()
  assert.equal(h.preparation.props.slow, true)
  assert.match(h.live.props.children, /Можно подождать или заполнить заявку самостоятельно/)
  assert.deepEqual(h.buttons.map((button) => button.props.children), labels)
  assert.equal(h.requests.length, 1)
  h.requests[0].resolve(response())
  await settle()
  h.render()
  assert.equal(h.modal.props.open, true)
  assert.equal(h.time.size, 0)
})

test('manual exit is immediate at every wait stage; ignored aborts cannot overwrite manual fields', async (t) => {
  for (const delay of [0, 149, 150, 8000]) {
    const h = editor(t)
    h.begin()
    await settle()
    h.time.advance(delay)
    h.render()
    h.dashboard.error = new Error('Background refresh failed')
    h.render()
    assert.equal(h.buttons[1].props.disabled, false)
    h.click(1)
    h.render()
    assert.equal(h.requests[0].options.signal.aborted, true)
    assert.equal(h.requests[0].options.signal.reason.name, 'AbortError')
    assert.equal(h.card.props['aria-busy'], false)
    assert.equal(h.modal.props.open, true)
    assert.equal(h.time.size, 0)
    h.change('amount', '700000')
    h.change('purpose', 'Ручная цель')
    h.close()
    const before = [...h.storage]
    h.requests[0].resolve(response({ amount: 999999, businessTask: null }))
    await settle()
    h.time.advance(60000)
    h.render()
    assert.equal(h.modal.props.open, false)
    assert.equal(h.field('amount').props.value, '700000')
    assert.equal(h.field('purpose').props.value, 'Ручная цель')
    assert.equal(h.field('description').props.value, description)
    assert.deepEqual([...h.storage], before)
    assert.ok(!h.html().includes(fallbackMessage))
    assert.equal(h.requests.length, 1)
  }
})

test('an abort-aware transport does not report intentional cancellation as a failure', async (t) => {
  const h = editor(t, { abortAware: true })
  h.begin()
  await settle()
  h.click(1)
  await settle()
  h.render()
  assert.equal(h.modal.props.open, true)
  assert.equal(h.field('description').props.value, description)
  assert.ok(!h.html().includes(fallbackMessage))
  assert.equal(h.time.size, 0)
})

test('cancellation or a generation change before mutation execution prevents the initial API call', async (t) => {
  for (const reason of ['manual', 'unmount', 'session']) {
    const h = editor(t)
    h.begin()
    if (reason === 'unmount') h.unmount()
    else if (reason === 'session') h.changeSession(false)
    else h.click(1)
    await settle()
    assert.equal(h.requests.length, 0)
    assert.equal(h.time.size, 0)
    assert.equal(h.runtimes[0].staleWrites, 0)
    if (reason !== 'unmount') {
      h.render()
      assert.equal(h.modal.props.open, reason === 'manual')
      assert.equal(h.card.props['aria-busy'], false)
      assert.equal(h.field('description').props.value, description)
      assert.ok(!h.html().includes(fallbackMessage))
    }
  }
})

test('settling an abandoned request cannot stop or apply data over a newer attempt', async (t) => {
  for (const fail of [false, true]) {
    const h = editor(t)
    h.begin()
    await settle()
    h.click(1)
    h.render()
    h.close()
    h.begin('Новая бизнес-задача')
    await settle()
    h.time.advance(150)
    if (fail) h.requests[0].reject(new ApiError(409, 'LEGAL_FORM_REQUIRED'))
    else h.requests[0].resolve(response({ amount: 999999 }))
    await settle()
    h.render()
    assert.equal(h.card.props['aria-busy'], true)
    assert.equal(h.preparation.props.visible, true)
    assert.equal(h.modal.props.open, false)
    assert.equal(h.requests[1].options.signal.aborted, false)
    assert.equal(h.time.size, 2)
    assert.equal(h.invalidations.length, 0)
    h.requests[1].resolve(response({ amount: 300000 }))
    await settle()
    h.render()
    assert.equal(h.modal.props.open, true)
    assert.equal(h.field('amount').props.value, '300000')
    assert.equal(h.field('description').props.value, 'Новая бизнес-задача')
  }
})

test('unmount aborts transport and timers; hook-level mutation callbacks do not write afterward', async (t) => {
  const h = editor(t)
  h.begin()
  await settle()
  const before = [...h.storage]
  h.unmount()
  assert.equal(h.requests[0].options.signal.aborted, true)
  assert.equal(h.time.size, 0)
  h.requests[0].resolve(response())
  await settle()
  h.time.advance(60000)
  assert.equal(h.runtimes[0].staleWrites, 0)
  assert.deepEqual([...h.storage], before)
  assert.equal(h.invalidations.length, 0)
})

test('the scope key isolates a new editor even if the old API ignores cancellation', async (t) => {
  const h = editor(t)
  h.begin()
  await settle()
  h.changeScope()
  assert.equal(h.requests[0].options.signal.aborted, true)
  assert.equal(h.field('description').props.value, '')
  h.begin('Задача другого профиля')
  await settle()
  h.requests[0].resolve(response({ amount: 999999 }))
  await settle()
  h.render()
  assert.equal(h.runtimes.length, 2)
  assert.equal(h.runtimes[0].staleWrites, 0)
  assert.equal(h.modal.props.open, false)
  assert.equal(h.card.props['aria-busy'], true)
  assert.equal(h.field('description').props.value, 'Задача другого профиля')
  assert.equal(h.field('amount').props.value, '')
  assert.equal(h.requests[1].options.signal.aborted, false)
})

test('session transition stops waiting before a scope remount without opening the fallback form', async (t) => {
  const h = editor(t)
  h.begin()
  await settle()
  h.changeSession()
  h.render()
  assert.equal(h.card.props['aria-busy'], false)
  assert.equal(h.requests[0].options.signal.aborted, true)
  assert.equal(h.time.size, 0)
  h.requests[0].reject(new ApiError(409, 'SESSION_CHANGED'))
  await settle()
  h.click(0)
  await settle()
  h.render()
  assert.equal(h.requests.length, 1)
  assert.equal(h.modal.props.open, false)
  assert.equal(h.field('description').props.value, description)
  assert.ok(!h.html().includes(fallbackMessage))
})

test('generation is checked again before applying a response or a stale guard error', async (t) => {
  for (const fail of [false, true]) {
    const h = editor(t)
    h.begin()
    await settle()
    h.changeSession(false)
    if (fail) h.requests[0].reject(new ApiError(409, 'LEGAL_FORM_REQUIRED'))
    else h.requests[0].resolve(response())
    await settle()
    h.render()
    assert.equal(h.modal.props.open, false)
    assert.equal(h.card.props['aria-busy'], false)
    assert.equal(h.field('amount').props.value, '')
    assert.equal(h.invalidations.length, 0)
    assert.equal(h.time.size, 0)
  }
})

test('the 60 s deadline aborts and opens the same form even when transport never rejects', async (t) => {
  const h = editor(t)
  h.begin()
  await settle()
  h.time.advance(59999)
  h.render()
  assert.equal(h.card.props['aria-busy'], true)
  assert.equal(h.modal.props.open, false)
  h.time.advance(1)
  h.render()
  assert.equal(h.requests[0].options.signal.aborted, true)
  assert.equal(h.requests[0].options.signal.reason.name, 'TimeoutError')
  assert.equal(h.modal.props.open, true)
  assert.ok(h.html().includes(fallbackMessage))
  assert.equal(h.field('description').props.value, description)
  h.change('amount', '800000')
  h.close()
  h.requests[0].resolve(response())
  await settle()
  h.render()
  assert.equal(h.modal.props.open, false)
  assert.equal(h.field('amount').props.value, '800000')
  assert.equal(h.time.size, 0)
  assert.equal(h.requests.length, 1)
})

test('network, server and invalid-response failures fall back without retrying or clearing description', async (t) => {
  for (const error of [new Error('Network failed'), new ApiError(500, 'SERVER_ERROR'), null]) {
    const h = editor(t)
    h.begin()
    await settle()
    const mutation = h.observers.find((observer) => observer.getCurrentResult().variables?.controller)
    assert.equal(mutation.options.retry, false)
    if (error) h.requests[0].reject(error)
    else h.requests[0].resolve({ invalid: true })
    await settle()
    h.render()
    assert.equal(h.card.props['aria-busy'], false)
    assert.equal(h.modal.props.open, true)
    assert.ok(h.html().includes(fallbackMessage))
    assert.equal(h.field('description').props.value, description)
    assert.equal(h.time.size, 0)
    assert.equal(h.requests.length, 1)
  }
})

test('legal form, session, validation and authorization guards retain their dedicated behavior', async (t) => {
  for (const [status, code] of [[409, 'LEGAL_FORM_REQUIRED'], [409, 'SESSION_CHANGED'], [400, 'BAD_REQUEST'], [401, 'UNAUTHORIZED'], [403, 'FORBIDDEN']]) {
    const h = editor(t)
    h.begin()
    await settle()
    h.requests[0].reject(new ApiError(status, code, `Guard: ${code}`))
    await settle()
    h.render()
    assert.equal(h.modal.props.open, false)
    assert.equal(h.card.props['aria-busy'], false)
    assert.equal(h.field('description').props.value, description)
    assert.ok(!h.html().includes(fallbackMessage))
    if (status === 409) assert.ok(!h.html().includes(`Guard: ${code}`))
    else assert.ok(h.html().includes(`Guard: ${code}`))
    assert.deepEqual(plain(h.invalidations), code === 'LEGAL_FORM_REQUIRED' ? [{ queryKey: ['session'] }] : [])
    assert.equal(h.time.size, 0)
  }
})

test('partial data preserves the source description, missing annotations and automatic field hints', async (t) => {
  for (const businessTask of [null, '']) {
    const h = editor(t)
    h.begin()
    await settle()
    h.requests[0].resolve(response({ businessTask, amount: null }, ['step1_financingParameters.amount']))
    await settle()
    h.render()
    assert.equal(h.modal.props.open, true)
    assert.equal(h.field('description').props.value, description)
    assert.equal(h.field('amount').props.error, 'Заполните поле')
    assert.equal(h.field('termDays').props.hint, 'Заполнено автоматически, проверьте')
    assert.ok(h.html().includes(partialMessage))
    assert.ok(!h.html().includes('Заполнено ИИ, проверьте'))
    h.next()
    h.render()
    assert.equal(h.requests.length, 1)
    assert.equal(h.field('amount').props.error, 'Минимальная сумма 50 000 ₽')
  }
})

test('preparation never saves a server draft; Continue preserves submission semantics and wire fields', async (t) => {
  const h = editor(t)
  h.begin()
  await settle()
  const prepared = response()
  h.requests[0].resolve(prepared)
  await settle()
  h.render()
  assert.equal(h.requests.length, 1)
  h.next()
  await settle()
  h.render()
  assert.equal(h.requests.length, 2)
  assert.equal(h.requests[1].url, '/api/applications/draft')
  assert.equal(h.requests[1].options.method, 'PUT')
  const saved = JSON.parse(h.requests[1].options.body)
  assert.equal(saved.currentStep, 1)
  assert.equal(saved.revision, null)
  assert.equal(saved.form.step1_financingParameters.businessTask, description.trim())
  assert.equal(saved.form.step1_financingParameters.termDays, 60)
  assert.deepEqual(saved.aiFilled, prepared.aiFilled)
  assert.deepEqual(saved.missingFields, prepared.missingFields)
  assert.deepEqual(saved.form.step3_verification.consents, prepared.form.step3_verification.consents)
  assert.equal(saved.form.step2_businessData.applicant.mainOkved, '47.11')
  const business = h.find((item) => item.type === IpApplicationFields)
  assert.equal(business.props.value.monthlyRevenue, '500000')
  assert.equal(business.props.value.existingDebt, '0')
  assert.equal(business.props.value.personalData, false)
  assert.equal(business.props.value.bkiRequest, false)
  assert.equal(business.props.value.fnsRequest, false)
})

test('preparation is a decorative, token-styled composition with reserved space and reduced motion', () => {
  const view = ApplicationPreparation({ visible: true, slow: false, headingTag: 'h2' })
  const visual = elements(view).find((item) => item.type === ApplicationPreparationVisual)
  assert.ok(visual)
  const graphic = ApplicationPreparationVisual()
  assert.equal(graphic.props['aria-hidden'], 'true')
  assert.equal(graphic.props['data-active'], true)
  assert.equal(elements(graphic).filter((item) => item.props.className === 'traveller').length, 3)
  const html = renderToStaticMarkup(view)
  assert.ok(html.includes('<h2>Готовим вашу заявку</h2>'))
  for (const label of ['Сумма', 'Срок', 'Цель']) assert.ok(html.includes(label))
  assert.ok(!html.includes('style='))
  assert.doesNotMatch(html.replace(/<[^>]+>/g, ''), /\d|%|ИИ|БКИ|одобр/i)
  const preparationCss = readFileSync(path.join(root, `${feature}/ui/ApplicationPreparation/ApplicationPreparation.module.scss`), 'utf8')
  const formCss = readFileSync(path.join(root, `${feature}/ui/ApplicationForm/ApplicationForm.module.scss`), 'utf8')
  assert.match(preparationCss, /prefers-reduced-motion: reduce[\s\S]*animation: none/)
  assert.match(preparationCss, /\.slow\[data-visible='false'\][\s\S]*?visibility: hidden/)
  assert.match(preparationCss, /@media \(max-width:[\s\S]*grid-template-columns: minmax\(0, 1fr\)/)
  assert.doesNotMatch(preparationCss, /!important|#[\da-f]{3,8}\b|rgba?\(/i)
  assert.match(formCss, /\.startContent > \*\s*\{\s*grid-area: 1 \/ 1/)
  assert.match(formCss, /\.intent\[data-hidden='true'\]\s*\{\s*visibility: hidden/)
  assert.match(preparationCss, /--cycle: 2\.4s/)
  assert.match(preparationCss, /--row-delay: 0\.2s/)
  assert.match(preparationCss, /--row-delay: 0\.4s/)
  assert.match(preparationCss, /\[data-active='true'\] \.traveller\s*\{\s*animation: transfer-line/)
  assert.match(preparationCss, /transform: translate\(var\(--flight-end\), var\(--flight-drop\)\)/)
  assert.match(preparationCss, /\.explanation > p\s*\{\s*grid-area: 1 \/ 1/)
  assert.match(preparationCss, /\.flights\s*\{\s*position: absolute;[^}]*overflow: clip/)
})

test('the initial screen has no illustration and keeps the actual term restriction', (t) => {
  const h = editor(t)
  const motif = h.find((item) => item.type === ApplicationPreparationVisual)
  assert.equal(motif, undefined)
  assert.ok(!h.html().includes('class="illustration"'))
  assert.equal(h.buttons[0].props.children, 'Подготовить заявку')
  assert.ok(h.find((item) => item.type === 'header' && item.props.className === 'intentHeader'))
  assert.ok(h.html().includes('Срок транша: только 30, 60 или 90 дней.'))
  assert.ok(h.html().includes('Это не срок всего договора.'))
  assert.equal(h.field('description').props['aria-label'], 'Ваша бизнес-задача')
  assert.match(h.field('description').props['aria-describedby'], /intent-help .*intent-terms/)
  const inactive = ApplicationPreparation({ visible: false, slow: false, headingTag: 'h2' })
  const hiddenMotif = elements(inactive).find((item) => item.type === ApplicationPreparationVisual)
  assert.equal(hiddenMotif, undefined)
})

test('IP automatic annotations use the same wording without changing wire paths', () => {
  const { IpApplicationFields: Fields } = load(`${feature}/ui/IpApplicationFields/IpApplicationFields.tsx`, {
    react: React, '@alfalab/core-components/input': { Input }, '@alfalab/core-components/select': { Select },
    '@alfalab/core-components/button': { Button }, '@alfalab/core-components/checkbox': { Checkbox: () => null },
    '@/entities/company': { ...companyEntity, industryGroups: [] }, '@/shared/ui': { FieldLabel: () => null },
    './IpApplicationFields.module.scss': cssModule,
  })
  const html = renderToStaticMarkup(React.createElement(Fields, {
    section: 'business', onChange() {},
    value: { companyName: 'ИП Тестовый Предприниматель', inn: '123456789012', legalForm: 'ИП', monthlyRevenue: '500000', existingDebt: '0', taxSystem: 'USN' },
    aiFilled: new Set(['step2_businessData.financials.monthlyRevenue', 'step2_businessData.applicant.taxSystem']),
  }))
  assert.equal((html.match(/Заполнено автоматически, проверьте/g) || []).length, 2)
  assert.ok(!html.includes('Заполнено ИИ, проверьте'))
})

function readyLocalDraft(ipEdits = {}, currentStep = 3) {
  return {
    description, amount: '200000', termDays: '60', purpose: 'Закупка товара',
    currentStep, started: true, revision: null, serverForm: null,
    acceptedAt: '2026-10-01T12:00:00Z',
    ipEdits: {
      companyName: 'ИП Тестовый Предприниматель', inn: '123456789012', legalForm: 'ИП',
      taxSystem: 'USN', monthlyRevenue: '500000', existingDebt: '0',
      personalData: true, bkiRequest: true, fnsRequest: true,
      fullName: 'Тестовый Предприниматель', ogrnip: '123456789012345', registrationDate: '',
      okved: '47.11', industry: 'trade', registrationAddress: 'Тестовый адрес',
      phone: '+79990000000', email: 'test@example.com', ...ipEdits,
    },
  }
}

function renderIpFields(section, props = {}) {
  const inputs = []
  const selects = []
  const fieldLabels = []
  const { IpApplicationFields: Fields } = load(`${feature}/ui/IpApplicationFields/IpApplicationFields.tsx`, {
    react: React,
    '@alfalab/core-components/input': { Input: (input) => { inputs.push(input); return React.createElement(Input, input) } },
    '@alfalab/core-components/select': { Select: (select) => { selects.push(select); return React.createElement(Select, select) } },
    '@alfalab/core-components/button': { Button }, '@alfalab/core-components/checkbox': { Checkbox: () => null },
    '@/entities/company': { ...companyEntity, industryGroups: [] },
    '@/shared/ui': { FieldLabel: (label) => { fieldLabels.push(label); return React.createElement('label', { htmlFor: label.htmlFor }, label.text) } },
    './IpApplicationFields.module.scss': cssModule,
  })
  const html = renderToStaticMarkup(React.createElement(Fields, {
    section, value: readyLocalDraft().ipEdits, onChange() {}, ...props,
  }))
  return { html, inputs, selects, fieldLabels }
}

test('registration date is absent from business, registration and review field rendering', () => {
  const value = readyLocalDraft({ registrationDate: '2014-05-06' }).ipEdits
  for (const section of ['business', 'registration']) {
    const rendered = renderIpFields(section, {
      value, profileMatches: true, onConfirm() {},
      missingFields: new Set(['step2_businessData.applicant.registrationDate']),
      errors: { registrationDate: 'Укажите дату' },
    })
    assert.ok(!rendered.inputs.some((input) => input.name === 'registrationDate'))
    assert.ok(!rendered.html.includes('Дата регистрации ИП'))
    assert.ok(!rendered.html.includes('2014-05-06'))
    assert.ok(!rendered.html.includes('Укажите дату'))
    if (section === 'registration') {
      assert.ok(rendered.inputs.some((input) => input.name === 'ogrnip'))
      assert.ok(rendered.inputs.some((input) => input.name === 'okved'))
      assert.ok(rendered.selects.some((select) => select.name === 'industry'))
    }
  }
})

test('legal form and tax system share label rows and an explanatory tax hint', () => {
  const rendered = renderIpFields('business')
  const legal = rendered.inputs.find((input) => input.name === 'legalForm')
  const tax = rendered.selects.find((select) => select.name === 'taxSystem')
  const legalLabel = rendered.fieldLabels.find((label) => label.text === 'Форма бизнеса')
  const taxLabel = rendered.fieldLabels.find((label) => label.text === 'Система налогообложения')
  assert.ok(legalLabel)
  assert.ok(taxLabel)
  assert.equal(legal.label, undefined)
  assert.equal(tax.label, undefined)
  assert.equal(tax.size, legal.size)
  assert.equal(taxLabel.htmlFor, `${tax.id}-input`)
  assert.ok(rendered.html.includes(`id="${tax.id}-label"`))
  assert.match(taxLabel.hint, /Режим, по которому ИП платит налоги/)
  assert.match(taxLabel.hint, /УСН или ОСНО/)
  assert.match(taxLabel.hint, /личном кабинете ИП на сайте ФНС/)
  assert.equal(tax.fieldProps['aria-required'], true)
  assert.deepEqual(plain(tax.options.map((option) => option.key)), ['OSNO', 'USN', 'PSN', 'AUSN', 'NPD'])
  const css = readFileSync(path.join(root, `${feature}/ui/IpApplicationFields/IpApplicationFields.module.scss`), 'utf8')
  assert.match(css, /\.grid\s*\{[^}]*align-items: start/)
  assert.match(css, /\.grid > \.pairedField\s*\{[^}]*grid-template-rows: subgrid/)
})

test('a prefill without registry date can reach review and submit without editing a hidden field', async (t) => {
  const h = editor(t)
  h.begin()
  await settle()
  const prepared = response()
  prepared.form.step2_businessData.applicant.registrationDate = null
  h.requests[0].resolve(prepared)
  await settle()
  h.render()
  h.next()
  assert.equal((await h.resolveDraft()).form.step2_businessData.applicant.registrationDate, null)
  h.editIp({ personalData: true, bkiRequest: true, fnsRequest: true })
  h.next()
  assert.equal((await h.resolveDraft()).form.step2_businessData.applicant.registrationDate, null)
  h.next()
  const reviewed = await h.resolveDraft()
  assert.equal(reviewed.currentStep, 3)
  assert.equal(reviewed.form.step2_businessData.applicant.registrationDate, null)
  h.next()
  await settle()
  assert.equal(h.requests.at(-1).url, '/api/applications')
  assert.equal(h.requests.at(-1).options.method, 'POST')
  const submitted = JSON.parse(h.requests.at(-1).options.body)
  assert.equal(submitted.step2_businessData.applicant.registrationDate, null)
  assert.equal(submitted.step2_businessData.applicant.ogrnip, '123456789012345')
  assert.equal(submitted.step3_verification.consents.personalData, true)
  assert.ok(submitted.step3_verification.consents.acceptedAt)
})

test('manual entry uses a registry date returned by draft save without inventing one on the client', async (t) => {
  const h = editor(t)
  h.click(1)
  h.render()
  h.change('amount', '200000')
  h.change('termDays', '60')
  h.change('purpose', 'Закупка товара')
  h.next()
  const first = await h.resolveDraft('2016-04-12')
  assert.equal(first.form.step2_businessData.applicant.registrationDate, null)
  h.editIp({ taxSystem: 'USN', monthlyRevenue: '500000', personalData: true, bkiRequest: true, fnsRequest: true })
  h.next()
  assert.equal((await h.resolveDraft()).form.step2_businessData.applicant.registrationDate, '2016-04-12')
  h.editIp({ ogrnip: '123456789012345', registrationAddress: 'Тестовый адрес', phone: '+79990000000', email: 'test@example.com' }, 'registration')
  h.next()
  assert.equal((await h.resolveDraft()).form.step2_businessData.applicant.registrationDate, '2016-04-12')
  const local = JSON.parse(h.storage.get('application-draft:client:first'))
  assert.equal(local.serverForm.step2_businessData.applicant.registrationDate, '2016-04-12')
  h.next()
  await settle()
  assert.equal(h.requests.at(-1).url, '/api/applications')
  assert.equal(JSON.parse(h.requests.at(-1).options.body).step2_businessData.applicant.registrationDate, '2016-04-12')
  assert.ok(h.requests.every((request) => request.url !== '/api/ai/prefill'))
})

test('legacy missing, invalid and future dates cannot trap a resumed draft', async (t) => {
  for (const [value, expected] of [['', null], ['31.02.2020', null], ['not a date', null], ['2999-01-01', null], ['29.02.2020', '2020-02-29'], ['2011-03-04', '2011-03-04']]) {
    for (const step of [0, 3]) {
      const h = editor(t, { localDraft: readyLocalDraft({ registrationDate: value }, step) })
      h.resume()
      h.next()
      await settle()
      assert.equal(h.requests.length, 1, `Hidden date blocked step ${step}: ${value}`)
      const request = h.requests[0]
      assert.equal(request.url, step === 0 ? '/api/applications/draft' : '/api/applications')
      const body = JSON.parse(request.options.body)
      const form = step === 0 ? body.form : body
      assert.equal(form.step2_businessData.applicant.registrationDate, expected)
    }
  }
})

test('the authoritative server date wins over stale local edits on resume', async (t) => {
  const savedForm = response().form
  savedForm.step2_businessData.applicant.registrationDate = '2013-06-20'
  const local = readyLocalDraft({ registrationDate: '2011-03-04' })
  local.serverForm = savedForm
  const h = editor(t, { localDraft: local })
  h.resume()
  h.next()
  await settle()
  assert.equal(h.requests[0].url, '/api/applications')
  assert.equal(JSON.parse(h.requests[0].options.body).step2_businessData.applicant.registrationDate, '2013-06-20')
})

test('resuming a server draft preserves its optional registry date through submission', async (t) => {
  for (const registrationDate of [null, '2014-05-06']) {
    const form = response().form
    form.step2_businessData.applicant.registrationDate = registrationDate
    form.step3_verification.consents = {
      personalData: true, bkiRequest: true, fnsRequest: true, acceptedAt: '2026-10-01T12:00:00Z',
    }
    const h = editor(t, { initialDraft: {
      form, currentStep: 3, aiFilled: [], missingFields: [], revision: 4,
      updatedAt: '2026-10-23T12:00:00Z',
    } })
    h.resume()
    h.next()
    await settle()
    assert.equal(h.requests.length, 1)
    assert.equal(h.requests[0].url, '/api/applications')
    assert.equal(JSON.parse(h.requests[0].options.body).step2_businessData.applicant.registrationDate, registrationDate)
  }
})

test('hiding registry date does not weaken visible registration, business or consent validation', (t) => {
  for (const [patch, errorField] of [
    [{ ogrnip: '' }, 'ogrnip'], [{ email: 'not-an-email' }, 'email'],
    [{ taxSystem: '' }, 'taxSystem'], [{ personalData: false }, 'personalData'],
  ]) {
    const h = editor(t, { localDraft: readyLocalDraft(patch) })
    h.resume()
    h.next()
    h.render()
    assert.equal(h.requests.length, 0)
    const errors = h.find((item) => item.type === IpApplicationFields).props.errors
    assert.ok(errors[errorField])
    assert.equal(errors.registrationDate, undefined)
  }
})
