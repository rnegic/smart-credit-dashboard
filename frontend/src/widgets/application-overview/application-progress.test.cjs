const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

const root = path.resolve(__dirname, '../..')

function load(relative, dependencies = {}, globals = {}) {
  const file = path.join(root, relative)
  const compiled = ts.transpileModule(readFileSync(file, 'utf8'), {
    fileName: file,
    reportDiagnostics: true,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2023,
      jsx: ts.JsxEmit.ReactJSX,
    },
  })
  const errors = compiled.diagnostics.filter((item) => item.category === ts.DiagnosticCategory.Error)
  assert.equal(errors.length, 0, ts.formatDiagnostics(errors, {
    getCanonicalFileName: (file) => file, getCurrentDirectory: () => root, getNewLine: () => '\n',
  }))
  const module = { exports: {} }
  vm.runInNewContext(`(function(require, module, exports) { ${compiled.outputText}\n})`, globals, { filename: file })((id) => {
    if (id === 'react/jsx-runtime') return require(id)
    assert.ok(Object.hasOwn(dependencies, id), `Unexpected dependency: ${id}`)
    return dependencies[id]
  }, module, module.exports)
  return module.exports
}

const { getApplicationProgress } = load('entities/loan-application/get-application-progress.ts')
const { formatDate } = load('shared/lib/format-date.ts')
const { formatMoney } = load('shared/lib/format-money.ts')
const codes = ['SUBMITTED', 'REVIEW', 'DECISION', 'OFFER', 'SIGNING', 'ISSUED']
const titles = ['Заявка', 'Проверка', 'Статус', 'Предложение', 'Подписание', 'Выдача']
const application = {
  id: 7, amount: 100000, termDays: 30, rate: 24.5, purpose: 'Оборотные средства',
  decision: 'ALTERNATIVE_OFFER', finalRate: null,
  internalScore: 66, riskClass: 'B', scoring: null,
  createdAt: '2026-10-01T12:00:00Z', status: 'OFFER_READY',
}
const offer = {
  id: 9, amount: 90000, termDays: 60, finalRate: 25.25,
  monthlyPayment: 48735.62, validUntil: '2099-12-31', status: 'ACTIVE',
}
const styles = new Proxy({}, { get: (_, key) => String(key) })
const text = ({ children, tag = 'span', ...props }) => React.createElement(tag, {
  id: props.id, 'aria-current': props['aria-current'], role: props.role,
}, children)
const Typography = { Text: text, TitleResponsive: text }
const Button = ({ children, disabled, loading, view, ...props }) => React.createElement('button', {
  disabled, 'aria-busy': loading, 'data-view': view,
  'aria-describedby': props['aria-describedby'],
}, children)
const Panel = ({ open, children, footer }) => open ? React.createElement('aside', null,
  React.createElement('div', { 'data-panel-content': true }, children),
  React.createElement('footer', null, footer),
) : null

function nodes(element, predicate) {
  const result = []
  React.Children.forEach(element, (child) => {
    if (!React.isValidElement(child)) return
    if (predicate(child)) result.push(child)
    result.push(...nodes(child.props.children, predicate))
  })
  return result
}

function content(element) {
  return React.Children.toArray(element).map((child) => React.isValidElement(child)
    ? content(child.props.children) : String(child)).join('')
}

function buttonIn(element, label) {
  const matches = nodes(element, (child) => child.type === Button && content(child) === label)
  assert.equal(matches.length, 1, `Expected one button: ${label}`)
  return matches[0]
}

function termsIn(element) {
  const terms = nodes(element, (child) => child.type === 'dl' && child.props.className === 'terms')
  assert.equal(terms.length, 1)
  return nodes(terms[0], (child) => child.type === 'dd').map(content)
}

function expectedTerms(value = offer) {
  return [formatMoney(value.amount, { exact: true }), `${value.termDays} дней`,
    `${String(value.finalRate).replace('.', ',')}% годовых`, formatMoney(value.monthlyPayment, { exact: true })]
}

function makeView({ status = 'OFFER_READY', applicationOverride = {}, offerOverride = {},
  officerComment = 'Недостаточно данных о доходах', aiComment = 'Автоматическое заключение скоринга' } = {}) {
  return {
    ...application, status,
    decision: { IN_REVIEW: 'MANUAL_REVIEW', OFFER_READY: 'ALTERNATIVE_OFFER', ACCEPTED: 'APPROVED', DECLINED: 'DECLINED' }[status],
    ...applicationOverride,
    offer: offerOverride === null ? null : { ...offer, status: status === 'ACCEPTED' ? 'ACCEPTED' : 'ACTIVE', ...offerOverride },
    officerComment, aiComment,
  }
}

const unrelated = makeView({ applicationOverride: { id: 8 },
  offerOverride: { id: 999, amount: 7654321.98, finalRate: 77.7 }, officerComment: 'Комментарий другой заявки' })

function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function createClock(initial = '2026-10-23T12:00:00') {
  let now = new Date(initial).getTime()
  let sequence = 0
  const timers = new Map()
  class ClockDate extends Date {
    constructor(...args) { super(...(args.length ? args : [now])) }
    static now() { return now }
  }
  return {
    Date: ClockDate,
    timers,
    window: {
      setTimeout(callback, delay) {
        const id = ++sequence
        timers.set(id, { callback, at: now + delay, delay })
        return id
      },
      clearTimeout(id) { timers.delete(id) },
    },
    set(value) { now = new Date(value).getTime() },
    advanceTo(value) {
      const target = new Date(value).getTime()
      assert.ok(target >= now)
      for (;;) {
        const next = [...timers].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0]
        if (!next) break
        timers.delete(next[0])
        now = next[1].at
        next[1].callback()
      }
      now = target
    },
  }
}

function createHooks() {
  const slots = []
  let cursor = 0
  let changed = false
  let effects = []
  function slot(kind, initialize) {
    const index = cursor++
    if (!slots[index]) slots[index] = { kind, value: initialize(index) }
    assert.equal(slots[index].kind, kind, `Hook order changed at ${index}`)
    return slots[index].value
  }
  const sameDeps = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]))
  const react = {
    ...React,
    useState(initial) {
      const state = slot('state', () => {
        const state = { value: typeof initial === 'function' ? initial() : initial }
        state.set = (next) => {
          const value = typeof next === 'function' ? next(state.value) : next
          if (!Object.is(value, state.value)) { state.value = value; changed = true }
        }
        return state
      })
      return [state.value, state.set]
    },
    useRef(initial) { return slot('ref', () => ({ current: initial })) },
    useId() { return slot('id', (index) => `test-heading-${index}`) },
    useCallback(callback, deps) {
      const state = slot('callback', () => ({}))
      if (!sameDeps(state.deps, deps)) Object.assign(state, { deps, callback })
      return state.callback
    },
    useEffect(callback, deps) {
      const state = slot('effect', () => ({}))
      if (!sameDeps(state.deps, deps)) effects.push(() => {
        state.cleanup?.()
        state.deps = deps
        state.cleanup = callback()
      })
    },
  }
  return {
    react, slot,
    render(component, props) {
      let element
      let renders = 0
      do {
        assert.ok(++renders <= 20, 'Render-phase state updates did not stabilize')
        cursor = 0
        changed = false
        effects = []
        element = component(props)
      } while (changed)
      for (const effect of effects) effect()
      return element
    },
    dispose() { for (const state of slots) if (state.kind === 'effect') state.value.cleanup?.() },
  }
}

class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; this.name = 'ApiError' }
}

function acceptance({ view = makeView(), query = {}, props = {}, refetches = [], posts = [],
  clock = createClock(), scope = 'client-session', panelComponent = Panel, autoRender = true } = {}) {
  const hooks = createHooks()
  const pending = new Set()
  const unexpected = []
  const h = {
    view, clock, scope, requests: [], refetchCalls: [], events: [], invalidations: [], mutations: [], closes: 0,
    refetches: [...refetches], posts: [...posts],
    query: { data: [unrelated, view], isPending: false, isFetching: false, isError: false, error: null, ...query },
    props: { open: true, application: view, offer: view.offer, officerComment: view.officerComment,
      returnFocusRef: { current: null }, children: React.createElement('p', null, 'Технические сведения'),
      onClose: () => { h.closes++ }, ...props },
  }
  async function reply(queue, operation) {
    if (!queue.length) {
      unexpected.push(operation)
      throw new Error(`Unscripted ${operation}`)
    }
    const value = queue.shift()
    if (value instanceof Error) throw value
    return typeof value === 'function' ? value() : value
  }
  async function refetch(options) {
    h.events.push('GET')
    h.refetchCalls.push(options)
    h.query.isFetching = true
    try {
      const data = await reply(h.refetches, 'GET /api/applications')
      Object.assign(h.query, { data, isPending: false, isError: false, error: null })
      return { data, isError: false, error: null }
    } catch (error) {
      Object.assign(h.query, { isPending: false, isError: true, error })
      throw error
    } finally { h.query.isFetching = false }
  }
  const idle = () => ({ status: 'idle', isPending: false, isSuccess: false, isError: false, data: undefined, error: null, variables: undefined })
  function useMutation(options) {
    const mutation = hooks.slot('mutation', () => {
      const mutation = { state: idle(), calls: [], resets: 0 }
      // The mock deliberately does not deduplicate: only the production ref can block a second click.
      mutation.mutate = (variables) => {
        mutation.calls.push(variables)
        mutation.state = { ...idle(), status: 'pending', isPending: true, variables }
        const task = Promise.resolve().then(async () => {
          try {
            const data = await mutation.options.mutationFn(variables)
            await mutation.options.onSuccess?.(data, variables)
            await mutation.options.onSettled?.(data, null, variables)
            mutation.state = { ...idle(), status: 'success', isSuccess: true, data, variables }
          } catch (error) {
            await mutation.options.onError?.(error, variables)
            await mutation.options.onSettled?.(undefined, error, variables)
            mutation.state = { ...idle(), status: 'error', isError: true, error, variables }
          }
        })
        pending.add(task)
        void task.finally(() => pending.delete(task))
      }
      mutation.reset = () => { mutation.resets++; mutation.state = idle() }
      h.mutations.push(mutation)
      return mutation
    })
    mutation.options = options
    return { ...mutation.state, mutate: mutation.mutate, reset: mutation.reset }
  }
  h.useApplications = () => ({ ...h.query, refetch })
  const { AcceptOffer } = load('features/accept-offer/ui/AcceptOffer/AcceptOffer.tsx', {
    react: hooks.react,
    '@tanstack/react-query': {
      useQueryClient: () => ({ invalidateQueries: async ({ queryKey }) => { h.invalidations.push(Array.from(queryKey)) } }),
      useMutation,
    },
    '@alfalab/core-components/button': { Button },
    '@/entities/loan-application': { useApplications: h.useApplications },
    '@/shared/api': { ApiError, useApiScope: () => h.scope, apiEmpty: async (url, options) => {
      h.events.push('POST')
      h.requests.push({ url, ...options })
      return reply(h.posts, `POST ${url}`)
    } },
    '@/shared/lib': { formatDate, formatMoney },
    '@/shared/ui': { Panel: panelComponent },
    './AcceptOffer.module.scss': { __esModule: true, default: styles },
  }, { Date: clock.Date, window: clock.window })
  h.render = (next = {}, markup = true) => {
    Object.assign(h.props, next)
    h.panel = hooks.render(AcceptOffer, h.props)
    if (markup) h.html = renderToStaticMarkup(h.panel)
    return h.panel
  }
  h.button = (label) => buttonIn(h.panel.props.footer, label)
  h.click = (label) => {
    const button = h.button(label)
    assert.ok(!button.props.disabled, `Button is disabled: ${label}`)
    button.props.onClick()
    h.render()
  }
  h.confirm = () => {
    h.click('Перейти к подписанию')
    assert.ok(h.html.includes('Проверьте условия перед подписанием'))
  }
  h.flush = async () => { await new Promise(setImmediate); h.render(); assert.deepEqual(unexpected, []) }
  h.settle = async () => { await Promise.all([...pending]); await h.flush() }
  h.setData = (data) => { Object.assign(h.query, { data, isPending: false, isError: false, error: null }); h.render() }
  h.dispose = () => hooks.dispose()
  if (autoRender) h.render()
  return h
}

function overview({ status = 'IN_REVIEW', provided = true, empty = false, failed = false, pending = false,
  applicationsFailed = false, applicationsPending = false, applicationOverride = {}, offerOverride = {},
  officerComment, aiComment, activeLoan = null, nextPayment = null, open = true, clock = createClock() } = {}) {
  const hooks = createHooks()
  const view = makeView({ status, applicationOverride, offerOverride, officerComment, aiComment })
  const accept = acceptance({ view, clock, autoRender: false, query: {
    data: applicationsPending ? undefined : [unrelated, view],
    isPending: applicationsPending, isError: applicationsFailed,
    error: applicationsFailed ? new Error('Не удалось обновить заявки') : null,
  } })
  let renderedSteps = []
  const ApplicationForm = () => null
  const AcceptOffer = (props) => accept.render(props, false)
  const h = { accept, view, ApplicationForm, AcceptOffer, scope: 'client-session' }
  const { ApplicationOverview } = load('widgets/application-overview/ui/ApplicationOverview/ApplicationOverview.tsx', {
    react: hooks.react,
    'react-router-dom': { useNavigate: () => () => {} },
    '@alfalab/core-components/button': { Button },
    '@alfalab/core-components/typography': { Typography },
    '@alfalab/core-components/steps': { Steps: (props) => {
      renderedSteps.push(props)
      return React.createElement('div', { 'data-steps': true }, props.children)
    } },
    '@alfalab/icons/glyph/dist/ArrowRightMIcon': { ArrowRightMIcon: () => null },
    '@alfalab/icons/glyph/dist/ClockMIcon': { ClockMIcon: () => null },
    '@/entities/dashboard': { useDashboard: () => ({
      isPending: pending, isError: failed, error: failed ? new Error('Ошибка загрузки') : null,
      data: { currentApplication: empty ? null : view, activeLoan, nextPayment, offer: unrelated.offer,
        stages: codes.slice(0, 4).map((code) => ({ code, state: 'DONE' })) },
    }) },
    '@/entities/loan-application': {
      getApplicationProgress,
      applicationStatusLabels: { IN_REVIEW: 'На рассмотрении', OFFER_READY: 'Предложение банка', ACCEPTED: 'Предложение принято', DECLINED: 'Отказ по заявке' },
      applicationDecisionLabels: { INFO_REQUIRED: 'Нужны дополнительные сведения', DECLINED: 'Отказ', APPROVED: 'Одобрено', ALTERNATIVE_OFFER: 'Предложены другие условия', MANUAL_REVIEW: 'Ручная проверка' },
      useApplications: accept.useApplications,
    },
    '@/features/accept-offer': { AcceptOffer },
    '@/features/submit-loan-application': { ApplicationForm },
    '@/shared/api': { useApiScope: () => h.scope },
    '@/shared/config': { ROUTES: { documents: '/documents', credits: '/credits' } },
    '@/shared/lib': { formatDate, formatMoney },
    '@/shared/ui': { Panel },
    './ApplicationOverview.module.scss': { __esModule: true, default: styles },
  }, { Date: clock.Date })
  h.render = () => {
    renderedSteps = []
    h.element = hooks.render(ApplicationOverview, { application: provided ? view : undefined })
    h.html = renderToStaticMarkup(h.element)
    h.renderedSteps = [...renderedSteps]
    h.summary = nodes(h.element, (child) => child.type === 'section')[0]
    h.summaryHtml = h.summary ? renderToStaticMarkup(h.summary) : ''
    h.panel = nodes(h.element, (child) => child.type === AcceptOffer).length
      ? accept.panel : nodes(h.element, (child) => child.type === Panel)[0]
    h.panelHtml = h.panel ? renderToStaticMarkup(h.panel) : ''
    return h.element
  }
  h.open = () => {
    const trigger = nodes(h.summary, (child) => child.type === Button && child.props.className === 'detailsButton')[0]
    assert.ok(trigger, 'Missing application details trigger')
    trigger.props.onClick()
    h.render()
  }
  h.render()
  if (open && h.panel) h.open()
  return h
}

test('all real statuses map to exactly six ordered product stages', () => {
  const states = {
    IN_REVIEW: ['DONE', 'CURRENT', 'PENDING', 'PENDING', 'PENDING', 'PENDING'],
    OFFER_READY: ['DONE', 'DONE', 'CURRENT', 'PENDING', 'PENDING', 'PENDING'],
    ACCEPTED: ['DONE', 'DONE', 'DONE', 'DONE', 'DONE', 'CURRENT'],
    DECLINED: ['DONE', 'DONE', 'CURRENT', 'PENDING', 'PENDING', 'PENDING'],
  }
  for (const [status, expected] of Object.entries(states)) {
    const result = getApplicationProgress(status)
    assert.deepEqual(Array.from(result, (stage) => stage.code), codes)
    assert.deepEqual(Array.from(result, (stage) => stage.title), titles)
    assert.deepEqual(Array.from(result, (stage) => stage.state), expected)
  }
})

test('progress does not share mutable results or mark issuance complete', () => {
  const first = getApplicationProgress('ACCEPTED')
  first[0].state = 'PENDING'
  const second = getApplicationProgress('ACCEPTED')
  assert.equal(second[0].state, 'DONE')
  assert.equal(second[5].state, 'CURRENT')
})

for (const status of ['IN_REVIEW', 'OFFER_READY', 'ACCEPTED', 'DECLINED']) {
  test(`${status} keeps six semantic stages and inert steppers in both hero and details`, () => {
    const { html, summaryHtml, panelHtml, renderedSteps } = overview({ status, failed: true })
    if (status === 'OFFER_READY') {
      assert.ok(summaryHtml.includes('Этап 3 из 6 · Статус · Ожидает выбора'))
      assert.ok(html.indexOf('Итоговая ставка') < html.indexOf('<details'))
    }
    for (const [section, visualCount] of [[summaryHtml, 2], [panelHtml, 1]]) {
      const lists = section.match(/<ol[^>]*aria-label="Ход заявки">[\s\S]*?<\/ol>/g) || []
      assert.equal(lists.length, 1)
      assert.equal((lists[0].match(/<li[ >]/g) || []).length, 6)
      assert.equal((lists[0].match(/aria-current="step"/g) || []).length, 1)
      assert.equal((section.match(/inert="" aria-hidden="true"/g) || []).length, visualCount)
      assert.equal((section.match(/data-steps="true"/g) || []).length, visualCount)
    }
    assert.equal(renderedSteps.length, 3)
    for (const props of renderedSteps) {
      assert.equal(React.Children.count(props.children), 6)
      assert.equal(props.interactive, false)
      assert.equal(props.isMarkCompletedSteps, false)
    }
    assert.ok(!html.includes('Загружаем этапы заявки'))
    assert.ok(html.includes(`${application.termDays} дней`))
    assert.ok(!html.includes('мес.'))
  })
}

test('decline is a negative decision, not waiting for an offer', () => {
  const { html, renderedSteps } = overview({ status: 'DECLINED', officerComment: null })
  assert.ok(html.includes('Статус: отказ по заявке'))
  assert.ok(html.includes('Предложение: не выполняется: заявка отклонена'))
  assert.ok(html.includes('Автоматический комментарий: Автоматическое заключение скоринга'))
  const manual = overview({ status: 'DECLINED', officerComment: 'Отказ сотрудника' })
  assert.ok(manual.html.includes('Отказ сотрудника'))
  assert.ok(!manual.html.includes('Автоматическое заключение скоринга'))
  assert.ok(!html.includes('Условия предложения пока недоступны'))
  for (const props of renderedSteps) {
    assert.equal(props.activeStep, 3)
    assert.equal(props.checkIsStepError(3), true)
    assert.equal(props.checkIsStepError(4), false)
  }
})

test('approved and alternative offers keep the current client-choice stage yellow in hero and details', () => {
  for (const decision of ['APPROVED', 'ALTERNATIVE_OFFER']) {
    const { html, summaryHtml, panelHtml, renderedSteps } = overview({
      status: 'OFFER_READY',
      applicationOverride: { decision, amount: 1500000 },
      offerOverride: { amount: 1500000, termDays: application.termDays },
    })
    assert.ok(summaryHtml.includes('class="status warning"'))
    assert.ok(summaryHtml.includes('class="pendingChoice">Этап 3 из 6 · Статус · Ожидает выбора'))
    assert.ok(summaryHtml.includes('Ждёт вашего решения'))
    for (const section of [summaryHtml, panelHtml]) {
      assert.ok(section.includes('class="pendingChoice">Статус'))
      assert.ok(section.includes('<li aria-current="step">Статус: ожидает вашего выбора</li>'))
      assert.ok(!section.includes('Статус: завершено'))
    }
    assert.ok(html.includes(decision === 'APPROVED' ? 'Сумма и срок соответствуют заявке' : 'Банк предложил другие условия'))
    for (const props of renderedSteps) {
      assert.equal(props.activeStep, 3)
      assert.equal(props.checkIsStepPositive(2), true)
      assert.equal(props.checkIsStepPositive(3), false)
      assert.equal(props.checkIsStepPositive(4), false)
      assert.equal(props.checkIsStepError(3), false)
    }
  }
  const css = readFileSync(path.join(root, 'widgets/application-overview/ui/ApplicationOverview/ApplicationOverview.module.scss'), 'utf8')
  assert.match(css, /\.warning,\s*\.pendingChoice\s*\{\s*background: var\(--color-light-status-muted-attention\)/)
})

test('cards, hero and details show the creation date separately from offer expiry', () => {
  for (const provided of [true, false]) {
    for (const status of ['IN_REVIEW', 'OFFER_READY', 'ACCEPTED', 'DECLINED']) {
      const { summaryHtml, panelHtml } = overview({ status, provided })
      assert.ok(summaryHtml.includes(status === 'OFFER_READY' ? 'Заявка создана' : 'Дата создания заявки'))
      for (const section of [summaryHtml, panelHtml]) {
        assert.ok(section.includes(`<time dateTime="${application.createdAt}">${formatDate(application.createdAt)}</time>`))
        if (status === 'OFFER_READY') {
          assert.ok(section.includes('Предложение действует до'))
          assert.ok(section.includes(`<time dateTime="${offer.validUntil}">${formatDate(offer.validUntil)}</time>`))
        }
      }
    }
  }
})

test('selected application officer comments stay prominent and separate from automated comments in every status', () => {
  const officerComment = '  Условия согласованы сотрудником.\n\nПроверьте документы.  '
  for (const provided of [true, false]) {
    for (const status of ['IN_REVIEW', 'OFFER_READY', 'ACCEPTED', 'DECLINED']) {
      const { html, summaryHtml, panelHtml } = overview({ status, provided, officerComment, applicationsFailed: true })
      for (const section of status === 'OFFER_READY' ? [panelHtml] : [summaryHtml, panelHtml]) {
        assert.ok(section.includes('Комментарий кредитного специалиста'))
        assert.ok(section.includes(`<p>${officerComment.trim()}</p>`))
      }
      if (status === 'OFFER_READY') assert.ok(!summaryHtml.includes(officerComment.trim()))
      assert.ok(!html.includes('Автоматическое заключение скоринга'))
      assert.ok(!html.includes('Комментарий другой заявки'))
    }
  }
  for (const officerComment of [null, ' \n ']) {
    const { html } = overview({ status: 'DECLINED', officerComment })
    assert.ok(!html.includes('<strong>Комментарий кредитного специалиста</strong>'))
    assert.ok(html.includes('Автоматический комментарий: Автоматическое заключение скоринга'))
  }
  const missing = overview({ status: 'DECLINED', officerComment: null, aiComment: ' ' })
  assert.ok(missing.html.includes('Причина отказа не указана.'))
})

test('application summaries never substitute root or base rates for linked offer terms', () => {
  for (const provided of [true, false]) {
    for (const status of ['IN_REVIEW', 'OFFER_READY', 'DECLINED']) {
      const { html, summaryHtml, panelHtml, accept } = overview({ status, provided, applicationOverride: { finalRate: 99.75 } })
      assert.ok(!summaryHtml.includes('%'))
      assert.ok(!summaryHtml.includes('Итоговая ставка'))
      assert.ok(!html.includes('Базовая ставка'))
      assert.doesNotMatch(html, /99[.,]75|24[.,]5%/)
      if (status === 'OFFER_READY') {
        assert.deepEqual(termsIn(accept.panel.props.children), expectedTerms())
      } else {
        assert.ok(!panelHtml.includes('%'))
        assert.ok(!panelHtml.includes('Итоговая ставка'))
      }
    }
    const missingOffer = overview({ status: 'OFFER_READY', provided, applicationOverride: { finalRate: 99.75 }, offerOverride: null })
    assert.ok(!missingOffer.html.includes('%'))
  }
})

test('signed application rate comes only from its offer, never from the nullable root rate', () => {
  for (const finalRate of [null, 99.75]) {
    const { html, accept } = overview({ status: 'ACCEPTED', applicationOverride: { finalRate } })
    assert.deepEqual(termsIn(accept.panel.props.children), expectedTerms())
    assert.doesNotMatch(html, /99[.,]75|24[.,]5%/)
    const missingOffer = overview({ status: 'ACCEPTED', applicationOverride: { finalRate }, offerOverride: null })
    assert.ok(!missingOffer.html.includes('%'))
  }
})

test('an accepted application awaits issuance even with an unrelated dashboard loan', () => {
  const { html, renderedSteps } = overview({ status: 'ACCEPTED', activeLoan: { id: 99 } })
  assert.ok(html.includes('Выдача: ожидает выдачи'))
  assert.ok(html.includes('Ожидаем подтверждения выдачи. Деньги ещё не зачислены'))
  assert.doesNotMatch(html, /Выдача: завершено|Кредит выдан|Деньги у вас/)
  for (const props of renderedSteps) {
    assert.equal(props.activeStep, 6)
    assert.equal(props.checkIsStepPositive(5), true)
    assert.equal(props.checkIsStepPositive(6), false)
  }
})

test('active loan retains its own ratePercent and termMonths', () => {
  const { html } = overview({
    provided: false, status: 'ACCEPTED',
    activeLoan: { id: 99, remainingBalance: 70000, principal: 100000, monthlyPayment: 5000, ratePercent: 18.5, termMonths: 24 },
  })
  assert.ok(html.includes('Ставка 18.5% годовых · Срок: 24 мес.'))
  assert.ok(!html.includes('Итоговая ставка'))
  assert.ok(html.includes(formatMoney(70000)))
})

test('no-application hero composes the public form directly with an h2 heading', () => {
  const { element, ApplicationForm } = overview({ provided: false, empty: true })
  assert.equal(element.type, ApplicationForm)
  assert.equal(element.props.headingTag, 'h2')
})

test('formatMoney keeps whole-ruble defaults and preserves kopecks only in exact mode', () => {
  const spaces = (value) => value.replace(/[\u00a0\u202f]/g, ' ')
  for (const [amount, whole, exact] of [
    [48735.62, '48 736 ₽', '48 735,62 ₽'],
    [100000.01, '100 000 ₽', '100 000,01 ₽'],
    [90000, '90 000 ₽', '90 000 ₽'],
    [0, '0 ₽', '0 ₽'],
  ]) {
    assert.equal(spaces(formatMoney(amount)), whole)
    assert.equal(spaces(formatMoney(amount, { exact: false })), whole)
    assert.equal(spaces(formatMoney(amount, { exact: true })), exact)
  }
})

test('urgent loan payments retain priority through the seventh local calendar day', () => {
  const activeLoan = { id: 99, remainingBalance: 70000, principal: 100000, monthlyPayment: 5000, ratePercent: 18.5, termMonths: 24 }
  for (const [dueDate, urgent] of [['2026-10-22', true], ['2026-10-30', true], ['2026-10-31', false]]) {
    const h = overview({ provided: false, status: 'OFFER_READY', activeLoan, open: false,
      nextPayment: { amount: 5000, dueDate } })
    assert.equal(h.summaryHtml.includes('Действующий кредит'), urgent)
    assert.equal(h.summaryHtml.includes('Посмотреть предложение'), !urgent)
    if (urgent) assert.ok(h.html.includes(formatDate(dueDate)))
    if (dueDate === '2026-10-22') assert.ok(h.html.includes('Дата платежа прошла'))
    if (dueDate === '2026-10-30') assert.ok(h.html.includes('в ближайшие 7 дней'))
  }
})

for (const finalRate of [25.25, 0]) {
  test(`linked rate ${finalRate} is hidden on the main card and visible in terms and confirmation`, () => {
    for (const provided of [true, false]) {
      const h = overview({ status: 'OFFER_READY', provided, open: false,
        applicationOverride: { finalRate: 99.75 }, offerOverride: { finalRate } })
      assert.ok(!h.summaryHtml.includes('Итоговая ставка'))
      assert.ok(!h.summaryHtml.includes('%'))
      assert.ok(h.summaryHtml.includes(formatMoney(offer.amount, { exact: true })))
      assert.ok(!h.summaryHtml.includes(formatMoney(application.amount)))
      assert.ok(!h.html.includes('<aside>'))
      h.open()
      assert.deepEqual(termsIn(h.accept.panel.props.children), expectedTerms(h.view.offer))
      assert.deepEqual(h.accept.events, [])
      h.accept.confirm()
      assert.deepEqual(termsIn(h.accept.panel.props.children), expectedTerms(h.view.offer))
      assert.deepEqual(h.accept.events, [])
      assert.equal(h.accept.mutations[0].calls.length, 0)
    }
  })
}

test('comments retain all paragraphs outside technical details in both screens', () => {
  const officerComment = '  Первая строка.\nВторая строка.\n\nОтдельный абзац <без HTML>.  '
  const h = acceptance({ view: makeView({ officerComment }) })
  for (const confirm of [false, true]) {
    if (confirm) h.confirm()
    const comments = nodes(h.panel.props.children, (child) => child.type === 'section' && child.props.className === 'comment')
    assert.equal(comments.length, 1)
    assert.equal(content(nodes(comments[0], (child) => child.type === 'p')[0]), officerComment.trim())
    assert.ok(h.html.includes('Отдельный абзац &lt;без HTML&gt;'))
    assert.ok(h.html.indexOf('Комментарий кредитного специалиста') < h.html.indexOf('<details'))
    assert.ok(!h.html.includes('Комментарий другой заявки'))
    assert.ok(!h.html.includes('Автоматическое заключение'))
  }
  const css = readFileSync(path.join(root, 'features/accept-offer/ui/AcceptOffer/AcceptOffer.module.scss'), 'utf8')
  assert.match(css, /\.comment p\s*\{[^}]*white-space:\s*pre-wrap/)
  for (const officerComment of [null, ' \n ']) {
    const empty = acceptance({ view: makeView({ officerComment }) })
    assert.ok(!empty.html.includes('Комментарий кредитного специалиста'))
    empty.confirm()
    assert.ok(!empty.html.includes('Комментарий кредитного специалиста'))
  }
})

for (const [name, changes] of [
  ['amount', { amount: 90000.05, termDays: application.termDays }],
  ['term', { amount: application.amount, termDays: 90 }],
  ['amount and term', { amount: 90000.05, termDays: 90 }],
]) {
  test(`comparison honestly shows changed ${name} without inventing a previous final rate`, () => {
    const h = overview({ status: 'OFFER_READY', offerOverride: changes })
    const comparison = nodes(h.accept.panel.props.children, (child) => child.props.className === 'comparison')[0]
    assert.ok(comparison)
    const value = content(comparison)
    const amountChanged = changes.amount !== application.amount
    const termChanged = changes.termDays !== application.termDays
    assert.equal(value.includes(`Запрашивали ${formatMoney(application.amount, { exact: true })}`), amountChanged)
    assert.equal(value.includes(`Банк предлагает ${formatMoney(changes.amount, { exact: true })}`), amountChanged)
    assert.equal(value.includes(`Запрошенный срок: ${application.termDays} дней`), termChanged)
    assert.equal(value.includes(`Банк предлагает: ${changes.termDays} дней`), termChanged)
    assert.ok(h.summaryHtml.includes('отличаются от заявки') || h.summaryHtml.includes('отличается от заявки'))
    assert.doesNotMatch(value, /выгодн|эконом|все условия|ставк|24[.,]5/i)
  })
}

test('equal amount and term do not disguise an alternative offer as identical conditions', () => {
  for (const decision of ['APPROVED', 'ALTERNATIVE_OFFER']) {
    const h = overview({ status: 'OFFER_READY', applicationOverride: { decision },
      offerOverride: { amount: application.amount, termDays: application.termDays } })
    const comparison = content(nodes(h.accept.panel.props.children, (child) => child.props.className === 'comparison')[0])
    assert.equal(comparison.includes('Банк предложил другие условия. Сумма и срок сохранены; проверьте итоговую ставку'), decision === 'ALTERNATIVE_OFFER')
    assert.equal(comparison.includes('Сумма и срок соответствуют заявке'), decision === 'APPROVED')
    assert.doesNotMatch(comparison, /все условия|полностью совпадают|выгоднее/i)
  }
})

for (const state of ['loading', 'missing', 'error']) {
  test(`${state} conditions never use requested or unrelated amounts as an offer`, () => {
    const h = acceptance({ view: makeView({ offerOverride: null }), query: {
      ...(state === 'loading' ? { data: undefined, isPending: true } : {}),
      ...(state === 'error' ? { isError: true, error: new Error('Сеть недоступна') } : {}),
    } })
    assert.equal(h.button('Перейти к подписанию').props.disabled, true)
    assert.equal(nodes(h.panel.props.children, (child) => child.props.className === 'terms').length, 0)
    assert.ok(!h.html.includes(formatMoney(application.amount)))
    assert.ok(!h.html.includes(formatMoney(unrelated.offer.amount, { exact: true })))
    assert.ok(!h.html.includes('%'))
    assert.ok(h.html.includes(state === 'loading' ? 'Загружаем условия предложения' : 'Условия предложения пока недоступны'))
    if (state === 'loading') {
      assert.ok(h.html.includes('aria-busy="true"'))
      assert.ok(h.html.includes('class="skeleton" aria-hidden="true"'))
    }
    if (state === 'error') assert.ok(h.html.includes('role="alert"'))
    assert.deepEqual(h.events, [])
    const hero = overview({ status: 'OFFER_READY', provided: false, offerOverride: null,
      applicationsPending: state === 'loading', applicationsFailed: state === 'error' })
    assert.ok(!hero.summaryHtml.includes(formatMoney(application.amount)))
    assert.ok(!hero.summaryHtml.includes(formatMoney(unrelated.offer.amount, { exact: true })))
    assert.ok(!hero.summaryHtml.includes('Банк предлагает'))
  })
}

test('cached terms remain readable after GET errors, but signing stays disabled', () => {
  const h = acceptance({ query: { isError: true, error: new Error('Не удалось обновить заявки') } })
  assert.deepEqual(termsIn(h.panel.props.children), expectedTerms())
  assert.equal(h.button('Перейти к подписанию').props.disabled, true)
  assert.ok(!h.button('Обновить данные').props.disabled)
  assert.ok(h.html.includes('Не удалось обновить заявки'))
  assert.deepEqual(h.events, [])
})

test('loading and failed dashboards do not render a fake ready-offer hero', () => {
  for (const pending of [true, false]) {
    const h = overview({ provided: false, status: 'OFFER_READY', pending, failed: !pending })
    assert.ok(h.html.includes(pending ? 'Загружаем данные' : 'Ошибка загрузки'))
    assert.ok(h.html.includes(pending ? 'aria-busy="true"' : 'role="alert"'))
    assert.ok(!h.html.includes('Банк предлагает'))
    assert.ok(!h.html.includes(formatMoney(offer.amount)))
    assert.equal(h.panel, undefined)
  }
})

test('one keyed AcceptOffer owns Panel, content, footer and the trigger focus ref', () => {
  const h = overview({ status: 'OFFER_READY', open: false })
  const owners = nodes(h.element, (child) => child.type === h.AcceptOffer)
  assert.equal(owners.length, 1)
  assert.equal(owners[0].key, `${h.scope}-${application.id}`)
  assert.equal(nodes(h.element, (child) => child.type === Panel).length, 0)
  const trigger = buttonIn(h.summary, 'Посмотреть предложение')
  assert.equal(owners[0].props.returnFocusRef, trigger.props.ref)
  h.open()
  assert.equal(h.accept.panel.type, Panel)
  assert.equal(h.accept.panel.props.returnFocusRef, trigger.props.ref)
  assert.equal(h.accept.mutations.length, 1)
  for (const label of ['Перейти к подписанию', 'Подтвердить подписание']) {
    const primary = h.accept.button(label)
    assert.equal(primary.props.view, 'primary')
    assert.equal(primary.props.block, true)
    assert.equal(nodes(h.accept.panel.props.children, (child) => child.type === Button).length, 0)
    const hint = primary.props['aria-describedby']
    assert.equal(nodes(h.accept.panel.props.footer, (child) => child.props.id === hint).length, 1)
    if (label === 'Перейти к подписанию') h.accept.confirm()
  }
  assert.deepEqual(h.accept.events, [])
})

test('return and close are local actions, and reopening starts at terms', () => {
  const h = acceptance()
  h.confirm()
  h.click('Вернуться к условиям')
  assert.ok(!h.html.includes('Проверьте условия перед подписанием'))
  assert.deepEqual(termsIn(h.panel.props.children), expectedTerms())
  h.confirm()
  h.panel.props.onClose()
  assert.equal(h.closes, 1)
  h.render({ open: false })
  assert.equal(h.html, '')
  h.render({ open: true })
  assert.ok(!h.html.includes('Проверьте условия перед подписанием'))
  h.click('Не сейчас')
  assert.equal(h.closes, 2)
  assert.deepEqual(h.events, [])
})

test('explicit confirmation awaits preflight and sends one POST even on a double click', async () => {
  const get = deferred()
  const post = deferred()
  const h = acceptance({ refetches: [get.promise], posts: [post.promise], scope: 'company-7-session-4' })
  assert.equal(h.mutations[0].options.retry, false)
  h.confirm()
  assert.deepEqual(h.events, [])
  const confirm = h.button('Подтвердить подписание')
  confirm.props.onClick()
  confirm.props.onClick()
  h.panel.props.onClose()
  assert.equal(h.closes, 0)
  h.render()
  assert.equal(h.mutations[0].calls.length, 1)
  assert.equal(h.panel.props.dismissible, false)
  assert.equal(h.button('Подтверждаем условия…').props.loading, true)
  assert.equal(h.button('Подтверждаем условия…').props.disabled, true)
  assert.equal(h.button('Вернуться к условиям').props.disabled, true)
  assert.equal(h.panel.props.footer.props['aria-busy'], true)
  await h.flush()
  assert.deepEqual(h.events, ['GET'])
  assert.equal(h.refetchCalls[0].throwOnError, true)
  get.resolve([unrelated, h.view])
  await h.flush()
  assert.deepEqual(h.events, ['GET', 'POST'])
  assert.deepEqual(h.requests, [{ url: '/api/offers/9/sign', method: 'POST' }])
  h.panel.props.onClose()
  assert.equal(h.closes, 0)
  assert.ok(!h.html.includes('Условия приняты'))
  post.resolve()
  await h.settle()
  assert.ok(h.html.includes('Условия приняты'))
  assert.ok(h.html.includes('Ожидаем подтверждения выдачи. Деньги ещё не зачислены'))
  assert.doesNotMatch(h.html, /Кредит выдан|Деньги у вас/)
  assert.deepEqual(termsIn(h.panel.props.children), expectedTerms())
  assert.deepEqual(h.invalidations, [['client', 'company-7-session-4']])
  assert.equal(h.panel.props.dismissible, true)
  assert.equal(nodes(h.panel.props.footer, (child) => child.type === Button).length, 1)
  h.click('К заявке')
  assert.equal(h.closes, 1)
  assert.equal(h.requests.length, 1)
})

test('shared Panel keeps sticky actions separate from responsive content and cannot recreate the mutation', async () => {
  let viewport = 'desktop'
  const SidePanel = ({ open, children }) => open ? React.createElement('aside', { 'data-viewport': viewport },
    React.createElement(viewport === 'desktop' ? 'section' : 'article', { key: viewport }, children),
  ) : null
  SidePanel.Header = () => null
  SidePanel.Content = ({ children }) => React.createElement('main', null, children)
  SidePanel.Footer = ({ children }) => React.createElement('footer', null, children)
  const { Panel: RealPanel } = load('shared/ui/Panel/Panel.tsx', {
    react: { ...React, useId: () => 'panel-title' },
    '@alfalab/core-components/side-panel': { SidePanel },
    '@alfalab/icons/glyph/dist/CrossMIcon': { CrossMIcon: () => null },
    './Panel.module.scss': { __esModule: true, default: styles },
  })
  const post = deferred()
  const view = makeView()
  const h = acceptance({ view, panelComponent: RealPanel, refetches: [[unrelated, view]], posts: [post.promise] })
  assert.equal(h.panel.type, RealPanel)
  h.confirm()
  viewport = 'mobile'
  h.render()
  assert.ok(h.html.includes('data-viewport="mobile"'))
  const confirm = h.button('Подтвердить подписание')
  confirm.props.onClick()
  await h.flush()
  for (const width of ['desktop', 'mobile', 'desktop']) {
    viewport = width
    h.render()
    const shell = RealPanel(h.panel.props)
    assert.equal(shell.type, SidePanel)
    assert.equal(shell.props.disableEscapeKeyDown, true)
    assert.equal(shell.props.disableBackdropClick, true)
    const footer = nodes(shell, (child) => child.type === SidePanel.Footer)
    assert.equal(footer.length, 1)
    assert.equal(footer[0].props.sticky, true)
    assert.equal(footer[0].props.children, h.panel.props.footer)
    assert.equal(nodes(shell, (child) => child.type === SidePanel.Content)[0].props.children, h.panel.props.children)
    assert.equal(nodes(shell, (child) => child.type === SidePanel.Header)[0].props.hasCloser, false)
    shell.props.onClose()
    confirm.props.onClick()
    assert.equal(h.closes, 0)
    assert.equal(h.mutations.length, 1)
    assert.equal(h.mutations[0].calls.length, 1)
    assert.equal(h.requests.length, 1)
  }
  post.resolve()
  await h.settle()
  assert.ok(h.html.includes('Условия приняты'))
})

for (const [name, offerOverride] of [
  ['server-expired', { status: 'EXPIRED' }],
  ['past deadline', { validUntil: '2026-10-22' }],
]) {
  test(`${name} offers remain readable but cannot be signed`, () => {
    const view = makeView({ offerOverride })
    const h = acceptance({ view })
    assert.deepEqual(termsIn(h.panel.props.children), expectedTerms(view.offer))
    assert.equal(h.button('Перейти к подписанию').props.disabled, true)
    assert.ok(h.html.includes('Срок предложения истёк'))
    assert.ok(h.html.includes('Условия можно прочитать, но подписание недоступно'))
    assert.ok(h.html.includes(formatDate(view.offer.validUntil)))
    assert.deepEqual(h.events, [])
  })
}

test('validUntil includes its local calendar day and the expiry timer disables confirmation at midnight', () => {
  const clock = createClock('2026-10-23T23:59:59.999')
  const h = acceptance({ clock, view: makeView({ offerOverride: { validUntil: '2026-10-23' } }) })
  assert.equal(clock.timers.size, 1)
  assert.equal([...clock.timers.values()][0].delay, 1)
  h.confirm()
  assert.ok(!h.button('Подтвердить подписание').props.disabled)
  clock.advanceTo('2026-10-24T00:00:00')
  h.render()
  assert.equal(h.button('Перейти к подписанию').props.disabled, true)
  assert.ok(h.html.includes('Срок предложения истёк'))
  assert.deepEqual(h.events, [])
})

test('an old click handler cannot sign after time advances without a render', () => {
  const clock = createClock('2026-10-23T23:59:59')
  const h = acceptance({ clock, view: makeView({ offerOverride: { validUntil: '2026-10-23' } }) })
  h.confirm()
  const stale = h.button('Подтвердить подписание')
  clock.set('2026-10-24T00:00:01')
  stale.props.onClick()
  h.render()
  assert.deepEqual(h.events, [])
  assert.equal(h.mutations[0].calls.length, 0)
  assert.equal(h.button('Перейти к подписанию').props.disabled, true)
})

test('expiration during the mandatory GET blocks POST even when the returned version is unchanged', async () => {
  const get = deferred()
  const clock = createClock('2026-10-23T23:59:59')
  const h = acceptance({ clock, view: makeView({ offerOverride: { validUntil: '2026-10-23' } }), refetches: [get.promise] })
  h.confirm()
  h.click('Подтвердить подписание')
  await h.flush()
  clock.set('2026-10-24T00:00:00')
  get.resolve([unrelated, h.view])
  await h.settle()
  assert.deepEqual(h.events, ['GET'])
  assert.equal(h.requests.length, 0)
  assert.equal(h.mutations[0].state.data.kind, 'review')
  assert.ok(h.html.includes('Предложение недоступно для подписания'))
})

test('long expiry timers are capped and cleaned up on close and unmount', () => {
  const h = acceptance()
  assert.equal([...h.clock.timers.values()][0].delay, 2_147_483_647)
  h.render({ open: false })
  assert.equal(h.clock.timers.size, 0)
  h.render({ open: true })
  assert.equal(h.clock.timers.size, 1)
  h.dispose()
  assert.equal(h.clock.timers.size, 0)
})

const changedTerms = [
  ['id', { offerOverride: { id: 10 } }],
  ['amount', { offerOverride: { amount: 89999.99 } }],
  ['termDays', { offerOverride: { termDays: 90 } }],
  ['finalRate', { offerOverride: { finalRate: 0 } }],
  ['monthlyPayment', { offerOverride: { monthlyPayment: 48735.63 } }],
  ['validUntil', { offerOverride: { validUntil: '2099-12-30' } }],
  ['officerComment', { officerComment: 'Обновлённые условия.\n\nНужен дополнительный документ.' }],
]

for (const [field, changes] of changedTerms) {
  test(`a cached ${field} change resets confirmation without sending any request`, () => {
    const h = acceptance()
    h.confirm()
    const next = makeView(changes)
    h.setData([unrelated, next])
    assert.ok(!h.html.includes('Проверьте условия перед подписанием'))
    assert.ok(h.html.includes('Предложение обновилось. Проверьте условия ещё раз'))
    assert.deepEqual(termsIn(h.panel.props.children), expectedTerms(next.offer))
    assert.equal(h.button('Перейти к подписанию').props.view, 'primary')
    assert.deepEqual(h.events, [])
    h.confirm()
    assert.deepEqual(termsIn(h.panel.props.children), expectedTerms(next.offer))
    assert.deepEqual(h.events, [])
  })

  test(`preflight blocks ${field === 'id' ? 'a replaced linked offer' : `a same-id ${field} edit`} before any POST`, async () => {
    const next = makeView(changes)
    const h = acceptance({ refetches: [[unrelated, next]] })
    h.confirm()
    h.click('Подтвердить подписание')
    await h.settle()
    assert.equal(h.refetchCalls.length, 1)
    assert.equal(h.refetchCalls[0].throwOnError, true)
    assert.deepEqual(h.events, ['GET'])
    assert.equal(h.requests.length, 0)
    assert.ok(h.html.includes('Предложение обновилось. Проверьте условия ещё раз'))
    assert.ok(!h.html.includes('Проверьте условия перед подписанием'))
    assert.deepEqual(termsIn(h.panel.props.children), expectedTerms(next.offer))
    assert.deepEqual(h.invalidations, [])
    assert.equal(h.panel.props.dismissible, true)
  })
}

test('new object identities and surrounding comment whitespace do not invalidate unchanged terms', async () => {
  const view = makeView({ officerComment: 'Проверьте документы' })
  const next = makeView({ officerComment: ' \nПроверьте документы\n ' })
  const h = acceptance({ view, refetches: [[unrelated, next]], posts: [undefined] })
  h.confirm()
  h.setData([unrelated, next])
  assert.ok(h.html.includes('Проверьте условия перед подписанием'))
  h.click('Подтвердить подписание')
  await h.settle()
  assert.deepEqual(h.events, ['GET', 'POST'])
  assert.ok(h.html.includes('Условия приняты'))
})

test('an updated offer can only be signed after reviewing and explicitly confirming its new version', async () => {
  const next = makeView({ offerOverride: { id: 10, amount: 75000, finalRate: 0 }, officerComment: 'Новые условия' })
  const h = acceptance({ refetches: [[unrelated, next], [unrelated, next]], posts: [undefined] })
  h.confirm()
  h.click('Подтвердить подписание')
  await h.settle()
  assert.equal(h.requests.length, 0)
  h.confirm()
  assert.deepEqual(h.events, ['GET'])
  h.click('Подтвердить подписание')
  await h.settle()
  assert.deepEqual(h.events, ['GET', 'GET', 'POST'])
  assert.deepEqual(h.requests, [{ url: '/api/offers/10/sign', method: 'POST' }])
  assert.deepEqual(termsIn(h.panel.props.children), expectedTerms(next.offer))
})

for (const [name, next] of [
  ['application in review', makeView({ status: 'IN_REVIEW' })],
  ['application declined', makeView({ status: 'DECLINED' })],
  ['offer expired', makeView({ offerOverride: { status: 'EXPIRED' } })],
  ['linked offer removed', makeView({ offerOverride: null })],
]) {
  test(`preflight blocks signing when ${name}`, async () => {
    const h = acceptance({ refetches: [[unrelated, next]] })
    h.confirm()
    h.click('Подтвердить подписание')
    await h.settle()
    assert.deepEqual(h.events, ['GET'])
    assert.equal(h.requests.length, 0)
    assert.equal(h.button('Перейти к подписанию').props.disabled, true)
    assert.equal(h.mutations[0].state.data.kind, 'review')
    assert.ok(!h.html.includes('Условия приняты'))
  })
}

for (const [name, changes] of [
  ['application', { applicationOverride: { status: 'ACCEPTED' } }],
  ['offer', { offerOverride: { status: 'ACCEPTED' } }],
]) {
  test(`an already accepted ${name} is never signed again, including when discovered by preflight`, async () => {
    const next = makeView(changes)
    const accepted = acceptance({ view: next })
    assert.ok(accepted.html.includes('Условия приняты'))
    assert.equal(nodes(accepted.panel.props.footer, (child) => child.type === Button).length, 1)
    assert.equal(content(accepted.button('К заявке')), 'К заявке')
    assert.deepEqual(accepted.events, [])
    const h = acceptance({ refetches: [[unrelated, next]] })
    h.confirm()
    h.click('Подтвердить подписание')
    await h.settle()
    assert.deepEqual(h.events, ['GET'])
    assert.ok(h.html.includes('Условия приняты'))
    assert.ok(h.html.includes('Деньги ещё не зачислены'))
    assert.deepEqual(h.invalidations, [['client', h.scope]])
  })
}

test('a provided or first-array unrelated offer cannot be signed without the matching application', async () => {
  const h = acceptance({ props: { offer: unrelated.offer }, query: { data: [unrelated] }, refetches: [[unrelated]] })
  h.confirm()
  h.click('Подтвердить подписание')
  await h.settle()
  assert.deepEqual(h.events, ['GET'])
  assert.equal(h.requests.length, 0)
  assert.ok(h.html.includes('Не удалось получить актуальную заявку'))
  assert.ok(!h.html.includes('Условия приняты'))
  assert.deepEqual(h.invalidations, [])
})

test('the matching application wins over stale props and an unrelated accepted offer', async () => {
  const view = makeView()
  const other = { ...unrelated, status: 'ACCEPTED', offer: { ...unrelated.offer, status: 'ACCEPTED' } }
  const h = acceptance({ view, props: { offer: other.offer, officerComment: other.officerComment },
    query: { data: [other, view] }, refetches: [[other, view]], posts: [undefined] })
  assert.deepEqual(termsIn(h.panel.props.children), expectedTerms(view.offer))
  assert.ok(!h.html.includes(other.officerComment))
  assert.ok(!h.html.includes('Условия приняты'))
  h.confirm()
  h.click('Подтвердить подписание')
  await h.settle()
  assert.deepEqual(h.requests, [{ url: '/api/offers/9/sign', method: 'POST' }])
})

test('a matching application with no offer must not fall back to provided offer props', () => {
  const h = acceptance({ query: { data: [unrelated, makeView({ offerOverride: null })] }, props: { offer: unrelated.offer } })
  assert.equal(h.button('Перейти к подписанию').props.disabled, true)
  assert.ok(h.html.includes('Условия предложения пока недоступны'))
  assert.equal(nodes(h.panel.props.children, (child) => child.props.className === 'terms').length, 0)
  assert.deepEqual(h.events, [])
})

test('preflight GET failure shows an error without sending POST and unlocks status refresh', async () => {
  const h = acceptance({ refetches: [new Error('GET недоступен')] })
  h.confirm()
  h.click('Подтвердить подписание')
  await h.settle()
  assert.deepEqual(h.events, ['GET'])
  assert.equal(h.requests.length, 0)
  assert.ok(h.html.includes('role="alert"'))
  assert.ok(h.html.includes('Подписание не отправлено'))
  assert.ok(h.html.includes('GET недоступен'))
  assert.ok(!h.html.includes('Условия приняты'))
  assert.equal(h.button('Перейти к подписанию').props.disabled, true)
  h.refetches.push([unrelated, h.view])
  h.click('Обновить данные')
  await h.settle()
  assert.deepEqual(h.events, ['GET', 'GET'])
  assert.ok(!h.html.includes('Проверьте условия перед подписанием'))
  assert.ok(!h.button('Перейти к подписанию').props.disabled)
})

for (const [name, changes] of [
  ['application', { applicationOverride: { status: 'ACCEPTED' } }],
  ['offer', { offerOverride: { status: 'ACCEPTED' } }],
]) {
  test(`POST failure followed by an accepted ${name} recovers success without a second POST`, async () => {
    const view = makeView()
    const h = acceptance({ view, refetches: [[unrelated, view], [unrelated, makeView(changes)]], posts: [new Error('Ответ потерян')] })
    h.confirm()
    h.click('Подтвердить подписание')
    await h.settle()
    assert.deepEqual(h.events, ['GET', 'POST', 'GET'])
    assert.equal(h.requests.length, 1)
    assert.ok(h.refetchCalls.every((options) => options.throwOnError === true))
    assert.ok(h.html.includes('Условия приняты'))
    assert.ok(h.html.includes('Деньги ещё не зачислены'))
    assert.deepEqual(h.invalidations, [['client', h.scope]])
    assert.deepEqual(termsIn(h.panel.props.children), expectedTerms())
    assert.equal(content(h.button('К заявке')), 'К заявке')
    await h.flush()
    assert.equal(h.requests.length, 1)
  })
}

test('POST failure with an active offer returns to terms and a retry requires two new explicit clicks', async () => {
  const view = makeView()
  const h = acceptance({ view, refetches: [[unrelated, view], [unrelated, view]], posts: [new Error('Ответ потерян')] })
  h.confirm()
  h.click('Подтвердить подписание')
  await h.settle()
  assert.deepEqual(h.events, ['GET', 'POST', 'GET'])
  assert.ok(!h.html.includes('Проверьте условия перед подписанием'))
  assert.ok(h.html.includes('Сервер пока не подтвердил принятие условий'))
  assert.ok(!h.html.includes('Подписание не отправлено'))
  assert.ok(!h.html.includes('Условия приняты'))
  assert.deepEqual(h.invalidations, [])
  h.confirm()
  assert.equal(h.requests.length, 1)
  assert.equal(h.refetchCalls.length, 2)
  h.refetches.push([unrelated, view])
  h.posts.push(undefined)
  h.click('Подтвердить подписание')
  await h.settle()
  assert.deepEqual(h.events, ['GET', 'POST', 'GET', 'GET', 'POST'])
  assert.equal(h.requests.length, 2)
  assert.ok(h.html.includes('Условия приняты'))
})

test('a pending recovery GET after POST failure keeps the mutation locked until the outcome is known', async () => {
  const view = makeView()
  const recovery = deferred()
  const h = acceptance({ view, refetches: [[unrelated, view], recovery.promise], posts: [new Error('Ответ POST потерян')] })
  h.confirm()
  const confirm = h.button('Подтвердить подписание')
  h.click('Подтвердить подписание')
  await h.flush()
  assert.deepEqual(h.events, ['GET', 'POST', 'GET'])
  assert.equal(h.panel.props.dismissible, false)
  assert.equal(h.button('Подтверждаем условия…').props.disabled, true)
  assert.equal(h.button('Подтверждаем условия…').props.loading, true)
  assert.ok(!h.html.includes('Условия приняты'))
  assert.ok(!h.html.includes('Подписание не отправлено'))
  confirm.props.onClick()
  h.panel.props.onClose()
  assert.equal(h.closes, 0)
  assert.equal(h.mutations[0].calls.length, 1)
  assert.equal(h.requests.length, 1)
  recovery.resolve([unrelated, view])
  await h.settle()
  assert.ok(!h.button('Перейти к подписанию').props.disabled)
  assert.equal(h.panel.props.dismissible, true)
  assert.equal(h.requests.length, 1)
})

function assertUnknown(h) {
  assert.ok(h.html.includes('Не удалось проверить результат подписания'))
  assert.ok(!h.html.includes('Подписание не отправлено'))
  assert.ok(!h.html.includes('Условия приняты'))
  const actions = nodes(h.panel.props.footer, (child) => child.type === Button)
  assert.deepEqual(actions.map(content), ['Проверить статус заявки', 'Не сейчас'])
  assert.equal(actions[0].props.view, 'primary')
  assert.deepEqual(h.invalidations, [])
}

test('unknown outcome survives another failing refresh, cache updates and close/reopen without automatic signing', async () => {
  const view = makeView()
  const status = deferred()
  const h = acceptance({ view, refetches: [[unrelated, view], new Error('Проверка недоступна'), status.promise], posts: [new Error('Ответ POST потерян')] })
  h.confirm()
  h.click('Подтвердить подписание')
  await h.settle()
  assert.deepEqual(h.events, ['GET', 'POST', 'GET'])
  assertUnknown(h)
  const check = h.button('Проверить статус заявки')
  check.props.onClick()
  check.props.onClick()
  await h.flush()
  assertUnknown(h)
  assert.equal(h.button('Проверить статус заявки').props.disabled, true)
  assert.equal(h.button('Проверить статус заявки').props.loading, true)
  assert.equal(h.panel.props.dismissible, false)
  assert.equal(h.mutations[0].state.data, undefined)
  status.reject(new Error('Повторный GET недоступен'))
  await h.settle()
  assertUnknown(h)
  assert.ok(h.html.includes('role="alert"'))
  assert.ok(h.html.includes('Повторный GET недоступен'))
  assert.equal(h.mutations[0].state.status, 'error')
  h.setData([unrelated, makeView({ offerOverride: { monthlyPayment: 40000 } })])
  assertUnknown(h)
  h.click('Не сейчас')
  assert.equal(h.closes, 1)
  h.render({ open: false })
  h.render({ open: true })
  assertUnknown(h)
  await h.flush()
  assert.deepEqual(h.events, ['GET', 'POST', 'GET', 'GET'])
  assert.equal(h.requests.length, 1)
  assert.equal(h.mutations[0].options.retry, false)
})

for (const accepted of [false, true]) {
  test(`explicit status check resolves unknown to ${accepted ? 'accepted' : 'terms'}, never another POST`, async () => {
    const view = makeView()
    const next = accepted ? makeView({ status: 'ACCEPTED' }) : view
    const h = acceptance({ view, refetches: [[unrelated, view], new Error('GET недоступен'), [unrelated, next]], posts: [new Error('Ответ потерян')] })
    h.confirm()
    h.click('Подтвердить подписание')
    await h.settle()
    assertUnknown(h)
    h.click('Проверить статус заявки')
    await h.settle()
    assert.deepEqual(h.events, ['GET', 'POST', 'GET', 'GET'])
    assert.equal(h.requests.length, 1)
    assert.equal(h.html.includes('Условия приняты'), accepted)
    assert.ok(!h.html.includes('Не удалось проверить результат подписания'))
    assert.ok(!h.html.includes('Проверьте условия перед подписанием'))
    assert.equal(content(h.button(accepted ? 'К заявке' : 'Перейти к подписанию')), accepted ? 'К заявке' : 'Перейти к подписанию')
    await h.flush()
    assert.equal(h.requests.length, 1)
  })
}

test('an unknown outcome stays unknown if a later successful GET omits the related application', async () => {
  const view = makeView()
  const h = acceptance({ view, refetches: [[unrelated, view], new Error('GET недоступен'), [unrelated]], posts: [new Error('Ответ потерян')] })
  h.confirm()
  h.click('Подтвердить подписание')
  await h.settle()
  h.click('Проверить статус заявки')
  await h.settle()
  assertUnknown(h)
  assert.ok(h.html.includes('Не удалось получить актуальную заявку'))
  assert.deepEqual(h.events, ['GET', 'POST', 'GET', 'GET'])
  assert.equal(h.requests.length, 1)
})

test('pending and accepted screens preserve the submitted financial snapshot through a cache refresh', async () => {
  const view = makeView()
  const post = deferred()
  const h = acceptance({ view, refetches: [[unrelated, view]], posts: [post.promise] })
  h.confirm()
  h.click('Подтвердить подписание')
  await h.flush()
  h.setData([unrelated, makeView({ offerOverride: { amount: 75000, finalRate: 10, monthlyPayment: 35000, termDays: 90 } })])
  assert.deepEqual(termsIn(h.panel.props.children), expectedTerms(view.offer))
  assert.equal(h.panel.props.dismissible, false)
  post.resolve()
  await h.settle()
  assert.ok(h.html.includes('Условия приняты'))
  assert.deepEqual(termsIn(h.panel.props.children), expectedTerms(view.offer))
  assert.equal(h.requests.length, 1)
})

test('SESSION_CHANGED during POST skips recovery GET and cache invalidation', async () => {
  const view = makeView()
  const h = acceptance({ view, refetches: [[unrelated, view]], posts: [new ApiError(0, 'SESSION_CHANGED', 'Сессия изменилась')] })
  h.confirm()
  h.click('Подтвердить подписание')
  await h.settle()
  assert.deepEqual(h.events, ['GET', 'POST'])
  assert.equal(h.mutations[0].state.error.code, 'SESSION_CHANGED')
  assert.deepEqual(h.invalidations, [])
  assert.ok(!h.html.includes('Условия приняты'))
})
