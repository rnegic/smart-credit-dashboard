const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

const filename = path.join(__dirname, 'model/queue.ts')
const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2023,
  },
})
const exported = {}
vm.runInNewContext(compiled.outputText, { exports: exported }, { filename })
const { getVisibleApplications } = exported

const applications = [
  { id: 1, companyName: 'ООО Берег', inn: '7700000001', amount: 2000000,
    status: 'IN_REVIEW', createdAt: '2026-10-20T12:00:00Z',
    recommendation: { decision: 'DECLINED' } },
  { id: 2, companyName: 'ИП Анна', inn: '7700000002', amount: 500000,
    status: 'OFFER_READY', createdAt: '2026-10-23T12:00:00Z' },
  { id: 3, companyName: 'ООО Альфа', inn: '7700000003', amount: 10000000,
    status: 'DECLINED', createdAt: '2026-10-22T12:00:00Z' },
  { id: 4, companyName: 'ООО Вектор', inn: '7700000004', amount: 1500000,
    status: 'ACCEPTED', createdAt: '2026-10-21T12:00:00Z' },
  { id: 5, companyName: 'ИП Борис', inn: '7700000005', amount: 90000,
    status: 'IN_REVIEW', createdAt: '2026-10-24T12:00:00Z',
    recommendation: { decision: 'APPROVED' } },
]

function ids(search = '', status = 'ALL', sort = 'review', items = applications) {
  return Array.from(getVisibleApplications(items, search, status, sort), (item) => item.id)
}

test('review sorting puts the oldest undecided applications first, not scoring decisions', () => {
  assert.deepEqual(ids(), [1, 5, 2, 3, 4])
})

test('date, amount and Russian company sorting use the actual field values', () => {
  assert.deepEqual(ids('', 'ALL', 'newest'), [5, 2, 3, 4, 1])
  assert.deepEqual(ids('', 'ALL', 'oldest'), [1, 4, 3, 2, 5])
  assert.deepEqual(ids('', 'ALL', 'amount-desc'), [3, 1, 4, 2, 5])
  assert.deepEqual(ids('', 'ALL', 'amount-asc'), [5, 2, 4, 1, 3])
  assert.deepEqual(ids('', 'ALL', 'company'), [2, 5, 3, 1, 4])
})

test('each status filters independently of the scoring recommendation', () => {
  assert.deepEqual(ids('', 'IN_REVIEW'), [1, 5])
  assert.deepEqual(ids('', 'OFFER_READY'), [2])
  assert.deepEqual(ids('', 'ACCEPTED'), [4])
  assert.deepEqual(ids('', 'DECLINED'), [3])
})

test('search supports company words, case, repeated spaces, INN and application numbers', () => {
  assert.deepEqual(ids('  ООО   альфа  '), [3])
  assert.deepEqual(ids('7700000005'), [5])
  assert.deepEqual(ids('№ 2'), [2])
  assert.deepEqual(ids('#2'), [2])
  assert.deepEqual(ids('Анна 7700000002'), [2])
})

test('explicit application numbers do not match digits inside INNs or company names', () => {
  const items = [...applications, { ...applications[0], id: 22, companyName: 'Компания 2' }]
  assert.deepEqual(ids('№2', 'ALL', 'review', items), [2])
})

test('search and status compose, and whitespace-only input leaves the queue unchanged', () => {
  assert.deepEqual(ids('ООО', 'DECLINED'), [3])
  assert.deepEqual(ids('Анна', 'IN_REVIEW'), [])
  assert.deepEqual(ids('несуществующая компания'), [])
  assert.deepEqual(ids('   '), ids())
  assert.deepEqual(ids('', 'ALL', 'review', []), [])
})

test('date sorting accounts for timezone offsets and uses IDs for ties', () => {
  const items = [
    { ...applications[0], id: 10, createdAt: '2026-10-20T10:00:00+03:00' },
    { ...applications[0], id: 11, createdAt: '2026-10-20T08:00:00Z' },
    { ...applications[0], id: 12, createdAt: '2026-10-20T08:00:00Z' },
  ]
  assert.deepEqual(ids('', 'ALL', 'oldest', items), [10, 11, 12])
  assert.deepEqual(ids('', 'ALL', 'newest', items), [12, 11, 10])
  assert.deepEqual(ids('', 'ALL', 'review', items), [10, 11, 12])
  assert.deepEqual(ids('', 'ALL', 'amount-desc', items), [12, 11, 10])
})

test('filtering and sorting never mutate cached records or their original order', () => {
  const items = Object.freeze(applications.map((item) => Object.freeze({ ...item })))
  const originalIds = items.map((item) => item.id)
  for (const sort of ['review', 'newest', 'oldest', 'amount-desc', 'amount-asc', 'company']) {
    const result = getVisibleApplications(items, '', 'ALL', sort)
    assert.notEqual(result, items)
    assert.equal(result.length, items.length)
    assert.ok(result.every((item) => items.includes(item)))
  }
  assert.deepEqual(items.map((item) => item.id), originalIds)
})

const sourceRoot = path.resolve(__dirname, '../..')
const css = { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) }

function loadFrontend(relative, dependencies) {
  const filename = path.join(sourceRoot, relative)
  const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX },
  })
  const module = { exports: {} }
  vm.runInNewContext(`(function(require, module, exports) { ${compiled.outputText}\n})`, { Error }, { filename })((id) => {
    if (id === 'react/jsx-runtime') return require(id)
    assert.ok(Object.hasOwn(dependencies, id), `Unexpected dependency: ${id}`)
    return dependencies[id]
  }, module, module.exports)
  return module.exports
}

const loanEntity = loadFrontend('entities/loan-application/index.ts', {
  zod: require('zod'), '@tanstack/react-query': {}, '@/shared/api': {}, './get-application-progress': {},
})
const decisionEntity = loadFrontend('widgets/bank-workspace/model/decision.ts', {
  zod: require('zod'), '@/entities/loan-application': loanEntity,
})
const Button = ({ children, disabled }) => React.createElement('button', { disabled }, children)
const Input = ({ label }) => React.createElement('span', null, label)
const Select = ({ label, hint, error }) => React.createElement('div', null, label, hint, error)
const Textarea = ({ label }) => React.createElement('span', null, label)
const ApplicationStatus = ({ status }) => React.createElement('span', null, loanEntity.applicationStatusLabels[status])
const DecisionStatus = ({ decision }) => React.createElement('span', null, loanEntity.applicationDecisionLabels[decision])
const display = { formatMoney: (value) => String(value), formatDate: (value) => value }
const bankView = {
  id: 7, companyName: 'Test company', inn: '7700000001', legalForm: 'IP',
  amount: 500000, termDays: 60, contractTermMonths: 24, rate: 18.5,
  finalRate: 18.5, status: 'IN_REVIEW', decision: null,
  recommendation: { finalRate: 18.5, amount: 400000, decision: 'APPROVED', reason: 'Good history' },
  purpose: 'Suppliers', internalScore: null, riskClass: null, scoring: null,
  aiComment: null, officerComment: null, createdAt: '2026-10-25T12:00:00Z',
}

function descendants(value) {
  return React.Children.toArray(value).flatMap((element) => React.isValidElement(element)
    ? [element, ...descendants(element.props.children)] : [])
}

function decisionForm() {
  const states = []
  let cursor = 0
  let options
  const h = { requests: [], decisions: [], props: { application: bankView, disabled: false, pending: false } }
  const useState = (initial) => {
    const index = cursor++
    if (!states[index]) states[index] = { value: typeof initial === 'function' ? initial() : initial }
    return [states[index].value, (next) => { states[index].value = typeof next === 'function' ? next(states[index].value) : next }]
  }
  const dependencies = {
    react: { ...React, useId: () => 'decision', useState, useRef: (initial) => useState(() => ({ current: initial }))[0] },
    '@alfalab/core-components/button': { Button }, '@alfalab/core-components/input': { Input },
    '@alfalab/core-components/select': { Select }, '@alfalab/core-components/textarea': { Textarea },
    '@tanstack/react-query': { useMutation(next) {
      options = next
      return { isPending: false, isError: false, reset() {}, mutate() { h.generated = options.mutationFn().then(options.onSuccess) } }
    } },
    '@/entities/loan-application': loanEntity, '@/shared/lib': display,
    '@/shared/api': { async apiRequest(url, schema, request) {
      h.requests.push({ url, body: JSON.parse(request.body) })
      return schema.parse({ comment: 'Explanation' })
    } },
    '../../model/decision': decisionEntity, './DecisionForm.module.scss': css,
  }
  for (const name of ['ArrowsRightLeftMIcon', 'CheckmarkMIcon', 'CrossMIcon', 'MagicWandMIcon']) {
    dependencies[`@alfalab/icons/glyph/dist/${name}`] = { [name]: () => null }
  }
  const { DecisionForm } = loadFrontend('widgets/bank-workspace/ui/DecisionForm/DecisionForm.tsx', dependencies)
  h.render = () => { cursor = 0; h.element = DecisionForm({ ...h.props, onSubmit: (value) => h.decisions.push(value) }) }
  h.field = (name) => descendants(h.element).find((element) => element.props.name === name)
  h.action = (value) => {
    descendants(h.element).find((element) => element.props.name === 'action' && element.props.value === value).props.onChange()
    h.render()
  }
  h.change = (name, value) => {
    const element = h.field(name)
    if (element.type === Select) element.props.onChange({ selected: value ? { key: value } : null })
    else element.props.onChange(null, { value })
    h.render()
  }
  h.generate = async () => {
    descendants(h.element).find((element) => element.type === Button && element.props.type === 'button').props.onClick()
    await h.generated
    h.render()
    return h.requests.at(-1).body
  }
  h.submit = () => { h.element.props.onSubmit({ preventDefault() {} }); h.render() }
  h.render()
  return h
}

test('alternative decisions validate 6/12/24 contract months and omit empty overrides', () => {
  const value = { action: 'OFFER_ALTERNATIVE', comment: 'Reason', amount: '', finalRate: '' }
  for (const months of ['6', '12', '24']) {
    assert.equal(decisionEntity.decisionSchema.parse({ ...value, contractTermMonths: months }).contractTermMonths, Number(months))
  }
  for (const months of ['', ' ', undefined]) {
    assert.equal(decisionEntity.decisionSchema.parse({ ...value, contractTermMonths: months }).contractTermMonths, undefined)
  }
  for (const months of ['3', '18', '30', '12.5', 12, null]) {
    const result = decisionEntity.decisionSchema.safeParse({ ...value, contractTermMonths: months })
    assert.equal(result.success, false)
    assert.equal(result.error.issues[0].path[0], 'contractTermMonths')
  }
  for (const action of ['APPROVE', 'DECLINE']) {
    const result = decisionEntity.decisionSchema.parse({ ...value, action, contractTermMonths: '6' })
    assert.ok(!Object.hasOwn(result, 'contractTermMonths'))
  }
  for (const action of ['APPROVE', 'OFFER_ALTERNATIVE', 'DECLINE']) {
    const result = decisionEntity.decisionSchema.parse({ ...value, action, termDays: '90' })
    assert.ok(!Object.hasOwn(result, 'termDays'), action)
  }
})

test('bank contract selector uses Alfa props and retains the read-only first-step tranche term', () => {
  const h = decisionForm()
  h.action('OFFER_ALTERNATIVE')
  const selector = h.field('contractTermMonths').props
  assert.deepEqual(Array.from(selector.options, (option) => option.key), ['6', '12', '24'])
  assert.equal(selector.selected, null)
  assert.ok(selector.hint.includes('24 мес. из заявки'))
  assert.equal(selector.labelView, 'outer')
  assert.equal(selector.block, true)
  assert.equal(h.field('amount').props.label, 'Изменить лимит договора')
  assert.equal(h.field('termDays'), undefined)
  const html = renderToStaticMarkup(h.element)
  assert.ok(html.includes('Срок транша: <strong>60 дней</strong>'))
  assert.ok(html.includes('Выбран клиентом на первом шаге заявки и не меняется банком'))
  assert.doesNotMatch(html, /ориентировоч/i)
  assert.equal(descendants(h.element).filter((element) => element.type === Select).length, 1)
  h.props.pending = true
  h.render()
  assert.equal(h.field('contractTermMonths').props.disabled, true)
})

test('comment suggestions carry the same optional contract term only for alternative offers', async () => {
  const h = decisionForm()
  h.action('OFFER_ALTERNATIVE')
  assert.deepEqual(await h.generate(), { action: 'OFFER_ALTERNATIVE' })
  h.change('contractTermMonths', '6')
  h.change('amount', '300000')
  h.change('finalRate', '19,5')
  assert.deepEqual(await h.generate(), { action: 'OFFER_ALTERNATIVE', amount: 300000, contractTermMonths: 6, finalRate: 19.5 })
  h.field('contractTermMonths').props.onClear()
  h.render()
  assert.ok(!Object.hasOwn(await h.generate(), 'contractTermMonths'))
  h.change('contractTermMonths', '24')
  h.action('APPROVE')
  assert.deepEqual(await h.generate(), { action: 'APPROVE', finalRate: 19.5 })
  h.action('DECLINE')
  assert.deepEqual(await h.generate(), { action: 'DECLINE' })
  assert.ok(h.requests.every((request) => !Object.hasOwn(request.body, 'termDays')))
  assert.ok(h.requests.every((request) => request.url === '/api/bank/applications/7/comment-suggestion'))
})

test('bank submission rejects and focuses invalid contract terms, then sends a validated override', () => {
  const h = decisionForm()
  h.action('OFFER_ALTERNATIVE')
  h.change('comment', 'Reason')
  h.change('contractTermMonths', '18')
  let focused = 0
  h.field('contractTermMonths').props.ref.current = { focus() { focused++ } }
  h.submit()
  assert.equal(h.decisions.length, 0)
  assert.equal(focused, 1)
  assert.ok(h.field('contractTermMonths').props.error.includes('6, 12 или 24'))
  h.change('contractTermMonths', '12')
  h.submit()
  assert.equal(h.decisions.length, 1)
  assert.equal(h.decisions[0].contractTermMonths, 12)
  assert.ok(!Object.hasOwn(h.decisions[0], 'termDays'))
})

test('bank queue shows contract limit, requested duration, fixed tranche term and signed status separately', () => {
  const dependencies = {
    react: { ...React, useId: () => 'queue', useState: (value) => [value, () => {}], useMemo: (callback) => callback() },
    '@alfalab/core-components/button': { Button }, '@alfalab/core-components/icon-button': { IconButton: Button },
    '@alfalab/core-components/input': { Input }, '@alfalab/core-components/select': { Select },
    '@/entities/loan-application': loanEntity, '@/shared/lib': display,
    '../../model/queue': exported, '../ApplicationStatus': { ApplicationStatus }, '../DecisionStatus': { DecisionStatus },
    './ApplicationQueue.module.scss': css,
  }
  for (const name of ['ArrowRightMIcon', 'ArrowsUpDownMIcon', 'CheckmarkCircleSIcon', 'ClockSIcon',
    'CrossCircleSIcon', 'DocumentLinesLineSIcon', 'MagnifierMIcon']) {
    dependencies[`@alfalab/icons/glyph/dist/${name}`] = { [name]: () => null }
  }
  const { ApplicationQueue } = loadFrontend('widgets/bank-workspace/ui/ApplicationQueue/ApplicationQueue.tsx', dependencies)
  const html = renderToStaticMarkup(React.createElement(ApplicationQueue, {
    applications: [{ ...bankView, status: 'ACCEPTED' }], disabled: false, onSelect() {},
  }))
  assert.ok(html.includes('Лимит / сроки'))
  assert.ok(html.includes('Договор: 24 мес.'))
  assert.ok(html.includes('Срок транша: 60 дней'))
  assert.ok(html.includes('Договор подписан'))
  assert.ok(!html.includes('Сумма / срок'))
  assert.doesNotMatch(html, /ориентировоч/i)
})

test('bank details retain the first-step tranche term, approved rate and nullable contract dates', () => {
  const view = { ...bankView, status: 'ACCEPTED', decision: 'APPROVED',
    offer: { id: 9, amount: 400000, termDays: bankView.termDays, contractTermMonths: 6, finalRate: 19.5,
      monthlyPayment: 140000, validUntil: '2026-11-08', status: 'ACCEPTED',
      contractStart: '2026-10-25', contractEnd: '2027-04-25' } }
  const queryValue = { isPending: false, isError: false, isFetching: false, dataUpdatedAt: 0 }
  const dependencies = {
    react: { ...React, useId: () => 'workspace', useRef: () => ({ current: null }),
      useState: (value) => [value === null ? { userId: 1, applicationId: 7 } : value, () => {}] },
    '@tanstack/react-query': { useQuery: ({ queryKey }) => ({ ...queryValue,
      data: queryKey.length === 3 ? [view] : queryKey.length === 4 ? view : null }),
      useQueryClient: () => ({}), useMutation: () => ({ isPending: false, isSuccess: false, isError: false }) },
    '@alfalab/core-components/button': { Button }, '@alfalab/core-components/icon-button': { IconButton: Button },
    '@alfalab/core-components/tooltip/desktop': { TooltipDesktop: ({ children }) => children },
    '@/entities/session': { useSession: () => ({ data: { userId: 1, role: 'BANK_OFFICER' } }) },
    '@/entities/application-form': {}, '@/entities/company': { getCompanyAge: () => null, getIndustryGroup: () => null },
    '@/entities/loan-application': loanEntity, '@/shared/api': { getSessionGeneration: () => 0 }, '@/shared/lib': display,
    '@/shared/ui': { Panel: ({ children }) => React.createElement('aside', null, children), Skeleton: () => null },
    '../ApplicationQueue': { ApplicationQueue: () => null }, '../ApplicationStatus': { ApplicationStatus },
    '../DecisionStatus': { DecisionStatus }, '../DecisionForm': {}, './BankWorkspaceSkeleton': {}, './BankWorkspace.module.scss': css,
  }
  for (const name of ['ArrowsCwMIcon', 'CalendarLineMIcon', 'DocumentLinesMIcon', 'InformationCircleMIcon', 'WalletLineMIcon']) {
    dependencies[`@alfalab/icons/glyph/dist/${name}`] = { [name]: () => null }
  }
  const { BankWorkspace } = loadFrontend('widgets/bank-workspace/ui/BankWorkspace/BankWorkspace.tsx', dependencies)
  const html = renderToStaticMarkup(React.createElement(BankWorkspace))
  assert.ok(html.includes('<dt>Запрошенный срок договора</dt><dd>24 мес.</dd>'))
  assert.ok(html.includes('<dt>Срок транша в заявке</dt><dd>60 дней</dd>'))
  assert.ok(html.includes('<dt>Срок транша</dt><dd>60 дней</dd>'))
  assert.ok(html.includes('<dt>Ставка по договору, % годовых</dt><dd>19.5%</dd>'))
  assert.ok(html.includes('<dt>Срок договора</dt><dd>6 мес.</dd>'))
  assert.ok(html.includes('<dt>Начало договора</dt><dd>2026-10-25</dd>'))
  assert.ok(html.includes('<dt>Окончание договора</dt><dd>2027-04-25</dd>'))
  assert.ok(html.includes('весь лимит одним траншем'))
  assert.ok(html.includes('не означает выдачу денег'))
  assert.ok(html.includes('не выбираются при получении траншей'))
  assert.ok(html.includes('не график погашения'))
  assert.doesNotMatch(html, /ориентировоч|Срок и ставка каждого транша определяются отдельно/i)
  Object.assign(view.offer, { contractTermMonths: null, contractStart: null, contractEnd: null })
  const legacy = renderToStaticMarkup(React.createElement(BankWorkspace))
  assert.ok(legacy.includes('<dt>Срок договора</dt><dd>Не указан</dd>'))
  assert.ok(!legacy.includes('<dt>Начало договора</dt>'))
  assert.ok(!legacy.includes('<dt>Окончание договора</dt>'))
})
