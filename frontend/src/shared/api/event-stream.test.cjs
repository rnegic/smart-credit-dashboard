const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const ts = require('typescript')

const root = path.resolve(__dirname, '../..')

function loadClient(session, EventSource) {
  const file = path.join(root, 'shared/api/client.ts')
  const source = readFileSync(file, 'utf8').replace(
    /const baseUrl =\s*\(import\.meta\.env[\s\S]*?\) \?\? ''/,
    "const baseUrl = ''",
  )
  assert.ok(!source.includes('import.meta.env'))
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2023,
    },
  }).outputText
  const module = { exports: {} }
  vm.runInNewContext(
    `(function(require, module, exports) { ${compiled}\n})`,
    { AbortSignal, EventSource, Headers, fetch, setTimeout, clearTimeout },
    { filename: file },
  )((id) => {
    if (id === 'zod') return require('zod')
    if (id === './session-lifecycle') return session
    throw new Error(`Unexpected dependency: ${id}`)
  }, module, module.exports)
  return module.exports
}

class FakeEventSource {
  static CLOSED = 2
  static instances = []

  constructor(url, options) {
    this.url = url
    this.options = options
    this.readyState = 1
    this.closed = false
    this.listeners = new Map()
    FakeEventSource.instances.push(this)
  }

  addEventListener(name, listener) {
    const listeners = this.listeners.get(name) ?? []
    listeners.push(listener)
    this.listeners.set(name, listeners)
  }

  emit(name, data) {
    for (const listener of this.listeners.get(name) ?? []) listener({ data })
  }

  close() {
    this.closed = true
    this.readyState = FakeEventSource.CLOSED
  }
}

function environment() {
  const sessionController = new AbortController()
  const state = { generation: 0, switching: false }
  return {
    state,
    sessionController,
    api: loadClient(
      {
        expireSession() {},
        getSessionGeneration: () => state.generation,
        getSessionSignal: () => sessionController.signal,
        hasActiveSessionChange: () => false,
        isSessionSwitching: () => state.switching,
        syncSessionChanges() {},
      },
      FakeEventSource,
    ),
  }
}

test('SSE uses session cookies, named events and closes on a session abort', () => {
  FakeEventSource.instances = []
  const { api, sessionController } = environment()
  const events = []
  const close = api.apiEventStream('/api/notifications/stream', {
    events: {
      connected: (data) => events.push(['connected', data]),
      notification: (data) => events.push(['notification', data]),
    },
    onError: (error) => assert.fail(error.message),
  })
  const source = FakeEventSource.instances[0]
  assert.equal(source.url, '/api/notifications/stream')
  assert.equal(source.options.withCredentials, true)
  source.emit('connected', 'ok')
  source.emit('notification', '{"id":1}')
  assert.deepEqual(events, [
    ['connected', 'ok'],
    ['notification', '{"id":1}'],
  ])
  sessionController.abort()
  assert.equal(source.closed, true)
  source.emit('notification', '{"id":2}')
  assert.equal(events.length, 2)
  close()
})

test('a changed authentication generation fences late SSE events', () => {
  FakeEventSource.instances = []
  const { api, state } = environment()
  let received = 0
  api.apiEventStream('/api/notifications/stream', {
    events: { notification: () => received++ },
    onError: (error) => assert.fail(error.message),
  })
  const source = FakeEventSource.instances[0]
  state.generation++
  source.emit('notification', '{"id":1}')
  assert.equal(received, 0)
  assert.equal(source.closed, true)
})
