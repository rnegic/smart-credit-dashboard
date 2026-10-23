const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { test } = require('node:test')
const ts = require('typescript')
const { z } = require('zod')

const root = path.resolve(__dirname, '../..')

function runtime() {
  const slots = []
  let cursor = 0
  let effects = []
  return {
    begin() {
      cursor = 0
    },
    flush() {
      const pending = effects
      effects = []
      pending.forEach((effect) => effect())
    },
    useState(initial) {
      const index = cursor++
      if (!slots[index])
        slots[index] = { value: typeof initial === 'function' ? initial() : initial }
      return [
        slots[index].value,
        (next) => {
          slots[index].value =
            typeof next === 'function' ? next(slots[index].value) : next
        },
      ]
    },
    useEffect(effect, dependencies) {
      const index = cursor++
      const previous = slots[index]
      if (
        previous &&
        dependencies?.every((value, item) =>
          Object.is(value, previous.dependencies[item]),
        )
      )
        return
      const slot = { dependencies }
      slots[index] = slot
      effects.push(() => {
        previous?.cleanup?.()
        slot.cleanup = effect()
      })
    },
  }
}

function loadHook(hooks, dependencies) {
  const file = path.join(
    root,
    'features/read-notifications/model/use-notification-stream.ts',
  )
  const compiled = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2023,
    },
  }).outputText
  const module = { exports: {} }
  vm.runInNewContext(
    `(function(require, module, exports) { ${compiled}\n})`,
    { JSON, setTimeout, clearTimeout },
    { filename: file },
  )((id) => {
    if (id === 'react') return hooks
    if (Object.hasOwn(dependencies, id)) return dependencies[id]
    throw new Error(`Unexpected dependency: ${id}`)
  }, module, module.exports)
  return module.exports.useNotificationStream
}

test('SSE starts after a session transition and restarts for a new generation', () => {
  const hooks = runtime()
  const state = {
    scope: 7,
    session: { role: 'CLIENT', companyId: 3 },
    transition: { generation: 1, switching: true },
  }
  const streams = []
  const cache = {
    invalidateQueries() {},
    setQueryData() {},
  }
  const useNotificationStream = loadHook(hooks, {
    '@tanstack/react-query': { useQueryClient: () => cache },
    '@/entities/notification': {
      notificationSchema: z.object({
        id: z.number(),
        text: z.string(),
        read: z.boolean(),
        createdAt: z.string(),
      }),
    },
    '@/entities/session': {
      sessionKey: ['session'],
      useSession: () => ({ data: state.session }),
    },
    '@/shared/api': {
      useApiScope: () => state.scope,
      useSessionTransition: () => state.transition,
      apiEventStream: (url, options) => {
        const stream = { url, options, closed: false }
        streams.push(stream)
        return () => {
          stream.closed = true
        }
      },
    },
  })

  function render() {
    hooks.begin()
    useNotificationStream()
    hooks.flush()
  }

  render()
  assert.equal(streams.length, 0)

  state.transition = { generation: 2, switching: false }
  render()
  assert.equal(streams.length, 1)
  assert.equal(streams[0].url, '/api/notifications/stream')
  assert.equal(streams[0].closed, false)

  state.transition = { generation: 3, switching: false }
  render()
  assert.equal(streams[0].closed, true)
  assert.equal(streams.length, 2)
  assert.equal(streams[1].closed, false)
})
