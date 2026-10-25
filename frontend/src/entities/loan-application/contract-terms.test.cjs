const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

const progressFilename = path.join(__dirname, 'get-application-progress.ts')
const progressCompiled = ts.transpileModule(readFileSync(progressFilename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
})
const progressExports = {}
vm.runInNewContext(progressCompiled.outputText, { exports: progressExports }, { filename: progressFilename })

const filename = path.join(__dirname, 'index.ts')
const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
})
const moduleValue = { exports: {} }
vm.runInNewContext(`(function(require, module, exports) { ${compiled.outputText}\n})`, {}, { filename })((id) => {
  if (id === 'zod') return require('zod')
  if (id === './get-application-progress') return progressExports
  assert.ok(['@tanstack/react-query', '@/shared/api'].includes(id))
  return {}
}, moduleValue, moduleValue.exports)
const {
  applicationSchema, applicationViewSchema, bankApplicationViewSchema,
  offerSchema, contractTermMonthsSchema, applicationStatusLabels, getApplicationProgress,
} = moduleValue.exports

const offer = {
  id: 9, amount: 500000, termDays: 60, contractTermMonths: 12,
  finalRate: 18.5, monthlyPayment: 254500, validUntil: '2026-11-08',
  status: 'ACTIVE', contractStart: null, contractEnd: null,
}
const application = {
  id: 7, amount: 500000, termDays: 60, contractTermMonths: 12,
  rate: 18.5, purpose: 'Suppliers', status: 'OFFER_READY', decision: 'APPROVED',
  finalRate: 18.5, createdAt: '2026-10-25T12:00:00Z', companyName: 'Test company',
  inn: '7700000001', legalForm: 'IP', businessTask: null, internalScore: null,
  riskClass: null, aiComment: null, recommendation: null, officerComment: null,
  scoring: null, offer,
}

test('application contract duration is required and retained in client and bank views', () => {
  for (const schema of [applicationViewSchema, bankApplicationViewSchema]) {
    for (const contractTermMonths of [6, 12, 24]) {
      assert.equal(schema.parse({ ...application, contractTermMonths }).contractTermMonths, contractTermMonths)
    }
    const { contractTermMonths, ...missing } = application
    assert.equal(schema.safeParse(missing).success, false)
    assert.equal(schema.safeParse({ ...application, contractTermMonths: null }).success, false)
    assert.equal(contractTermMonths, 12)
  }
})

test('minimal summaries preserve nullable legacy durations without weakening full ApplicationView validation', () => {
  assert.equal(applicationSchema.parse({ ...application, contractTermMonths: null }).contractTermMonths, null)
  assert.equal(applicationSchema.parse(application).contractTermMonths, 12)
  const missing = { ...application }
  delete missing.contractTermMonths
  assert.equal(applicationSchema.safeParse(missing).success, false)
  assert.equal(applicationViewSchema.safeParse({ ...application, contractTermMonths: null }).success, false)
})

test('public Application type accepts null while full view types require 6/12/24', () => {
  const configPath = path.resolve(__dirname, '../../../tsconfig.app.json')
  const config = ts.readConfigFile(configPath, ts.sys.readFile)
  assert.equal(config.error, undefined)
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath))
  assert.equal(parsed.errors.length, 0)
  const program = ts.createProgram([filename], parsed.options)
  const checker = program.getTypeChecker()
  const source = program.getSourceFile(filename)
  const exportedTypes = checker.getExportsOfModule(checker.getSymbolAtLocation(source))
  for (const name of ['Application', 'ApplicationView', 'BankApplicationView']) {
    const exported = exportedTypes.find((symbol) => symbol.name === name)
    assert.ok(exported, name)
    const type = checker.getDeclaredTypeOfSymbol(exported)
    const property = checker.getPropertyOfType(type, 'contractTermMonths')
    assert.ok(property, name)
    assert.equal(property.flags & ts.SymbolFlags.Optional, 0, name)
    const term = checker.getTypeOfSymbolAtLocation(property, source)
    const members = term.isUnion() ? term.types : [term]
    assert.equal(members.some((member) => member.flags & ts.TypeFlags.Null), name === 'Application', name)
    assert.equal(members.length, name === 'Application' ? 4 : 3, checker.typeToString(term))
    assert.deepEqual(members.filter((member) => member.flags & ts.TypeFlags.NumberLiteral)
      .map((member) => member.value).sort((first, second) => first - second), [6, 12, 24])
  }
})

test('contract duration accepts only backend product values without coercion', () => {
  for (const value of [0, 3, 9, 18, 30, 12.5, '12', undefined, null]) {
    assert.equal(contractTermMonthsSchema.safeParse(value).success, false, String(value))
    assert.equal(applicationViewSchema.safeParse({ ...application, contractTermMonths: value }).success, false)
  }
})

test('legacy offer contract metadata is nullable but never optional or defaulted', () => {
  const legacy = { ...offer, contractTermMonths: null, contractStart: null, contractEnd: null }
  const result = offerSchema.parse(legacy)
  for (const field of ['contractTermMonths', 'contractStart', 'contractEnd']) {
    assert.equal(result[field], null)
    const missing = { ...legacy }
    delete missing[field]
    assert.equal(offerSchema.safeParse(missing).success, false, field)
    assert.equal(offerSchema.safeParse({ ...legacy, [field]: undefined }).success, false, field)
  }
  assert.equal(applicationViewSchema.parse({ ...application, offer: legacy }).offer.contractTermMonths, null)
})

test('signed alternative offers retain first-step tranche days and agreed rate in client and bank views', () => {
  for (const termDays of [30, 60, 90]) {
    const signed = { ...offer, status: 'ACCEPTED', amount: 400000, termDays,
      contractTermMonths: 6, finalRate: 19.5, contractStart: '2026-10-25', contractEnd: '2027-04-25' }
    for (const schema of [applicationViewSchema, bankApplicationViewSchema]) {
      const result = schema.parse({ ...application, termDays, status: 'ACCEPTED',
        decision: 'ALTERNATIVE_OFFER', offer: signed })
      assert.equal(result.contractTermMonths, 12)
      assert.equal(result.offer.contractTermMonths, 6)
      assert.equal(result.offer.contractStart, '2026-10-25')
      assert.equal(result.offer.contractEnd, '2027-04-25')
      assert.equal(result.offer.termDays, result.termDays)
      assert.equal(result.offer.finalRate, 19.5)
      assert.equal(result.offer.amount, 400000)
    }
  }
})

test('offer metadata rejects invalid months, invalid calendar dates and timestamps', () => {
  for (const contractTermMonths of [18, 12.5, '6']) {
    assert.equal(offerSchema.safeParse({ ...offer, contractTermMonths }).success, false)
  }
  for (const field of ['contractStart', 'contractEnd']) {
    for (const value of ['2026-02-30', '2026-13-01', '2026-1-01', '2026-10-25T12:00:00Z', 20261025]) {
      assert.equal(offerSchema.safeParse({ ...offer, [field]: value }).success, false)
    }
  }
})

test('application ACCEPTED labels a signed contract rather than acceptance or issuance', () => {
  assert.equal(applicationStatusLabels.ACCEPTED,
    '\u0414\u043e\u0433\u043e\u0432\u043e\u0440 \u043f\u043e\u0434\u043f\u0438\u0441\u0430\u043d')
  assert.notEqual(applicationStatusLabels.ACCEPTED, applicationStatusLabels.SIGNATURE_PENDING)
})

test('ACCEPTED completes all six stages and labels the final stage as tranche access', () => {
  const stages = getApplicationProgress('ACCEPTED')
  assert.deepEqual(Array.from(stages, (stage) => stage.code),
    ['SUBMITTED', 'REVIEW', 'DECISION', 'OFFER', 'SIGNING', 'ISSUED'])
  assert.deepEqual(Array.from(stages, (stage) => stage.state), Array(6).fill('DONE'))
  assert.equal(stages[5].title,
    '\u041f\u043e\u043b\u0443\u0447\u0435\u043d\u0438\u0435 \u0442\u0440\u0430\u043d\u0448\u0435\u0439')
})

test('renaming the final stage leaves review, decision and signing progress unchanged', () => {
  const expected = {
    IN_REVIEW: ['DONE', 'CURRENT', 'PENDING', 'PENDING', 'PENDING', 'PENDING'],
    OFFER_READY: ['DONE', 'DONE', 'CURRENT', 'PENDING', 'PENDING', 'PENDING'],
    DECLINED: ['DONE', 'DONE', 'CURRENT', 'PENDING', 'PENDING', 'PENDING'],
    SIGNATURE_PENDING: ['DONE', 'DONE', 'DONE', 'DONE', 'CURRENT', 'PENDING'],
  }
  for (const [status, states] of Object.entries(expected)) {
    const stages = getApplicationProgress(status)
    assert.deepEqual(Array.from(stages, (stage) => stage.state), states)
    assert.equal(stages[5].code, 'ISSUED')
  }
})

function loadUi(relative, dependencies) {
  const filename = path.resolve(__dirname, '../..', relative)
  const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX },
  })
  const module = { exports: {} }
  vm.runInNewContext(`(function(require, module, exports) { ${compiled.outputText}\n})`, { Error }, { filename })((id) => {
    if (id === 'react' || id === 'react/jsx-runtime') return require(id)
    assert.ok(Object.hasOwn(dependencies, id), `Unexpected dependency: ${id}`)
    return dependencies[id]
  }, module, module.exports)
  return module.exports
}

const Body = ({ children, footer }) => React.createElement('div', null, children, footer)
const Button = ({ children, disabled }) => React.createElement('button', { disabled }, children)
const css = { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) }
const display = { formatMoney: (value) => String(value), formatDate: (value) => value }

test('offers display approved fixed terms and payment examples without a later duration selector', () => {
  const view = { ...application, decision: 'ALTERNATIVE_OFFER',
    offer: { ...offer, amount: 400000, contractTermMonths: 6, finalRate: 19.5 } }
  const { AcceptOffer } = loadUi('features/accept-offer/ui/AcceptOffer/AcceptOffer.tsx', {
    '@tanstack/react-query': { useMutation: () => ({ isPending: false }), useQueryClient: () => ({}) },
    '@alfalab/core-components/button': { Button },
    '@/entities/loan-application': { ...moduleValue.exports,
      useApplications: () => ({ data: [view], isPending: false, isError: false }) },
    '@/shared/api': { useApiScope: () => 1 }, '@/shared/lib': display, '@/shared/ui': { Panel: Body },
    './AcceptOffer.module.scss': css,
  })
  for (const status of ['OFFER_READY', 'SIGNATURE_PENDING', 'ACCEPTED']) {
    view.status = status
    view.offer.status = status === 'OFFER_READY' ? 'ACTIVE' : 'ACCEPTED'
    const html = renderToStaticMarkup(React.createElement(AcceptOffer, {
      application: view, offer: view.offer, open: true, onClose() {}, onViewDocuments() {}, children: null,
    }))
    assert.ok(html.includes('<dt>Срок договора</dt><dd>6 мес.</dd>'))
    assert.ok(html.includes('<dt>Срок транша</dt><dd>60 дней</dd>'))
    assert.ok(html.includes('<dt>Ставка по договору</dt><dd>19,5%'))
    assert.ok(html.includes('Если взять весь лимит одним траншем на 60 дней'))
    assert.ok(html.includes('Пример платежа не является графиком погашения'))
    assert.ok(html.includes('Это точные условия одобренного предложения'))
    assert.ok(html.includes('они не выбираются заново'))
    assert.doesNotMatch(html, /ориентировоч|<select|name="termDays"/i)
  }
})

test('signing displays fixed offer terms without rewriting stored document text or signature stamps', () => {
  const approved = { ...offer, contractTermMonths: 6, finalRate: 19.5 }
  const content = 'Срок по сохранённому документу: 90 дней.\n\nСтавка по сохранённому документу: 21% годовых.'
  const snapshot = {
    applicationId: application.id, offerId: offer.id, documentVersion: 1,
    signedAt: null, signedBy: null, signingAllowed: true, demo: true,
    documents: [{ type: 'CONTRACT', title: 'Договор', content }],
  }
  const Modal = ({ open, children }) => open ? React.createElement('section', null, children) : null
  Modal.Header = ({ title }) => React.createElement('h2', null, title)
  Modal.Content = Modal.Footer = Body
  const dependencies = {
    '@alfalab/core-components/modal': { Modal }, '@alfalab/core-components/button': { Button },
    '@alfalab/core-components/checkbox': { Checkbox: () => null },
    '@/entities/application-document': { documentPackageVersion: (data) => String(data.documentVersion) },
    '@/shared/api': {}, '@/shared/lib': display, '@/shared/ui': { AlfaMark: () => null, Skeleton: () => null },
    '../../model/use-sign-documents': { useSignDocuments: () => ({
      documents: { data: snapshot, isPending: false }, applications: {}, offer: approved,
      sign: { isPending: false }, refresh() {}, uncertain: false,
    }) },
    './SignDocuments.module.scss': css,
  }
  for (const name of ['CheckmarkMIcon', 'DocumentMIcon', 'CrossMIcon']) {
    dependencies[`@alfalab/icons/glyph/dist/${name}`] = { [name]: () => null }
  }
  const { SignDocuments } = loadUi('features/sign-documents/ui/SignDocuments/SignDocuments.tsx', dependencies)
  for (const signed of [false, true]) {
    snapshot.signedAt = signed ? '2026-10-25T12:00:00Z' : null
    snapshot.signedBy = signed ? { fullName: 'Тестовый Предприниматель' } : null
    const html = renderToStaticMarkup(React.createElement(SignDocuments, {
      application: { ...application, status: signed ? 'ACCEPTED' : 'SIGNATURE_PENDING' },
      offer: approved, open: true, onClose() {},
    }))
    assert.ok(html.includes('<dt>Срок транша</dt><dd>60 дней</dd>'))
    assert.ok(html.includes('<dt>Ставка по договору</dt><dd>19,5% годовых</dd>'))
    assert.ok(html.includes('весь лимит одним траншем на 60 дней'))
    assert.ok(html.includes('Это не график погашения'))
    for (const paragraph of content.split('\n\n')) assert.ok(html.includes(`<p>${paragraph}</p>`))
    assert.equal(snapshot.documents[0].content, content)
    assert.equal(html.includes('aria-label="Подпись документа"'), signed)
    if (signed) assert.ok(html.includes('Предложение № 9 · Версия 1'))
    assert.doesNotMatch(html, /ориентировоч|<select|name="termDays"/i)
  }
})
