import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  prefillResponseSchema,
  type PrefillResponse,
} from '@/entities/application-form'
import {
  apiRequest,
  getSessionGeneration,
  isSessionSwitching,
  sessionEvents,
} from '@/shared/api'

type PreparationStage = 'idle' | 'preparing' | 'slow'

interface PrefillAttempt {
  text: string
  startedAt: number
  generation: number
  controller: AbortController
  timers: ReturnType<typeof setTimeout>[]
}

/** Callbacks for the current editor's preparation attempt only. */
export interface ApplicationPrefillOptions {
  onSuccess: (response: PrefillResponse, description: string) => void
  onError: (error: Error) => void
}

/** Own preparation timing and cancellation for the scope-keyed form editor. */
export function useApplicationPrefill({
  onSuccess,
  onError,
}: ApplicationPrefillOptions) {
  const [stage, setStage] = useState<PreparationStage>('idle')
  const active = useRef<PrefillAttempt | null>(null)

  useEffect(() => {
    const interrupt = () => {
      const attempt = active.current
      active.current = null
      if (attempt) {
        attempt.timers.forEach(clearTimeout)
        attempt.controller.abort()
      }
    }
    const sessionChanged = () => {
      if (
        active.current &&
        active.current.generation !== getSessionGeneration()
      ) {
        interrupt()
        setStage('idle')
      }
    }
    sessionEvents.addEventListener('change', sessionChanged)
    return () => {
      sessionEvents.removeEventListener('change', sessionChanged)
      interrupt()
    }
  }, [])

  function isCurrent(attempt: PrefillAttempt) {
    return (
      active.current === attempt &&
      attempt.generation === getSessionGeneration() &&
      !attempt.controller.signal.aborted
    )
  }

  function finish(attempt: PrefillAttempt) {
    const current = isCurrent(attempt)
    if (active.current === attempt) {
      active.current = null
      attempt.timers.forEach(clearTimeout)
      setStage('idle')
    }
    return current
  }

  const mutation = useMutation({
    mutationFn: (attempt: PrefillAttempt) => {
      if (!isCurrent(attempt)) attempt.controller.abort()
      attempt.controller.signal.throwIfAborted()
      return apiRequest('/api/ai/prefill', prefillResponseSchema, {
        method: 'POST',
        body: JSON.stringify({ text: attempt.text.trim() }),
        signal: attempt.controller.signal,
      })
    },
    retry: false,
    onSuccess: (response, attempt) => {
      const apply = () => {
        if (finish(attempt)) onSuccess(response, attempt.text)
      }
      const remaining = 3_000 - (performance.now() - attempt.startedAt)
      if (isCurrent(attempt) && remaining > 0) {
        attempt.timers.push(setTimeout(apply, remaining))
      } else {
        apply()
      }
    },
    onError: (error, attempt) => {
      if (finish(attempt)) onError(error)
    },
  })

  function start(text: string) {
    if (active.current || isSessionSwitching()) return
    const attempt: PrefillAttempt = {
      text,
      startedAt: performance.now(),
      generation: getSessionGeneration(),
      controller: new AbortController(),
      timers: [],
    }
    active.current = attempt
    setStage('preparing')
    attempt.timers.push(
      setTimeout(() => {
        if (isCurrent(attempt)) setStage('slow')
      }, 8_000),
      setTimeout(() => {
        if (!finish(attempt)) return
        const error = new DOMException('Prefill timed out', 'TimeoutError')
        attempt.controller.abort(error)
        onError(error)
      }, 60_000),
    )
    mutation.mutate(attempt)
  }

  function cancel() {
    const attempt = active.current
    if (!attempt) return
    finish(attempt)
    attempt.controller.abort()
  }

  return { stage, isPending: stage !== 'idle', start, cancel }
}
