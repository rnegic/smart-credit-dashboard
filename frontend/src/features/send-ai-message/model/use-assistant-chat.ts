import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'

import {
  assistantAnswerSchema,
  type AssistantAnswer,
  type AssistantMessage,
  type AssistantRequest,
  type AssistantScreen,
} from '@/entities/ai-message'
import { apiRequest } from '@/shared/api'

export const maxAssistantQuestionLength = 1000

/** A conversation stays in memory and is discarded with the authenticated layout. */
export interface AssistantTurn {
  id: number
  question: string
  contextTitle: string
  answer?: AssistantAnswer
  error?: string
}

export function useAssistantChat() {
  const [turns, setTurns] = useState<AssistantTurn[]>([])
  const request = useRef<AbortController | null>(null)
  const nextId = useRef(0)
  const mutation = useMutation({
    mutationFn: ({ body, signal }: { body: AssistantRequest; signal: AbortSignal }) =>
      apiRequest('/api/assistant/messages', assistantAnswerSchema, {
        method: 'POST',
        body: JSON.stringify(body),
        signal,
      }),
    retry: false,
  })

  useEffect(() => () => request.current?.abort(), [])

  async function send(value: string, screen: AssistantScreen, retryTurn?: AssistantTurn) {
    const message = value.trim().slice(0, maxAssistantQuestionLength)
    if (!message || request.current) return false

    const controller = new AbortController()
    request.current = controller
    const turn: AssistantTurn = {
      id: retryTurn?.id ?? nextId.current++,
      question: message,
      contextTitle: screen.step ?? screen.title,
    }
    let history: AssistantMessage[] = turns
      .filter((item) => item.answer && item.id !== turn.id)
      .slice(-6)
      .flatMap((item) => [
        { role: 'user' as const, content: item.question },
        { role: 'assistant' as const, content: item.answer!.answer },
      ])
    while (history.reduce((length, item) => length + item.content.length, 0) > 20_000) {
      history = history.slice(2)
    }
    setTurns((previous) => retryTurn
      ? previous.map((item) => item.id === turn.id ? turn : item)
      : [...previous, turn].slice(-20))

    try {
      const answer = await mutation.mutateAsync({ body: { message, history, screen }, signal: controller.signal })
      if (!controller.signal.aborted) {
        const focusFieldId = screen.fields.some((field) => field.id === answer.focusFieldId)
          ? answer.focusFieldId : null
        setTurns((previous) => previous.map((item) => item.id === turn.id
          ? { ...item, answer: { ...answer, focusFieldId } } : item))
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setTurns((previous) => previous.map((item) => item.id === turn.id
          ? { ...item, error: error instanceof Error ? error.message : 'Не удалось получить ответ помощника.' }
          : item))
      }
    } finally {
      if (request.current === controller) request.current = null
    }
    return true
  }

  function clear() {
    request.current?.abort()
    request.current = null
    mutation.reset()
    setTurns([])
  }

  return {
    turns,
    send,
    clear,
    pending: mutation.isPending,
    error: mutation.error,
  }
}
