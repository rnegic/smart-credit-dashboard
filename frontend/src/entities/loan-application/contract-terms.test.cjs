const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const ts = require('typescript')

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

test('signed offer dates and contract duration survive client and bank parsing', () => {
  const signed = { ...offer, status: 'ACCEPTED', contractTermMonths: 6,
    contractStart: '2026-10-25', contractEnd: '2027-04-25' }
  for (const schema of [applicationViewSchema, bankApplicationViewSchema]) {
    const result = schema.parse({ ...application, status: 'ACCEPTED', offer: signed }).offer
    assert.equal(result.contractTermMonths, 6)
    assert.equal(result.contractStart, '2026-10-25')
    assert.equal(result.contractEnd, '2027-04-25')
    assert.equal(result.termDays, 60)
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
