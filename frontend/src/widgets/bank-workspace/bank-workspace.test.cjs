const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { QueryClient } = require('@tanstack/react-query')
const { z } = require('zod')

const root = path.resolve(__dirname, '../..')

function load(relative, dependencies = {}) {
  const file = path.join(root, relative)
  const compiled = ts.transpileModule(readFileSync(file, 'utf8'), {
    fileName: file,
    reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX },
  })
  assert.equal(compiled.diagnostics.filter((item) => item.category === ts.DiagnosticCategory.Error).length, 0)
  const module = { exports: {} }
  vm.runInNewContext(`(function(require, module, exports) { ${compiled.outputText}\n})`, { Error }, { filename: file })((id) => {
    if (id === 'react/jsx-runtime') return require(id)
    assert.ok(Object.hasOwn(dependencies, id), `Unexpected dependency: ${id}`)
    return dependencies[id]
  }, module, module.exports)
  return module.exports
}

const loan = load('entities/loan-application/index.ts', {
  zod: { z }, '@tanstack/react-query': {}, '@/shared/api': {},
  './get-application-progress': load('entities/loan-application/get-application-progress.ts'),
})
const { decisionSchema } = load('widgets/bank-workspace/model/decision.ts', { zod: { z } })
const { formatMoney } = load('shared/lib/format-money.ts')
const { formatDate } = load('shared/lib/format-date.ts')
const json = (value) => JSON.parse(JSON.stringify(value))
const recommendation = { decision: 'DECLINED', finalRate: 31.25, amount: 750000, reason: 'Private recommendation reason' }
const publicScoring = {
  rate: 24.5, termMonthsEquivalent: 2, newMonthlyPayment: 510000.25, dtiPercent: 22, amountToRevenue: 0.1,
  isDataComplete: true, internalScore: 66, riskClass: 'B', industryLimitCoef: 0.8, industryRatePremium: 1,
  absoluteMaxAmount: 20000000, calculatedLimit: 880000, bkiZone: null, external: null, points: null,
}
const privateScoring = {
  ...publicScoring, bkiZone: 'RED', points: { bkiScore: 10 },
  external: { bkiScore: 500, delinquencies12m: 3, inquiries12m: 4, activeLoans: 2,
    revenueTrend: 'DECLINING', companyAgeYears: 5 },
}
function application(overrides = {}) {
  return {
    id: 7, amount: 1000000, termDays: 60, rate: 24.5, purpose: 'Working capital', createdAt: '2026-10-23T12:00:00Z',
    companyName: 'Test company', inn: '7701234567', legalForm: 'OOO', businessTask: null,
    status: 'IN_REVIEW', decision: null, finalRate: null, offer: null, internalScore: null, riskClass: null,
    aiComment: null, recommendation: null, scoring: null, officerComment: null, ...overrides,
  }
}
function bankApplication(overrides = {}) {
  return application({ recommendation, aiComment: 'Private AI summary', scoring: privateScoring,
    internalScore: 66, riskClass: 'B', ...overrides })
}
function savedApplication(view, overrides = {}) {
  return { ...view, status: 'OFFER_READY', decision: 'APPROVED', finalRate: 31.25, officerComment: 'Officer decision',
    offer: { id: 9, amount: view.amount, termDays: view.termDays, finalRate: 31.25,
      monthlyPayment: 534567.89, status: 'ACTIVE', validUntil: '2099-12-31' }, ...overrides }
}

test('client and bank schemas accept initial null fields and nullable historical bank data', () => {
  for (const schema of [loan.applicationViewSchema, loan.bankApplicationViewSchema]) {
    for (const riskClass of [null, 'A', 'B', 'C', 'D']) {
      const view = schema.parse(application({ riskClass, rate: null, purpose: null, legalForm: null }))
      for (const field of ['decision', 'finalRate', 'offer', 'recommendation', 'aiComment', 'officerComment', 'scoring']) {
        assert.ok(Object.hasOwn(view, field))
        assert.equal(view[field], null)
      }
      assert.equal(view.status, 'IN_REVIEW')
    }
    const view = schema.parse(application({ scoring: { ...publicScoring, rate: null, newMonthlyPayment: null, calculatedLimit: null } }))
    for (const field of ['bkiZone', 'external', 'points']) assert.equal(view.scoring[field], null)
  }
  assert.equal(loan.applicationViewsSchema.parse([application()]).length, 1)
  assert.equal(loan.bankApplicationViewsSchema.parse([bankApplication(), application()]).length, 2)
})

test('required null privacy fields cannot be missing, undefined or filled in client responses', () => {
  for (const field of ['aiComment', 'recommendation', 'decision', 'finalRate', 'offer', 'scoring']) {
    for (const schema of [loan.applicationViewSchema, loan.bankApplicationViewSchema]) {
      const missing = application()
      delete missing[field]
      assert.equal(schema.safeParse(missing).success, false, field)
      assert.equal(schema.safeParse(application({ [field]: undefined })).success, false, field)
    }
  }
  for (const field of ['aiComment', 'recommendation']) {
    const view = application({ [field]: bankApplication()[field] })
    assert.equal(loan.applicationViewSchema.safeParse(view).success, false, field)
    assert.equal(loan.bankApplicationViewSchema.safeParse(view).success, true, field)
  }
  for (const field of ['bkiZone', 'external', 'points']) {
    const missing = { ...publicScoring }
    delete missing[field]
    for (const schema of [loan.applicationViewSchema, loan.bankApplicationViewSchema]) {
      assert.equal(schema.safeParse(application({ scoring: missing })).success, false, field)
    }
    const view = application({ scoring: { ...publicScoring, [field]: privateScoring[field] } })
    assert.equal(loan.applicationViewSchema.safeParse(view).success, false, field)
    assert.equal(loan.bankApplicationViewSchema.safeParse(view).success, true, field)
  }
  assert.equal(loan.applicationViewsSchema.safeParse([bankApplication()]).success, false)
})

test('bank recommendations are advisory, have no termDays, and require all four documented fields', () => {
  for (const decision of loan.applicationDecisionSchema.options) {
    for (const finalRate of [null, 0, 31.25]) {
      const expected = { decision, finalRate, amount: null, reason: 'Reason' }
      const view = loan.bankApplicationViewSchema.parse(bankApplication({ recommendation: { ...expected, termDays: 90 } }))
      assert.deepEqual(json(view.recommendation), expected)
      assert.equal(view.status, 'IN_REVIEW')
      assert.equal(view.decision, null)
      assert.equal(view.finalRate, null)
      assert.equal(view.offer, null)
    }
  }
  for (const field of ['decision', 'finalRate', 'amount', 'reason']) {
    const missing = { ...recommendation }
    delete missing[field]
    assert.equal(loan.bankApplicationViewSchema.safeParse(bankApplication({ recommendation: missing })).success, false, field)
  }
})

test('APPROVE and DECLINE serialize only their action and a validated nonblank comment', () => {
  for (const action of ['APPROVE', 'DECLINE']) {
    const result = decisionSchema.parse({ action, comment: '  Human decision  ', amount: '1', termDays: '45', finalRate: '-1' })
    assert.deepEqual(json(result), { action, comment: 'Human decision' })
  }
  for (const action of ['APPROVE', 'DECLINE', 'OFFER_ALTERNATIVE']) {
    for (const comment of ['', ' \n\t ', 'x'.repeat(1001)]) {
      assert.equal(decisionSchema.safeParse({ action, comment }).success, false)
    }
    assert.equal(decisionSchema.safeParse({ action, comment: 'x'.repeat(1000) }).success, true)
  }
  assert.equal(decisionSchema.safeParse({ action: 'APPROVED', comment: 'Decision' }).success, false)
})

const overrides = [['amount', '1250000,50', 1250000.5], ['termDays', '90', 90], ['finalRate', '0', 0]]
test('all eight independent alternative override combinations omit blanks from JSON, never send zero defaults', () => {
  for (let mask = 0; mask < 8; mask++) {
    const input = { action: 'OFFER_ALTERNATIVE', comment: 'Decision', amount: ' ', termDays: '', finalRate: '\t' }
    const expected = { action: input.action, comment: input.comment }
    overrides.forEach(([field, value, parsed], index) => {
      if (mask & (1 << index)) { input[field] = value; expected[field] = parsed }
    })
    assert.deepEqual(json(decisionSchema.parse(input)), expected)
  }
  assert.deepEqual(json(decisionSchema.parse({ action: 'OFFER_ALTERNATIVE', comment: 'Decision' })),
    { action: 'OFFER_ALTERNATIVE', comment: 'Decision' })
})

test('alternative overrides enforce amount, term and rate bounds without accepting null or malformed numbers', () => {
  for (const [field, values] of [
    ['amount', ['0', '49999.99', '20000000.01', '-50000', 'NaN', 'Infinity', '1e6', '50 000', null]],
    ['termDays', ['0', '45', '30.0', '120', null]],
    ['finalRate', ['-0.1', '100.01', 'NaN', 'Infinity', '0x10', null]],
  ]) {
    for (const value of values) assert.equal(decisionSchema.safeParse({ action: 'OFFER_ALTERNATIVE', comment: 'Decision', [field]: value }).success, false, `${field}: ${value}`)
  }
  for (const [amount, termDays, finalRate] of [['50000', '30', '0'], ['20000000', '60', '100'], ['100000.01', '90', '25,75']]) {
    assert.equal(decisionSchema.safeParse({ action: 'OFFER_ALTERNATIVE', comment: 'Decision', amount, termDays, finalRate }).success, true)
  }
})

function hooks() {
  const slots = []
  let cursor = 0
  const h = { writes: 0 }
  h.slot = (kind, init) => {
    const index = cursor++
    if (!slots[index]) slots[index] = { kind, value: init() }
    assert.equal(slots[index].kind, kind)
    return slots[index].value
  }
  h.react = {
    ...React,
    useId: () => h.slot('id', () => `test-${cursor}`),
    useRef: (value) => h.slot('ref', () => ({ current: value })),
    useState(initial) {
      const state = h.slot('state', () => ({ value: typeof initial === 'function' ? initial() : initial }))
      return [state.value, (next) => { state.value = typeof next === 'function' ? next(state.value) : next; h.writes++ }]
    },
  }
  h.render = (Component, props) => { cursor = 0; return Component(props) }
  return h
}
const styles = new Proxy({}, { get: (_, key) => String(key) })
const Button = ({ children, disabled, loading }) => React.createElement('button', { disabled, 'aria-busy': loading }, children)
const Input = ({ label, hint, error }) => React.createElement('div', null, label, hint, error)
const Select = Input
const Textarea = Input
const Panel = ({ open, children }) => open ? React.createElement('aside', null, children) : null
const BankForm = () => React.createElement('div', { 'data-decision-form': true })
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
  return React.Children.toArray(element).map((child) => React.isValidElement(child) ? content(child.props.children) : String(child)).join('')
}
function one(element, predicate) {
  const found = nodes(element, predicate)
  assert.equal(found.length, 1)
  return found[0]
}
function form(props = {}) {
  const runtime = hooks()
  const h = { submissions: [], props: { application: bankApplication(), disabled: false, pending: false,
    onSubmit: (body) => h.submissions.push(json(body)), ...props } }
  const { DecisionForm } = load('widgets/bank-workspace/ui/DecisionForm/DecisionForm.tsx', {
    react: runtime.react, '@alfalab/core-components/button': { Button }, '@alfalab/core-components/input': { Input },
    '@alfalab/core-components/select': { Select }, '@alfalab/core-components/textarea': { Textarea },
    '@/shared/lib': { formatMoney }, '../../model/decision': { decisionSchema },
    './DecisionForm.module.scss': { __esModule: true, default: styles },
  })
  h.render = () => { h.element = runtime.render(DecisionForm, h.props); h.html = renderToStaticMarkup(h.element) }
  h.field = (name) => one(h.element, (node) => node.props.name === name && node.type !== 'input')
  h.choose = (action) => { one(h.element, (node) => node.type === 'input' && node.props.value === action).props.onChange(); h.render() }
  h.change = (name, value) => {
    if (name === 'termDays') h.field(name).props.onChange({ selected: value ? { key: value } : null })
    else h.field(name).props.onChange(null, { value })
    h.render()
  }
  h.submit = () => { h.element.props.onSubmit({ preventDefault() {} }); h.render() }
  h.render()
  return h
}

test('approval displays requested amount/term and recommendation rate, not the base rate or recommended amount', () => {
  for (const finalRate of [31.25, 0, null]) {
    const view = bankApplication({ recommendation: { ...recommendation, finalRate } })
    const h = form({ application: view })
    h.choose('APPROVE')
    assert.deepEqual(nodes(h.element, (node) => node.type === 'dd').map(content), [
      formatMoney(view.amount), `${view.termDays} дней`,
      finalRate === null ? 'Рассчитает сервер при сохранении' : `${finalRate}% годовых из рекомендации`,
      formatMoney(publicScoring.newMonthlyPayment),
    ])
    assert.ok(h.html.includes('Платёж скоринга по базовой ставке'))
    assert.ok(h.html.includes('а не по ставке предложения'))
    assert.ok(!h.html.includes('24.5%'))
    assert.ok(!h.html.includes(formatMoney(recommendation.amount)))
    assert.deepEqual(h.submissions, [])
    h.change('comment', ' Approve requested terms ')
    h.submit()
    assert.deepEqual(h.submissions, [{ action: 'APPROVE', comment: 'Approve requested terms' }])
  }
})

test('alternative fields stay blank and advertise server defaults without computing fallback amounts or rates', () => {
  for (const current of [recommendation, { ...recommendation, finalRate: 0 }, null, { ...recommendation, amount: null, finalRate: null }]) {
    const h = form({ application: bankApplication({ recommendation: current }) })
    h.choose('OFFER_ALTERNATIVE')
    assert.equal(h.field('amount').props.value, '')
    assert.equal(h.field('termDays').props.selected, null)
    assert.equal(h.field('finalRate').props.value, '')
    assert.ok(h.field('amount').props.hint.includes(current?.amount == null ? 'сумму рассчитает сервер' : formatMoney(current.amount)))
    assert.ok(h.field('finalRate').props.hint.includes(current?.finalRate == null ? 'ставку рассчитает сервер' : `${current.finalRate}% из рекомендации`))
    assert.ok(h.field('termDays').props.hint.includes('60 дней из заявки'))
    assert.ok(!h.html.includes(formatMoney(publicScoring.calculatedLimit)))
    h.change('comment', 'Use server defaults')
    h.submit()
    assert.deepEqual(h.submissions, [{ action: 'OFFER_ALTERNATIVE', comment: 'Use server defaults' }])
  }
})

test('changing the term warns about retained recommendation rates, and clearing restores omission', () => {
  for (const finalRate of [31.25, 0]) {
    const h = form({ application: bankApplication({ recommendation: { ...recommendation, finalRate } }) })
    h.choose('OFFER_ALTERNATIVE')
    assert.equal(h.field('termDays').props.allowUnselect, true)
    h.change('termDays', '90')
    assert.equal(h.field('termDays').props.clear, true)
    const warning = one(h.element, (node) => node.props.className === 'warning')
    assert.equal(warning.props.role, 'status')
    assert.ok(content(warning).includes(`рекомендации ${finalRate}% без пересчёта под новый срок`))
    h.change('finalRate', '0')
    assert.equal(nodes(h.element, (node) => node.props.className === 'warning').length, 0)
    h.change('finalRate', ' ')
    assert.equal(nodes(h.element, (node) => node.props.className === 'warning').length, 1)
    h.field('termDays').props.onClear()
    h.render()
    assert.equal(h.field('termDays').props.selected, null)
    assert.equal(nodes(h.element, (node) => node.props.className === 'warning').length, 0)
    h.change('termDays', '60')
    assert.equal(nodes(h.element, (node) => node.props.className === 'warning').length, 0)
    h.change('termDays', '')
    h.change('comment', 'Use defaults')
    h.submit()
    assert.deepEqual(h.submissions, [{ action: 'OFFER_ALTERNATIVE', comment: 'Use defaults' }])
  }
  const h = form({ application: bankApplication({ recommendation: null }) })
  h.choose('OFFER_ALTERNATIVE')
  h.change('termDays', '90')
  assert.equal(nodes(h.element, (node) => node.props.className === 'warning').length, 0)
})

test('form validation, disabled/pending guards and action changes cannot submit stale alternative overrides', () => {
  const h = form()
  h.submit()
  assert.ok(h.html.includes('Выберите решение'))
  h.choose('OFFER_ALTERNATIVE')
  h.change('amount', '49999')
  h.change('termDays', '45')
  h.change('finalRate', '101')
  h.submit()
  for (const name of ['amount', 'termDays', 'finalRate', 'comment']) assert.ok(h.field(name).props.error)
  assert.deepEqual(h.submissions, [])
  h.change('comment', 'Human decision')
  for (const action of ['APPROVE', 'DECLINE']) {
    h.choose(action)
    for (const guard of ['disabled', 'pending']) {
      h.props[guard] = true
      h.render()
      h.submit()
      assert.equal(h.submissions.length, action === 'APPROVE' ? 0 : 1)
      h.props[guard] = false
      h.render()
    }
    h.submit()
  }
  assert.deepEqual(h.submissions, [{ action: 'APPROVE', comment: 'Human decision' }, { action: 'DECLINE', comment: 'Human decision' }])
})

class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code }
}
function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function workspace({ view = bankApplication(), posts = [], open = true } = {}) {
  const runtime = hooks()
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  const setData = cache.setQueryData.bind(cache)
  const officer = { userId: 12, role: 'BANK_OFFICER', companyId: null, legalForm: null, fullName: 'Officer' }
  const other = bankApplication({ id: 8, companyName: 'Other company' })
  setData(['session'], officer)
  setData(['bank', officer.userId, 'applications'], [view, other])
  setData(['bank', officer.userId, 'applications', view.id], view)
  setData(['bank', officer.userId, 'applications', view.id, 'form'], { step2_businessData: null })
  const h = { cache, runtime, view, officer, other, generation: 1, switching: false, posts: [...posts], queries: {},
    flags: { queue: {}, detail: {}, form: {}, session: {} }, requests: [], writes: [], invalidations: [], tasks: new Set(), calls: [] }
  cache.setQueryData = (key, value) => { h.writes.push(Array.from(key)); return setData(key, value) }
  cache.invalidateQueries = async ({ queryKey }) => {
    h.invalidations.push(Array.from(queryKey))
    await h.onInvalidate?.()
  }
  h.setSession = (session, generation = h.generation + 1) => {
    h.generation = generation
    cache.clear()
    setData(['session'], session)
  }
  h.setApplication = (next) => { setData(['bank', officer.userId, 'applications', view.id], next); h.render() }
  function useQuery(options) {
    const name = options.queryKey.length === 3 ? 'queue' : options.queryKey.length === 4 ? 'detail' : 'form'
    h.queries[name] = options
    const data = cache.getQueryData(options.queryKey)
    return { data, isPending: data === undefined, isFetching: false, isError: false, error: null,
      ...h.flags[name], refetch: async () => ({ data }) }
  }
  function useMutation(options) {
    const mutation = runtime.slot('mutation', () => ({ state: { isPending: false, isSuccess: false, isError: false } }))
    h.mutation = mutation
    mutation.options = options
    return { ...mutation.state, mutate(variables) {
      h.calls.push(variables)
      mutation.state = { variables, isPending: true, isSuccess: false, isError: false }
      const task = Promise.resolve().then(async () => {
        try {
          const data = await options.mutationFn(variables)
          await options.onSuccess?.(data, variables)
          mutation.state = { variables, data, isPending: false, isSuccess: true, isError: false }
        } catch (error) {
          await options.onError?.(error, variables)
          mutation.state = { variables, error, isPending: false, isSuccess: false, isError: true }
        }
      })
      h.tasks.add(task)
      void task.finally(() => h.tasks.delete(task))
    } }
  }
  const { BankWorkspace } = load('widgets/bank-workspace/ui/BankWorkspace/BankWorkspace.tsx', {
    react: runtime.react, '@alfalab/core-components/button': { Button },
    '@tanstack/react-query': { useQuery, useMutation, useQueryClient: () => cache },
    '@/entities/session': { sessionKey: ['session'], useSession: () => ({ data: cache.getQueryData(['session']),
      isPending: false, isError: false, ...h.flags.session }) },
    '@/entities/application-form': { applicationBusinessSummarySchema: z.object({ step2_businessData: z.null() }) },
    '@/entities/company': { getCompanyAge: () => null, getIndustryGroup: () => null },
    '@/entities/loan-application': loan,
    '@/shared/api': { ApiError, getSessionGeneration: () => h.generation, isSessionSwitching: () => h.switching,
      syncSessionChanges: () => {}, apiRequest: async (url, schema, options) => {
        h.requests.push({ url, schema, ...options })
        if (options?.method !== 'POST') return schema.parse(url.endsWith('/form') ? { step2_businessData: null }
          : url.endsWith(`/${view.id}`) ? view : [view, other])
        assert.ok(h.posts.length, `Unscripted POST ${url}`)
        const result = await h.posts.shift()
        if (result instanceof Error) throw result
        return schema.parse(result)
      } },
    '@/shared/lib': { formatDate, formatMoney }, '@/shared/ui': { Panel }, '../DecisionForm': { DecisionForm: BankForm },
    './BankWorkspace.module.scss': { __esModule: true, default: styles },
  })
  h.render = () => {
    h.element = runtime.render(BankWorkspace)
    h.html = renderToStaticMarkup(h.element)
    h.form = nodes(h.element, (node) => node.type === BankForm)[0]
    h.panel = nodes(h.element, (node) => node.type === Panel)[0]
  }
  h.open = () => {
    one(h.element, (node) => node.type === Button && node.props['aria-label']?.startsWith(`Открыть заявку № ${view.id}:`)).props.onClick()
    h.render()
  }
  h.flush = async () => { await new Promise(setImmediate); h.render() }
  h.settle = async () => { await Promise.all([...h.tasks]); await h.flush() }
  h.render()
  if (open) h.open()
  return h
}

test('bank queue and selected detail poll every 15 seconds using bank schemas and abort signals', async () => {
  const h = workspace({ open: false })
  assert.equal(h.queries.queue.refetchInterval, 15000)
  assert.equal(h.queries.detail.refetchInterval, 15000)
  assert.equal(h.queries.queue.enabled, true)
  assert.equal(h.queries.detail.enabled, false)
  assert.ok(h.html.includes('Все новые заявки рассматривает сотрудник'))
  assert.ok(!h.html.includes('Сервер принимает решение'))
  assert.deepEqual(h.requests, [])
  h.open()
  assert.equal(h.queries.detail.enabled, true)
  const signal = new AbortController().signal
  assert.equal((await h.queries.queue.queryFn({ signal })).length, 2)
  assert.equal((await h.queries.detail.queryFn({ signal })).recommendation.reason, recommendation.reason)
  assert.equal(h.requests[0].schema, loan.bankApplicationViewsSchema)
  assert.equal(h.requests[1].schema, loan.bankApplicationViewSchema)
  assert.ok(h.requests.every((request) => request.signal === signal))
  h.panel.props.onClose()
  h.render()
  assert.equal(h.queries.detail.enabled, false)
})

test('every IN_REVIEW recommendation including DECLINED and null allows a human decision', () => {
  for (const decision of [...loan.applicationDecisionSchema.options, null]) {
    const h = workspace({ view: bankApplication({ recommendation: decision ? { ...recommendation, decision } : null }) })
    assert.equal(h.form.props.disabled, false)
    assert.equal(h.form.props.pending, false)
    const saved = one(h.element, (node) => node.props['aria-label'] === 'Сохранённое решение банка')
    assert.ok(content(saved).includes('Не принято'))
    assert.ok(!content(saved).includes(recommendation.reason))
    const advisory = one(h.element, (node) => node.props['aria-label'] === 'Рекомендация скоринга, только для банка')
    assert.ok(content(advisory).includes('Это рекомендация, а не сохранённое решение'))
    assert.ok(content(advisory).includes(decision ? recommendation.reason : 'Рекомендация не сохранена'))
    const summary = one(h.element, (node) => node.props['aria-label'] === 'AI-сводка, только для банка')
    assert.ok(content(summary).includes('Private AI summary'))
    assert.ok(content(summary).includes('рекомендательный характер'))
    assert.deepEqual(h.requests, [])
  }
  const h = workspace({ view: application() })
  assert.ok(h.html.includes('AI-сводка не сохранена'))
  assert.equal(h.form.props.disabled, false)
})

test('human approval over a decline recommendation sends one action/comment POST and preserves server offer terms', async () => {
  const view = bankApplication()
  const post = deferred()
  const h = workspace({ view, posts: [post.promise] })
  const f = form({ application: view, onSubmit: h.form.props.onSubmit })
  f.choose('APPROVE')
  f.change('comment', ' Officer decision ')
  assert.deepEqual(h.requests, [])
  f.submit()
  f.submit()
  h.render()
  assert.equal(h.calls.length, 1)
  assert.equal(h.form.props.pending, true)
  assert.equal(h.form.props.disabled, true)
  h.panel.props.onClose()
  h.render()
  assert.equal(h.panel.props.open, true)
  await h.flush()
  assert.equal(h.requests.length, 1)
  assert.equal(h.requests[0].url, '/api/bank/applications/7/decision')
  assert.equal(h.requests[0].schema, loan.bankApplicationViewSchema)
  assert.deepEqual(JSON.parse(h.requests[0].body), { action: 'APPROVE', comment: 'Officer decision' })
  assert.equal(h.mutation.options.retry, false)
  const saved = savedApplication(view)
  post.resolve(saved)
  await h.settle()
  assert.equal(h.form, undefined)
  assert.ok(h.html.includes('Решение сохранено'))
  assert.ok(h.html.includes(formatMoney(saved.offer.monthlyPayment)))
  assert.deepEqual(json(h.cache.getQueryData(['bank', 12, 'applications', 7])), saved)
  assert.equal(h.cache.getQueryData(['bank', 12, 'applications'])[1], h.other)
  assert.deepEqual(h.writes, [['bank', 12, 'applications', 7], ['bank', 12, 'applications']])
  assert.deepEqual(h.invalidations, [['bank', 12]])
})

test('alternative POSTs omit every blank default and send only independently selected overrides', async () => {
  for (let mask = 0; mask < 8; mask++) {
    const view = bankApplication()
    const h = workspace({ view, posts: [savedApplication(view, { decision: 'ALTERNATIVE_OFFER' })] })
    const f = form({ application: view, onSubmit: h.form.props.onSubmit })
    f.choose('OFFER_ALTERNATIVE')
    f.change('comment', 'Alternative')
    const expected = { action: 'OFFER_ALTERNATIVE', comment: 'Alternative' }
    overrides.forEach(([field, value, parsed], index) => {
      if (mask & (1 << index)) { f.change(field, value); expected[field] = parsed }
    })
    f.submit()
    await h.settle()
    assert.equal(h.requests.length, 1)
    assert.deepEqual(JSON.parse(h.requests[0].body), expected)
  }
})

test('detail refresh/errors block submission, and decided statuses never offer another decision form', () => {
  for (const flag of ['isFetching', 'isError']) {
    const h = workspace()
    h.flags.detail[flag] = true
    if (flag === 'isError') h.flags.detail.error = new Error('GET failed')
    h.render()
    assert.equal(h.form.props.disabled, true)
    h.form.props.onSubmit({ action: 'APPROVE', comment: 'Decision' })
    assert.equal(h.calls.length, 0)
  }
  for (const status of ['OFFER_READY', 'DECLINED', 'ACCEPTED']) {
    const h = workspace({ view: application({ status }) })
    assert.equal(h.form, undefined)
    assert.ok(h.html.includes('Повторное рассмотрение недоступно'))
  }
})

test('ALREADY_DECIDED refreshes data but retains the synchronous lock even if detail still looks in review', async () => {
  const h = workspace({ posts: [new ApiError(409, 'ALREADY_DECIDED', 'Already decided')] })
  h.form.props.onSubmit({ action: 'APPROVE', comment: 'Decision' })
  await h.settle()
  assert.equal(h.form.props.disabled, true)
  assert.ok(h.html.includes('ALREADY_DECIDED'))
  h.form.props.onSubmit({ action: 'APPROVE', comment: 'Duplicate' })
  await h.settle()
  assert.equal(h.requests.length, 1)
  assert.deepEqual(h.invalidations, [['bank', 12]])
  h.setApplication(application({ status: 'DECLINED', decision: 'DECLINED', officerComment: 'Other officer' }))
  assert.equal(h.form, undefined)
})

test('ordinary failures reconcile first and permit only an explicit retry after the detail error clears', async () => {
  const h = workspace({ posts: [new ApiError(0, 'NETWORK_ERROR', 'Network failure')] })
  h.onInvalidate = () => { h.flags.detail.isError = true; h.flags.detail.error = new Error('Refresh failed') }
  h.form.props.onSubmit({ action: 'DECLINE', comment: 'Decision' })
  await h.settle()
  assert.equal(h.form.props.disabled, true)
  assert.equal(h.requests.length, 1)
  h.flags.detail.isError = false
  h.render()
  assert.equal(h.form.props.disabled, false)
  assert.equal(h.requests.length, 1)
})

test('SESSION_CHANGED does not invalidate, repopulate caches or unlock stale local state', async () => {
  const h = workspace({ posts: [new ApiError(409, 'SESSION_CHANGED', 'Session changed')] })
  h.form.props.onSubmit({ action: 'APPROVE', comment: 'Decision' })
  const writes = h.runtime.writes
  await h.settle()
  assert.deepEqual(h.invalidations, [])
  assert.deepEqual(h.writes, [])
  assert.equal(h.runtime.writes, writes)
})

test('old successful and failed callbacks cannot restore private data after an identity or generation change', async () => {
  for (const outcome of ['success', 'failure']) {
    for (const change of ['identity', 'generation']) {
      const post = deferred()
      const h = workspace({ posts: [post.promise] })
      h.form.props.onSubmit({ action: 'APPROVE', comment: 'Decision' })
      await h.flush()
      const writes = h.runtime.writes
      h.setSession({ ...h.officer, userId: change === 'identity' ? 13 : 12 }, h.generation + (change === 'generation' ? 1 : 0))
      if (outcome === 'success') post.resolve(savedApplication(h.view))
      else post.reject(new ApiError(0, 'NETWORK_ERROR', 'Late failure'))
      await h.settle()
      assert.deepEqual(h.writes, [])
      assert.deepEqual(h.invalidations, [])
      assert.equal(h.runtime.writes, writes)
      assert.equal(h.cache.getQueryData(['bank', 12, 'applications', 7]), undefined)
      assert.equal(h.cache.getQueryData(['bank', 12, 'applications']), undefined)
    }
  }
})

test('a session change while error reconciliation is pending prevents stale state writes after await', async () => {
  const refresh = deferred()
  const h = workspace({ posts: [new ApiError(0, 'NETWORK_ERROR', 'Network failure')] })
  h.onInvalidate = () => refresh.promise
  h.form.props.onSubmit({ action: 'APPROVE', comment: 'Decision' })
  await h.flush()
  assert.deepEqual(h.invalidations, [['bank', 12]])
  const writes = h.runtime.writes
  h.setSession({ ...h.officer, userId: 13 })
  refresh.resolve()
  await h.settle()
  assert.equal(h.runtime.writes, writes)
  assert.deepEqual(h.writes, [])
})

test('stale submit handlers and queued mutations cannot send under another session or a non-bank role', async () => {
  for (const change of ['identity', 'generation', 'role', 'switching']) {
    const h = workspace()
    const submit = h.form.props.onSubmit
    if (change === 'switching') h.switching = true
    else h.setSession({ ...h.officer, userId: change === 'identity' ? 13 : 12,
      role: change === 'role' ? 'CLIENT' : 'BANK_OFFICER' }, h.generation + (change === 'generation' ? 1 : 0))
    submit({ action: 'APPROVE', comment: 'Stale decision' })
    assert.equal(h.calls.length, 0)
    assert.deepEqual(h.requests, [])
    if (change === 'role') {
      h.render()
      assert.equal(h.queries.queue.enabled, false)
      assert.equal(h.queries.detail.enabled, false)
      assert.ok(!h.html.includes('Private AI summary'))
    }
  }
  const h = workspace()
  h.form.props.onSubmit({ action: 'APPROVE', comment: 'Queued decision' })
  h.setSession({ ...h.officer, userId: 13 })
  await h.settle()
  assert.equal(h.calls.length, 1)
  assert.deepEqual(h.requests, [])
  assert.deepEqual(h.invalidations, [])
  assert.equal(h.mutation.state.error.code, 'SESSION_CHANGED')
})
