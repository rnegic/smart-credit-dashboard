const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { z } = require('zod')

const root = path.resolve(__dirname, '../..')
const plain = (value) => JSON.parse(JSON.stringify(value))
function load(relative, dependencies) {
  const file = path.join(root, relative)
  const compiled = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const module = { exports: {} }
  vm.runInNewContext(`(function(require, module, exports) { ${compiled}\n})`, { Error }, { filename: file })((id) => {
    if (id === 'react/jsx-runtime') return require(id)
    assert.ok(Object.hasOwn(dependencies, id), `Unexpected dependency: ${id}`)
    return dependencies[id]
  }, module, module.exports)
  return module.exports
}

class ApiError extends Error {
  constructor(status, code, message = code) { super(message); this.status = status; this.code = code }
}
const tranche = {
  id: 11, contractId: 9, amount: 100000, termDays: 30, ratePercent: 24.5,
  issuedAt: '2026-10-01', dueDate: '2026-10-31', status: 'ACTIVE',
  accruedInterest: 1610.96, totalToRepay: 101610.96, repaidAt: null,
}
const contract = {
  id: 9, applicationId: 7, status: 'ACTIVE', contractTermMonths: 12,
  startDate: '2026-10-01', endDate: '2027-10-01', limit: 500000,
  usedLimit: 100000, availableLimit: 400000, revolving: false,
  outstandingPrincipal: 100000, minTrancheAmount: 1000, canIssueTranche: true,
  issueBlockedReason: null,
  trancheTerms: { termDays: 90, ratePercent: 25, dueDate: '2027-01-23', available: true },
  tranches: [tranche],
}
const entity = load('entities/contract/index.ts', { zod: { z }, '@tanstack/react-query': {}, '@/shared/api': {} })
const format = {
  ...load('shared/lib/format-money.ts', {}),
  ...load('shared/lib/format-date.ts', {}),
}
const errorModel = load('features/manage-tranches/model/use-tranche-mutation.ts', {
  '@tanstack/react-query': {}, '@/entities/session': {}, '@/entities/contract': entity, '@/shared/api': { ApiError },
})

test('contract responses require one fixed terms object and preserve historical tranche terms and repayment totals', () => {
  const repaid = { ...tranche, status: 'REPAID', repaidAt: '2026-10-25' }
  const parsed = entity.contractSchema.parse({ ...contract, tranches: [repaid],
    canIssueTranche: false, issueBlockedReason: 'RATE_UNAVAILABLE',
    trancheTerms: { ...contract.trancheTerms, ratePercent: null } })
  assert.equal(parsed.tranches[0].totalToRepay, tranche.totalToRepay)
  assert.equal(parsed.tranches[0].termDays, 30)
  assert.equal(parsed.tranches[0].ratePercent, 24.5)
  assert.equal(parsed.trancheTerms.termDays, 90)
  assert.equal(parsed.trancheTerms.ratePercent, null)
  assert.equal(parsed.issueBlockedReason, 'RATE_UNAVAILABLE')
  for (const key of Object.keys(contract)) {
    const missing = { ...contract }; delete missing[key]
    assert.equal(entity.contractSchema.safeParse(missing).success, false, key)
  }
  for (const term of [0, 3, 18, 36, null])
    assert.equal(entity.contractSchema.safeParse({ ...contract, contractTermMonths: term }).success, false)
  for (const key of Object.keys(contract.trancheTerms)) {
    const missing = { ...contract.trancheTerms }; delete missing[key]
    assert.equal(entity.contractSchema.safeParse({ ...contract, trancheTerms: missing }).success, false, key)
  }
  for (const termDays of [30, 60, 90])
    assert.equal(entity.contractSchema.safeParse({ ...contract, trancheTerms: { ...contract.trancheTerms, termDays } }).success, true)
  for (const termDays of [null, 6, 12, 24, 31, '30'])
    assert.equal(entity.contractSchema.safeParse({ ...contract, trancheTerms: { ...contract.trancheTerms, termDays } }).success, false)
  for (const trancheTerms of [[], [contract.trancheTerms], null])
    assert.equal(entity.contractSchema.safeParse({ ...contract, trancheTerms }).success, false)
  assert.equal(entity.contractSchema.safeParse({ ...contract, issueBlockedReason: 'UNKNOWN' }).success, false)
  assert.equal(entity.contractSchema.safeParse({ ...contract, trancheTerms: { ...contract.trancheTerms, dueDate: '2026-02-30' } }).success, false)
  assert.equal(entity.trancheSchema.safeParse({ ...tranche, repaidAt: undefined }).success, false)
})

test('tranche requests accept kopeck amounts without a duration and strip non-request snapshot fields', () => {
  assert.deepEqual(plain(entity.trancheRequestSchema.parse({ amount: 123456.78 })), { amount: 123456.78 })
  assert.deepEqual(plain(entity.trancheRequestSchema.parse({ amount: 123456.78, termDays: 30,
    expectedTermDays: 90, expectedRate: 25, expectedDueDate: '2027-01-23' })), { amount: 123456.78 })
  for (const amount of [null, 0, -1, 1000.001, '1000', Infinity])
    assert.equal(entity.trancheRequestSchema.safeParse({ amount }).success, false)
  assert.equal(entity.trancheRequestSchema.safeParse({}).success, false)
})

test('dashboard accepts both tranche action codes and nullable legacy contract months', () => {
  const { dashboardSchema } = load('entities/dashboard/index.ts', {
    zod: { z }, '@tanstack/react-query': {}, '@/shared/api': {},
    '@/entities/loan-application': {
      applicationStatusSchema: z.enum(['IN_REVIEW', 'OFFER_READY', 'SIGNATURE_PENDING', 'ACCEPTED', 'DECLINED']),
      applicationDecisionSchema: z.enum(['APPROVED', 'DECLINED', 'ALTERNATIVE_OFFER', 'MANUAL_REVIEW', 'INFO_REQUIRED']),
    },
  })
  const dashboard = {
    company: { id: 1, name: 'Компания', inn: '7701234567', okved: null, legalForm: 'OOO', externalDemo: null },
    currentApplication: { id: 7, amount: 500000, termDays: 30, contractTermMonths: null, rate: null,
      purpose: 'Оборотные средства', status: 'ACCEPTED', decision: 'APPROVED', finalRate: 24.5, createdAt: '2026-10-01T12:00:00Z' },
    offers: [{ id: 10, amount: 100000, termDays: 60, contractTermMonths: null, finalRate: 24.75, monthlyPayment: 12345.67, validUntil: '2026-12-31' }],
    activeContract: contract, activeLoan: null, nextPayment: null, stages: [], unreadNotifications: 0,
    requiredActions: [{ code: 'ISSUE_TRANCHE', title: 'Получить транш' }, { code: 'REPAY_TRANCHE', title: 'Погасить транш' }],
  }
  const parsed = dashboardSchema.parse(dashboard)
  assert.equal(parsed.activeContract.availableLimit, 400000)
  assert.deepEqual(plain(parsed.activeContract.trancheTerms), contract.trancheTerms)
  assert.equal(parsed.currentApplication.contractTermMonths, null)
  assert.deepEqual(plain(parsed.requiredActions), dashboard.requiredActions)
  assert.equal(dashboardSchema.safeParse({ ...dashboard, activeContract: undefined }).success, false)
  assert.equal(dashboardSchema.safeParse({ ...dashboard, activeContract: { ...contract, trancheTerms: undefined } }).success, false)
  assert.equal(dashboardSchema.safeParse({ ...dashboard, activeContract: { ...contract, trancheTerms: [contract.trancheTerms] } }).success, false)
  const blocked = dashboardSchema.parse({ ...dashboard, activeContract: { ...contract, canIssueTranche: false,
    issueBlockedReason: 'RATE_UNAVAILABLE', trancheTerms: { ...contract.trancheTerms, ratePercent: null } } })
  assert.equal(blocked.activeContract.issueBlockedReason, 'RATE_UNAVAILABLE')
  assert.equal(blocked.activeContract.trancheTerms.ratePercent, null)
})

test('contract queries are scoped and financial endpoints send the exact backend bodies', async () => {
  const requests = []
  let scope = 1
  const api = load('entities/contract/index.ts', {
    zod: { z }, '@tanstack/react-query': { useQuery: (options) => options },
    '@/shared/api': { useApiScope: () => scope, apiRequest: async (url, schema, options) => {
      requests.push({ url, options })
      return schema.parse(url === '/api/contracts' ? [contract] : url.endsWith('/repay')
        ? { ...tranche, status: 'REPAID', repaidAt: '2026-10-25' }
        : url.includes('/tranches') ? tranche : contract)
    } },
  })
  assert.deepEqual(plain(api.useContract(9).queryKey), ['client', 1, 'contracts', 9])
  scope = 2
  assert.deepEqual(plain(api.useContracts().queryKey), ['client', 2, 'contracts'])
  assert.equal(api.useContracts(false).enabled, false)
  scope = null
  assert.equal(api.useContract(9).enabled, false)
  assert.equal(api.useContracts().enabled, false)
  await api.issueTranche(9, { amount: 123456.78, expectedTermDays: 90, expectedRate: 25, expectedDueDate: '2027-01-23' })
  await api.repayTranche(11)
  assert.equal(requests[0].url, '/api/contracts/9/tranches')
  assert.equal(requests[0].options.method, 'POST')
  assert.deepEqual(JSON.parse(requests[0].options.body), { amount: 123456.78 })
  assert.deepEqual(plain(requests[1]), { url: '/api/tranches/11/repay', options: { method: 'POST' } })
})

test('financial responses must refer to the selected contract or confirm the selected repayment', async () => {
  const api = load('entities/contract/index.ts', {
    zod: { z }, '@tanstack/react-query': {}, '@/shared/api': { ApiError,
      apiRequest: async (url, schema) => schema.parse(url.endsWith('/repay') ? tranche
        : url.endsWith('/tranches') ? { ...tranche, contractId: 99 } : { ...contract, id: 99 }),
    },
  })
  for (const operation of [() => api.getContract(9), () => api.issueTranche(9, { amount: 1000 }),
    () => api.repayTranche(11)])
    await assert.rejects(operation, (error) => error.code === 'INVALID_RESPONSE')
})

const Button = ({ children, disabled }) => React.createElement('button', { disabled }, children)
const AmountInput = ({ label, value, error }) => React.createElement('label', null, label, String(value), error)
const Typography = { Text: ({ tag = 'span', children, role }) => React.createElement(tag, { role }, children),
  TitleResponsive: ({ tag, children }) => React.createElement(tag, null, children) }
const Panel = ({ open, children }) => open ? React.createElement('aside', null, children) : null
const RequestState = ({ error, children }) => React.createElement('p', { role: error ? 'alert' : 'status' }, error?.message ?? children)
const styles = { __esModule: true, default: new Proxy({}, { get: (_, name) => String(name) }) }
function nodes(element) {
  return React.isValidElement(element) ? [element, ...React.Children.toArray(element.props.children).flatMap(nodes)] : []
}

function harness(t, kind = 'IssueTranche', overrides = {}) {
  const slots = []
  let cursor = 0
  const requests = []
  const pending = new Set()
  const state = { user: 1, generation: 0, fresh: plain(contract), latest: plain(contract), invalidations: [],
    response: { ...tranche, id: 12, amount: 123456.78, termDays: contract.trancheTerms.termDays,
      ratePercent: contract.trancheTerms.ratePercent, dueDate: contract.trancheTerms.dueDate },
    error: null, refetchError: null, ...overrides }
  const useState = (initial) => {
    const index = cursor++
    if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial }
    return [slots[index].value, (next) => { slots[index].value = typeof next === 'function' ? next(slots[index].value) : next }]
  }
  const react = { useState, useRef: (initial) => useState(() => ({ current: initial }))[0], useId: () => useState('tranche-test')[0] }
  const cache = { invalidateQueries: async (options) => { state.invalidations.push(plain(options)); state.latest = plain(state.fresh) } }
  const queries = { useQueryClient: () => cache, useMutation: (options) => {
    const [mutation] = useState(() => ({ result: { isPending: false, isSuccess: false, data: null, error: null } }))
    mutation.options = options
    assert.equal(options.retry, false)
    return { ...mutation.result,
      reset: () => { mutation.result = { isPending: false, isSuccess: false, data: null, error: null } },
      mutate: (input, callbacks = {}) => {
        mutation.result = { isPending: true, isSuccess: false, data: null, error: null }
        const snapshot = mutation.options
        const job = Promise.resolve().then(async () => {
          let result, error
          try { result = await snapshot.mutationFn(input) } catch (failure) { error = failure }
          await snapshot.onSettled?.(result, error)
          mutation.result = { isPending: false, isSuccess: !error, data: result, error: error ?? null }
          if (error) callbacks.onError?.(error)
          else callbacks.onSuccess?.(result)
          callbacks.onSettled?.(result, error)
        })
        pending.add(job)
        void job.finally(() => pending.delete(job))
      },
    }
  } }
  const model = load('features/manage-tranches/model/use-tranche-mutation.ts', {
    '@tanstack/react-query': queries, '@/entities/contract': entity,
    '@/entities/session': { isCurrentSession: (_, scope, generation) => scope === state.user && generation === state.generation },
    '@/shared/api': { ApiError, useApiScope: () => state.user, useSessionTransition: () => ({ generation: state.generation }) },
  })
  const query = () => ({ data: state.latest, isError: Boolean(state.queryError), isFetching: Boolean(state.fetching), error: state.queryError ?? null,
    refetch: async () => state.refetchError
      ? { isError: true, error: state.refetchError }
      : (state.latest = plain(state.fresh), { isError: false, data: state.latest }),
  })
  const request = async (url, body) => {
    requests.push({ url, body })
    if (state.error) throw state.error
    return state.response
  }
  const exports = load(`features/manage-tranches/ui/${kind}/${kind}.tsx`, {
    react, '@alfalab/core-components/button': { Button }, '@alfalab/core-components/typography': { Typography },
    '@alfalab/core-components/amount-input': { AmountInput },
    '@/entities/contract': { ...entity, useContract: query, getContract: async (id) => {
      requests.push({ url: `/api/contracts/${id}` })
      if (state.preflightError) throw state.preflightError
      state.afterPreflight?.()
      return state.fresh
    }, issueTranche: (id, body) => request(`/api/contracts/${id}/tranches`, body), repayTranche: (id) => request(`/api/tranches/${id}/repay`) },
    '@/shared/api': { ApiError }, '@/shared/lib': format, '@/shared/ui': { Panel, RequestState },
    '../../model/use-tranche-mutation': model, [`./${kind}.module.scss`]: styles,
  })
  let element
  const props = kind === 'IssueTranche' ? { contract: state.latest } : { tranche: state.latest.tranches[0] }
  const h = { state, requests,
    render() { cursor = 0; element = exports[kind](props); return element },
    find(predicate) { return nodes(element).find(predicate) },
    get form() { return this.find((node) => node.type === 'form') },
    html() { return renderToStaticMarkup(element) },
    click(label) {
      const button = this.find((node) => node.type === Button && node.props.children === label)
      assert.ok(button, label); assert.ok(!button.props.disabled, label)
      button.props.onClick(); this.render()
    },
    fill(amount = 12345678) {
      this.find((node) => node.type === AmountInput).props.onChange(null, { value: amount })
      this.render()
    },
    submit() { this.form.props.onSubmit({ preventDefault() {} }); this.render() },
    async settle() { await Promise.all([...pending]); this.render() },
  }
  h.render()
  h.click(kind === 'IssueTranche' ? 'Получить транш' : 'Погасить транш')
  t.after(() => { assert.equal(pending.size, 0) })
  return h
}

test('issuance is amount-only, displays agreed server terms and validates minimum/limit and fixed availability locally', async (t) => {
  const h = harness(t)
  assert.equal(nodes(h.form).filter((node) => node.type === AmountInput).length, 1)
  assert.equal(h.find((node) => node.type === 'select' || node.props.name === 'termDays' || node.props.role === 'combobox'), undefined)
  assert.ok(h.html().includes('Срок транша по договору'))
  assert.ok(h.html().includes('90 дней'))
  assert.ok(h.html().includes('25% годовых'))
  assert.ok(h.html().includes(format.formatDate(contract.trancheTerms.dueDate)))
  assert.ok(!h.html().includes('Выберите срок'))
  assert.ok(!h.html().includes('ориентировочный срок'))
  h.fill(99999); h.submit()
  assert.ok(h.html().includes('От ')); assert.equal(h.requests.length, 0)
  h.fill(40000001); h.submit()
  assert.ok(h.html().includes('Не больше')); assert.equal(h.requests.length, 0)
  h.state.latest.trancheTerms.available = false
  h.render()
  assert.equal(h.find((node) => node.type === Button && node.props.type === 'submit').props.disabled, true)
  assert.ok(h.html().includes(entity.contractIssueBlockedLabels.CONTRACT_ENDING))
  h.fill(100000); h.submit()
  assert.equal(h.requests.length, 0)
  h.state.latest.trancheTerms.available = true
  h.state.latest.trancheTerms.ratePercent = null
  h.render(); h.submit()
  assert.equal(h.find((node) => node.type === Button && node.props.type === 'submit').props.disabled, true)
  assert.ok(h.html().includes(entity.contractIssueBlockedLabels.RATE_UNAVAILABLE))
  assert.equal(h.requests.length, 0)
})

test('two synchronous submits issue one tranche, preflight terms and send rubles without internal confirmation fields', async (t) => {
  const h = harness(t)
  h.fill()
  const submit = h.form.props.onSubmit
  submit({ preventDefault() {} }); submit({ preventDefault() {} })
  await h.settle()
  assert.deepEqual(plain(h.requests), [{ url: '/api/contracts/9' },
    { url: '/api/contracts/9/tranches', body: { amount: 123456.78 } }])
  assert.ok(h.html().includes('Транш получен'))
  assert.ok(h.html().includes('90 дней'))
  assert.deepEqual(h.state.invalidations, [{ queryKey: ['client', 1] }])
})

test('a changed fixed duration, agreed rate or server repayment date requires a new snapshot review instead of POST', async (t) => {
  for (const field of ['termDays', 'ratePercent', 'dueDate']) {
    const h = harness(t)
    h.fill()
    h.state.fresh.trancheTerms[field] = field === 'termDays' ? 60 : field === 'ratePercent' ? 26 : '2027-01-24'
    h.submit(); await h.settle()
    assert.equal(h.requests.length, 1)
    assert.ok(h.html().includes('Условия транша обновились'))
    h.submit(); await h.settle()
    assert.deepEqual(plain(h.requests.slice(1)), [{ url: '/api/contracts/9' },
      { url: '/api/contracts/9/tranches', body: { amount: 123456.78 } }])
  }
})

test('fresh preflight blocks fixed terms at maturity or without the agreed rate, plus expiry, overdue and cumulative limits', async (t) => {
  const cases = [
    { issueBlockedReason: 'CONTRACT_ENDING', endDate: '2026-12-01',
      trancheTerms: { ...contract.trancheTerms, available: false } },
    { issueBlockedReason: 'RATE_UNAVAILABLE', trancheTerms: { ...contract.trancheTerms, ratePercent: null } },
    { issueBlockedReason: 'CONTRACT_EXPIRED', status: 'EXPIRED' },
    { issueBlockedReason: 'HAS_OVERDUE_TRANCHE', tranches: [{ ...tranche, status: 'OVERDUE' }] },
    { issueBlockedReason: 'LIMIT_EXHAUSTED', availableLimit: 999 },
  ]
  for (const fresh of cases) {
    const h = harness(t, 'IssueTranche', { fresh: { ...plain(contract), ...fresh, canIssueTranche: false } })
    h.fill(); h.submit(); await h.settle()
    assert.deepEqual(plain(h.requests), [{ url: '/api/contracts/9' }])
    assert.ok(h.html().includes(entity.contractIssueBlockedLabels[fresh.issueBlockedReason]))
    assert.ok(!h.html().includes('Выберите меньший срок'))
    assert.ok(!h.html().includes('выберите другой срок'))
  }
  for (const trancheTerms of [{ ...contract.trancheTerms, available: false }, { ...contract.trancheTerms, ratePercent: null }]) {
    const h = harness(t, 'IssueTranche', { fresh: { ...plain(contract), trancheTerms } })
    h.fill(); h.submit(); await h.settle()
    assert.deepEqual(plain(h.requests), [{ url: '/api/contracts/9' }])
  }
  for (const fresh of [{ minTrancheAmount: 150000 }, { availableLimit: 100000 }]) {
    const h = harness(t, 'IssueTranche', { fresh: { ...plain(contract), ...fresh } })
    h.fill(); h.submit(); await h.settle()
    assert.deepEqual(plain(h.requests), [{ url: '/api/contracts/9' }])
  }
})

test('stale or failed GET conditions never submit the amount-only POST', async (t) => {
  for (const overrides of [{ fetching: true }, { queryError: new ApiError(0, 'NETWORK_ERROR') }]) {
    const h = harness(t, 'IssueTranche', overrides)
    h.fill(); h.submit(); await h.settle()
    assert.equal(h.requests.length, 0)
  }
  const h = harness(t, 'IssueTranche', { preflightError: new ApiError(0, 'NETWORK_ERROR') })
  h.fill(); h.submit(); await h.settle()
  assert.deepEqual(plain(h.requests), [{ url: '/api/contracts/9' }])
})

test('all required backend errors are readable and never trigger automatic issuance retry', async (t) => {
  for (const code of ['CONTRACT_NOT_ACTIVE', 'CONTRACT_EXPIRED', 'HAS_OVERDUE_TRANCHE',
    'TRANCHE_AMOUNT_TOO_SMALL', 'LIMIT_EXCEEDED', 'LIMIT_EXHAUSTED', 'CONTRACT_ENDING', 'TRANCHE_EXCEEDS_CONTRACT', 'RATE_UNAVAILABLE']) {
    const h = harness(t, 'IssueTranche', { error: new ApiError(422, code) })
    h.fill(); h.submit(); await h.settle()
    assert.ok(h.html().includes(errorModel.getTrancheErrorMessage(h.state.error)))
    assert.equal(h.requests.filter((request) => request.url.endsWith('/tranches')).length, 1)
  }
})

test('an uncertain POST cannot be repeated, even after close/reopen, until a successful explicit contract check', async (t) => {
  const h = harness(t, 'IssueTranche', { error: new ApiError(0, 'NETWORK_ERROR') })
  h.fill(); h.submit(); await h.settle()
  h.submit()
  assert.equal(h.requests.length, 2)
  assert.ok(h.html().includes('Результат выдачи не подтверждён'))
  h.find((node) => node.type === Panel).props.onClose(); h.render()
  h.click('Получить транш')
  assert.ok(h.html().includes('Результат выдачи не подтверждён'))
  h.state.refetchError = new Error('Offline')
  await h.find((node) => node.type === Button && node.props.children === 'Проверить договор').props.onClick()
  h.render(); assert.ok(h.html().includes('Результат выдачи не подтверждён'))
  h.state.refetchError = null
  await h.find((node) => node.type === Button && node.props.children === 'Проверить договор').props.onClick()
  h.render(); h.click('Получить транш')
  assert.ok(!h.html().includes('Результат выдачи не подтверждён'))
  assert.equal(h.requests.length, 2)
})

test('repayment of an expired/overdue tranche sends no body, preserves server interest and prevents double clicks', async (t) => {
  const h = harness(t, 'RepayTranche', {
    latest: { ...plain(contract), status: 'EXPIRED', canIssueTranche: false,
      tranches: [{ ...tranche, status: 'OVERDUE' }] },
    response: { ...tranche, status: 'REPAID', repaidAt: '2026-10-25' },
  })
  const button = h.find((node) => node.type === Button && node.props.children === 'Погасить полностью')
  button.props.onClick(); button.props.onClick()
  await h.settle()
  assert.deepEqual(plain(h.requests), [{ url: '/api/tranches/11/repay' }])
  assert.ok(h.html().includes('Транш погашен'))
  assert.ok(h.html().includes(format.formatMoney(tranche.totalToRepay, { exact: true })))
})

test('a changed session scope or generation blocks a queued financial request and stale cache invalidation', async (t) => {
  for (const field of ['user', 'generation']) {
    const h = harness(t)
    h.fill(); h.submit()
    h.state[field]++
    await h.settle()
    assert.equal(h.requests.length, 0)
    assert.equal(h.state.invalidations.length, 0)
  }
})

test('a session change between preflight and POST never issues a tranche for the new account', async (t) => {
  for (const field of ['user', 'generation']) {
    const h = harness(t)
    h.state.afterPreflight = () => { h.state[field]++ }
    h.fill(); h.submit()
    await h.settle()
    assert.deepEqual(plain(h.requests), [{ url: '/api/contracts/9' }])
    assert.equal(h.state.invalidations.length, 0)
  }
})

test('contract details and list show fixed terms while historical durations, overdue repayment, cumulative limits and documents remain visible', () => {
  const view = { ...plain(contract), status: 'EXPIRED', canIssueTranche: false, issueBlockedReason: 'CONTRACT_EXPIRED',
    trancheTerms: { ...contract.trancheTerms, available: false },
    tranches: [{ ...tranche, status: 'OVERDUE' },
      { ...tranche, id: 22, termDays: 60, ratePercent: 24.75, status: 'REPAID', repaidAt: '2026-10-25' }] }
  let params = { contractId: '9' }
  const Cell = ({ children }) => React.createElement('div', null, children)
  const Icon = () => React.createElement('svg')
  const IconButton = ({ disabled, 'aria-label': label }) => React.createElement('button', { disabled, 'aria-label': label })
  const PureCell = Object.assign(Cell, {
    Content: Cell, Main: Cell, Footer: Cell, FooterButton: Button,
    Text: ({ children, value }) => React.createElement('div', null, children, value),
    Amount: ({ value, minorUnits }) => React.createElement('span', null, format.formatMoney(value / minorUnits, { exact: true })),
  })
  const { ContractOverview } = load('widgets/contract-overview/ui/ContractOverview/ContractOverview.tsx', {
    react: React, 'react-router-dom': { useNavigate: () => () => {}, useParams: () => params },
    '@alfalab/core-components/button': { Button }, '@alfalab/core-components/pure-cell': { PureCell },
    '@alfalab/core-components/icon-button': { IconButton },
    '@alfalab/core-components/status': { Status: ({ children }) => React.createElement('span', null, children) },
    '@alfalab/core-components/tooltip/desktop': { TooltipDesktop: Cell },
    '@alfalab/core-components/typography': { Typography },
    '@alfalab/icons/glyph/dist/ArrowRightMIcon': { ArrowRightMIcon: Icon },
    '@alfalab/icons/glyph/dist/ArrowsCwMIcon': { ArrowsCwMIcon: Icon },
    '@alfalab/icons/glyph/dist/CheckmarkCircleSIcon': { CheckmarkCircleSIcon: Icon },
    '@alfalab/icons/glyph/dist/ClockSIcon': { ClockSIcon: Icon },
    '@/entities/contract': { ...entity, useContract: () => ({ data: view }), useContracts: () => ({ data: [view] }) },
    '@/features/manage-tranches': {
      IssueTranche: ({ contract }) => React.createElement('button', { disabled: !contract.canIssueTranche }, 'Получить транш'),
      RepayTranche: ({ tranche }) => tranche.status !== 'REPAID'
        ? React.createElement('button', null, `Погасить транш № ${tranche.id}`) : null,
    },
    '@/shared/api': { useApiScope: () => 1 }, '@/shared/config': { ROUTES: { credits: '/credits', documents: '/documents' } },
    '@/shared/lib': format, '@/shared/ui': { RequestState }, './ContractOverview.module.scss': styles,
  })
  const html = renderToStaticMarkup(React.createElement(ContractOverview))
  assert.ok(html.includes('Фиксированный срок нового транша</dt><dd>90 дней'))
  assert.ok(html.includes('Согласованная ставка</dt><dd>25% годовых'))
  assert.ok(html.includes(format.formatDate(contract.trancheTerms.dueDate)))
  assert.ok(html.includes('30 дней · 24,5% годовых'))
  assert.ok(html.includes('60 дней · 24,75% годовых'))
  assert.ok(html.includes('Погасить транш № 11'))
  assert.ok(!html.includes('Погасить транш № 22'))
  assert.ok(html.includes(format.formatMoney(tranche.totalToRepay, { exact: true })))
  assert.ok(html.includes('После погашения использованный лимит не восстанавливается'))
  assert.ok(html.includes('Погашение открытых траншей доступно ниже'))
  assert.ok(html.includes('Документы договора'))
  assert.ok(html.includes('aria-label="Обновить договор"'))
  assert.ok(html.includes(entity.contractIssueBlockedLabels.CONTRACT_ENDING))
  params = {}
  const list = renderToStaticMarkup(React.createElement(ContractOverview))
  assert.ok(list.includes('Срок каждого транша'))
  assert.ok(list.includes('90 дней'))
  assert.ok(list.includes('Ставка по договору'))
  assert.ok(list.includes('25% годовых'))
  assert.ok(list.includes('Доступный лимит'))
  assert.ok(list.includes(format.formatMoney(view.availableLimit, { exact: true })))
  assert.ok(list.includes('Договор и транши'))
  assert.ok(list.includes(entity.contractIssueBlockedLabels.CONTRACT_EXPIRED))
})

test('credit summary shows agreed fixed terms and fixed-term date/rate blockers without removing repayment navigation', () => {
  let view = { ...plain(contract), endDate: '2026-12-01', canIssueTranche: false, issueBlockedReason: 'CONTRACT_ENDING',
    trancheTerms: { ...contract.trancheTerms, available: false } }
  let requiredActions = []
  const Icon = () => React.createElement('svg')
  const { CreditSummary } = load('widgets/credit-summary/ui/CreditSummary/CreditSummary.tsx', {
    react: React, 'react-router-dom': { useNavigate: () => () => {} },
    '@alfalab/core-components/button': { Button }, '@alfalab/core-components/typography': { Typography },
    '@alfalab/icons/glyph/dist/ArrowRightMIcon': { ArrowRightMIcon: Icon },
    '@alfalab/icons/glyph/dist/WalletMIcon': { WalletMIcon: Icon },
    '@/entities/dashboard': { useDashboard: () => ({ data: { activeContract: view, requiredActions } }) },
    '@/entities/contract': entity, '@/shared/config': { ROUTES: { credits: '/credits' } },
    '@/shared/lib': format, '@/shared/ui': { Skeleton: () => null }, './CreditSummary.module.scss': styles,
  })
  const render = () => renderToStaticMarkup(React.createElement(CreditSummary))
  let html = render()
  assert.ok(html.includes('Фиксированный срок траншей</dt><dd>90 дней'))
  assert.ok(html.includes('Согласованная ставка</dt><dd>25% годовых'))
  assert.ok(html.includes(entity.contractIssueBlockedLabels.CONTRACT_ENDING))
  assert.ok(html.includes('Лимит расходуется на общую сумму всех траншей'))
  assert.ok(!html.includes('меньший срок'))
  view = { ...view, issueBlockedReason: 'RATE_UNAVAILABLE', trancheTerms: { ...view.trancheTerms, available: true, ratePercent: null } }
  html = render()
  assert.ok(html.includes(entity.contractIssueBlockedLabels.RATE_UNAVAILABLE))
  assert.ok(!html.includes('null%'))
  view = { ...view, status: 'EXPIRED', issueBlockedReason: 'CONTRACT_EXPIRED' }
  requiredActions = [{ code: 'REPAY_TRANCHE', title: 'Погасить транш' }]
  html = render()
  assert.ok(html.includes(entity.contractIssueBlockedLabels.CONTRACT_EXPIRED))
  assert.ok(html.includes('Погасить транши'))
})
