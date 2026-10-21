import { useSyncExternalStore } from 'react'

export const sessionEvents = new EventTarget()

const storageKey = 'session-lifecycle'
const transitionTimeout = 125_000
const source = crypto.randomUUID()
const active = new Map<string, ReturnType<typeof setTimeout>>()
const seen = new Set<string>()
let controller = new AbortController()
let refreshing = false
let snapshot = { generation: 0, switching: false, error: null as Error | null }

/** Cross-tab lifecycle notification. No identity or credentials are transmitted. */
export interface SessionChangeEvent {
  refresh: boolean
}

/** Token identifying the authentication generation that started a transition. */
export interface SessionChange {
  id: string
  generation: number
}

interface Message {
  source: string
  id: string
  phase: 'start' | 'end'
  time: number
}

function publish() {
  snapshot = { ...snapshot, switching: active.size > 0 || refreshing }
  sessionEvents.dispatchEvent(new Event('change'))
}

function invalidate() {
  controller.abort()
  controller = new AbortController()
  snapshot = { ...snapshot, generation: snapshot.generation + 1 }
}

function ended(refresh: boolean) {
  refreshing ||= refresh
  publish()
  sessionEvents.dispatchEvent(
    new CustomEvent<SessionChangeEvent>('change-end', { detail: { refresh } }),
  )
}

function receive(message: Message) {
  if (message.source === source) return
  const key = `${message.id}:${message.phase}`
  if (
    seen.has(key) ||
    (message.phase === 'start' && seen.has(`${message.id}:end`))
  )
    return
  seen.add(key)
  if (seen.size > 200) seen.delete(seen.values().next().value!)
  invalidate()
  if (message.phase === 'start') {
    snapshot = { ...snapshot, error: null }
    const remaining = Math.max(
      0,
      transitionTimeout - (Date.now() - message.time),
    )
    active.set(
      message.id,
      setTimeout(() => {
        active.delete(message.id)
        invalidate()
        ended(true)
      }, remaining),
    )
    publish()
    sessionEvents.dispatchEvent(new Event('change-start'))
  } else {
    clearTimeout(active.get(message.id))
    active.delete(message.id)
    ended(true)
  }
}

function readMessage(value: string | null): Message | null {
  try {
    const data: unknown = JSON.parse(value ?? 'null')
    if (typeof data !== 'object' || data === null) return null
    const message = data as Record<string, unknown>
    if (
      typeof message.source !== 'string' ||
      typeof message.id !== 'string' ||
      typeof message.time !== 'number' ||
      (message.phase !== 'start' && message.phase !== 'end')
    )
      return null
    return message as unknown as Message
  } catch {
    return null
  }
}

const channel =
  typeof BroadcastChannel === 'undefined'
    ? null
    : new BroadcastChannel(storageKey)
if (channel)
  channel.onmessage = (event: MessageEvent<unknown>) => {
    const message = readMessage(JSON.stringify(event.data))
    if (message) receive(message)
  }
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== storageKey) return
    const message = readMessage(event.newValue)
    if (message) receive(message)
  })
  window.addEventListener('pageshow', syncSessionChanges)
  window.addEventListener('focus', syncSessionChanges)
}

function send(id: string, phase: Message['phase']) {
  const message: Message = { source, id, phase, time: Date.now() }
  try {
    localStorage.setItem(storageKey, JSON.stringify(message))
  } catch {
    /* BroadcastChannel remains available when storage is restricted. */
  }
  channel?.postMessage(message)
}

/** Read the shared fence before sending or accepting an API response. */
export function syncSessionChanges() {
  try {
    const message = readMessage(localStorage.getItem(storageKey))
    if (message) receive(message)
  } catch {
    /* Storage can be unavailable in privacy mode. */
  }
}

/** Start an exclusive local authentication transition and invalidate old requests. */
export function beginSessionChange(): SessionChange {
  syncSessionChanges()
  if (snapshot.switching)
    throw new Error('Смена профиля уже выполняется. Дождитесь завершения.')
  const id = crypto.randomUUID()
  invalidate()
  snapshot = { ...snapshot, error: null }
  active.set(
    id,
    setTimeout(
      () => endSessionChange({ id, generation: snapshot.generation }, true),
      transitionTimeout,
    ),
  )
  publish()
  send(id, 'start')
  sessionEvents.dispatchEvent(new Event('change-start'))
  return { id, generation: snapshot.generation }
}

/** Always finish a transition, including failed requests, then reconcile if necessary. */
export function endSessionChange(
  change: SessionChange,
  refresh = false,
  error: Error | null = null,
) {
  if (!active.has(change.id)) return
  clearTimeout(active.get(change.id))
  active.delete(change.id)
  invalidate()
  snapshot = { ...snapshot, error }
  send(change.id, 'end')
  ended(refresh)
}

/** Release the UI only if reconciliation still belongs to the current generation. */
export function completeSessionRefresh(generation: number) {
  if (generation !== snapshot.generation || active.size > 0) return
  refreshing = false
  publish()
}

/** Expire locally immediately and make other tabs verify their shared cookie. */
export function expireSession() {
  if (snapshot.switching) return
  const change = beginSessionChange()
  sessionEvents.dispatchEvent(new Event('expired'))
  endSessionChange(change)
}

export const getSessionGeneration = () => snapshot.generation
export const getSessionSignal = () => controller.signal
export const isSessionSwitching = () => snapshot.switching
export const hasActiveSessionChange = () => active.size > 0

function subscribe(listener: () => void) {
  sessionEvents.addEventListener('change', listener)
  return () => sessionEvents.removeEventListener('change', listener)
}

/** Shared synchronous UI fence for local and remote authentication changes. */
export function useSessionTransition() {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  )
}

syncSessionChanges()
