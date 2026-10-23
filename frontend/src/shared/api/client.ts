import { z } from 'zod'
import {
  expireSession,
  getSessionGeneration,
  getSessionSignal,
  hasActiveSessionChange,
  isSessionSwitching,
  syncSessionChanges,
} from './session-lifecycle'

const errorSchema = z.object({ code: z.string(), message: z.string() })
const baseUrl =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(
    /\/$/,
    '',
  ) ?? ''

/** Validated server error or a transport/contract failure exposed to the UI. */
export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
    this.name = 'ApiError'
  }
}

function assertGeneration(generation: number) {
  syncSessionChanges()
  if (generation !== getSessionGeneration())
    throw new ApiError(
      409,
      'SESSION_CHANGED',
      'Профиль изменился. Повторите действие в текущем профиле.',
    )
}

function networkError() {
  return new ApiError(
    0,
    'NETWORK_ERROR',
    'Не удалось связаться с сервером. Проверьте соединение и повторите попытку.',
  )
}

function assertRequest(
  generation: number,
  signal: AbortSignal,
  callerSignal?: AbortSignal | null,
) {
  assertGeneration(generation)
  if (callerSignal?.aborted) throw callerSignal.reason
  if (signal.aborted) throw networkError()
}

async function readJson(
  response: Response,
  generation: number,
  signal: AbortSignal,
  callerSignal?: AbortSignal | null,
): Promise<unknown> {
  try {
    const body: unknown = await response.json()
    assertRequest(generation, signal, callerSignal)
    return body
  } catch (error) {
    assertRequest(generation, signal, callerSignal)
    if (error instanceof Error && error.name === 'SyntaxError') {
      if (!response.ok) return undefined
      throw new ApiError(
        response.status,
        'INVALID_RESPONSE',
        'Сервер вернул данные в неожиданном формате. Повторите запрос.',
      )
    }
    if (error instanceof Error && error.name === 'AbortError') throw error
    throw networkError()
  }
}

async function request(path: string, options: RequestInit = {}) {
  syncSessionChanges()
  const generation = getSessionGeneration()
  const isAuthAction = path === '/api/auth/login' || path === '/api/auth/logout'
  if (
    isSessionSwitching() &&
    !isAuthAction &&
    path !== '/api/demo/profiles' &&
    !(path === '/api/auth/me' && !hasActiveSessionChange())
  ) {
    throw new ApiError(
      409,
      'SESSION_CHANGED',
      'Выполняется смена профиля. Дождитесь завершения.',
    )
  }
  let response: Response
  const headers = new Headers(options.headers)
  if (options.body && !headers.has('Content-Type'))
    headers.set('Content-Type', 'application/json')
  const signal = AbortSignal.any([
    getSessionSignal(),
    AbortSignal.timeout(120_000),
    ...(options.signal ? [options.signal] : []),
  ])
  try {
    assertRequest(generation, signal, options.signal)
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      credentials: 'include',
      headers,
      signal,
    })
  } catch (error) {
    assertRequest(generation, signal, options.signal)
    if (error instanceof Error && error.name === 'AbortError') throw error
    throw networkError()
  }
  assertRequest(generation, signal, options.signal)
  if (!response.ok) {
    const result = errorSchema.safeParse(
      await readJson(response, generation, signal, options.signal),
    )
    assertRequest(generation, signal, options.signal)
    const error = new ApiError(
      response.status,
      result.success ? result.data.code : 'HTTP_ERROR',
      result.success
        ? result.data.message
        : `Ошибка сервера (${response.status}). Повторите попытку.`,
    )
    if (
      response.status === 401 &&
      path !== '/api/auth/me' &&
      !path.startsWith('/api/auth/') &&
      error.code !== 'BAD_CREDENTIALS'
    )
      expireSession()
    throw error
  }
  return { response, generation, signal }
}

/** Send a cookie-authenticated request and validate its JSON response. */
export async function apiRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  options?: RequestInit,
): Promise<T> {
  const { response, generation, signal } = await request(path, options)
  const result = schema.safeParse(
    await readJson(response, generation, signal, options?.signal),
  )
  assertRequest(generation, signal, options?.signal)
  if (!result.success)
    throw new ApiError(
      response.status,
      'INVALID_RESPONSE',
      'Сервер вернул данные в неожиданном формате. Повторите запрос.',
    )
  return result.data
}

export async function apiOptionalRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  options?: RequestInit,
): Promise<T | null> {
  const { response, generation, signal } = await request(path, options)
  if (response.status === 204) return null
  const result = schema.safeParse(
    await readJson(response, generation, signal, options?.signal),
  )
  assertRequest(generation, signal, options?.signal)
  if (!result.success)
    throw new ApiError(
      response.status,
      'INVALID_RESPONSE',
      'Сервер вернул данные в неожиданном формате. Повторите запрос.',
    )
  return result.data
}

/** Send a request whose successful response does not require a JSON body. */
export async function apiEmpty(
  path: string,
  options?: RequestInit,
): Promise<void> {
  const { generation, signal } = await request(path, options)
  assertRequest(generation, signal, options?.signal)
}
