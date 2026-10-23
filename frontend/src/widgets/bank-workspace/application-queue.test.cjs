const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const ts = require('typescript')

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
