import { useEffect, useRef, useState } from 'react'

import type { AssistantScreen } from '@/entities/ai-message'

const assistantSelector = '[data-ai-assistant]'
const privateSelector = '[data-assistant-private]'
const fieldSelector = 'input:not([type="hidden"]), textarea, select, [role="combobox"]'
const contextFields = new Set([
  'okved', 'legalForm', 'amount', 'reviewAmount', 'termDays', 'reviewTermDays',
  'purpose', 'reviewPurpose', 'businessTask', 'reviewDescription',
  'monthlyRevenue', 'existingDebt', 'otherMonthlyObligations',
])

function visible(element: Element) {
  return (
    !element.closest(`[hidden], [aria-hidden="true"], ${assistantSelector}, ${privateSelector}`) &&
    element.getClientRects().length > 0 &&
    getComputedStyle(element).visibility !== 'hidden'
  )
}

function clean(value: string, limit: number) {
  return value
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/giu, '[email скрыт]')
    .replace(/\+?\d[\d\s()-]{8,}\d/gu, (match) => match.replace(/\D/gu, '').length >= 10 ? '[реквизиты скрыты]' : match)
    .replace(/[\t ]+/gu, ' ')
    .replace(/\n\s*\n/gu, '\n')
    .trim()
    .slice(0, limit)
}

function referencedText(element: Element, attribute: string) {
  return (element.getAttribute(attribute) ?? '')
    .split(/\s+/u)
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ')
}

function screenText(root: Element) {
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (node instanceof Element) {
          if (
            node.matches(`script, style, noscript, svg, input, textarea, select, ${assistantSelector}, ${privateSelector}`) ||
            !visible(node)
          ) return NodeFilter.FILTER_REJECT
          return NodeFilter.FILTER_SKIP
        }
        return node.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
      },
    },
  )
  const parts: string[] = []
  let length = 0
  while (walker.nextNode() && length < 16_000) {
    const text = walker.currentNode.textContent?.trim() ?? ''
    parts.push(text)
    length += text.length
  }
  return clean(parts.join('\n'), 12_000)
}

/** Capture the active dialog or page, never hidden DOM or arbitrary input values. */
export function readAssistantScreen(focusedFieldId: string | null = null) {
  const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"]'))
    .filter(visible)
    .sort((a, b) => (Number.parseInt(getComputedStyle(a).zIndex) || 0) - (Number.parseInt(getComputedStyle(b).zIndex) || 0))
  const dialog = dialogs.at(-1) ?? null
  const root = dialog ?? document.querySelector('#main-content, main') ?? document.body
  const metadata = root.querySelector<HTMLElement>('[data-assistant-title]')
  const heading = root.querySelector('h1, h2')
  const stepper = root.querySelector('ol[aria-label="Заполнение заявки"]')
  const step = stepper?.querySelector('[aria-current="step"]')
  const steps = Array.from(stepper?.children ?? [])
  const stepTitle = step ? `Шаг ${steps.indexOf(step) + 1} из ${steps.length}: ${heading?.textContent ?? ''}` : null
  const floatingHelp = Array.from(document.querySelectorAll('[role="tooltip"], [role="listbox"], [role="menu"]'))
    .filter((element) => visible(element) && !root.contains(element))
    .map(screenText)
  const fields = Array.from(root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(fieldSelector))
    .filter((element) => visible(element) && element.id)
    .slice(0, 40)
    .map((element) => ({
      id: element.id.slice(0, 160),
      label: clean(
        Array.from(element.labels ?? []).map((label) => label.textContent ?? '').join(' ') ||
        referencedText(element, 'aria-labelledby') || element.getAttribute('aria-label') ||
        element.getAttribute('placeholder') || element.name || 'Поле формы',
        200,
      ),
      hint: clean(`${referencedText(element, 'aria-describedby')} ${referencedText(element, 'aria-errormessage')}`, 600),
      value: contextFields.has(element.name) ? clean(element.value ?? '', 300) : null,
      filled: element instanceof HTMLInputElement && ['checkbox', 'radio'].includes(element.type)
        ? element.checked : Boolean(element.value),
      required: element.required || element.getAttribute('aria-required') === 'true',
      invalid: element.getAttribute('aria-invalid') === 'true',
      readOnly: 'readOnly' in element ? element.readOnly : element.getAttribute('aria-readonly') === 'true',
    }))
  const context: AssistantScreen = {
    path: window.location.pathname.slice(0, 200),
    title: clean(metadata?.dataset.assistantTitle || (dialog && referencedText(dialog, 'aria-labelledby')) || heading?.textContent || document.title, 300),
    step: metadata?.dataset.assistantStep?.slice(0, 160) ?? stepTitle?.slice(0, 160) ?? null,
    product: metadata?.dataset.assistantProduct?.slice(0, 200) ?? null,
    text: [screenText(root), ...floatingHelp].join('\n').trim().slice(0, 12_000),
    focusedFieldId: fields.some((field) => field.id === focusedFieldId) ? focusedFieldId : null,
    fields,
  }
  return { dialog, context }
}

/** Refresh context on screen changes, coalescing DOM events into one frame. */
export function useAssistantScreen() {
  const focusedField = useRef<string | null>(null)
  const [screen, setScreen] = useState(() => readAssistantScreen())

  useEffect(() => {
    let frame = 0
    function update() {
      frame = 0
      const next = readAssistantScreen(focusedField.current)
      setScreen((previous) => previous.dialog === next.dialog &&
        JSON.stringify(previous.context) === JSON.stringify(next.context) ? previous : next)
    }
    function schedule() {
      if (!frame) frame = requestAnimationFrame(update)
    }
    function onFocus(event: FocusEvent) {
      if (event.target instanceof Element && visible(event.target) && event.target.matches(fieldSelector)) {
        focusedField.current = event.target.id || null
        schedule()
      }
    }
    function onInput(event: Event) {
      if (!(event.target instanceof Element) || !event.target.closest(assistantSelector)) schedule()
    }
    const observer = new MutationObserver((records) => {
      if (records.some((record) => {
        const element = record.target instanceof Element ? record.target : record.target.parentElement
        return !element?.closest(assistantSelector)
      })) schedule()
    })
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['hidden', 'aria-hidden', 'aria-invalid', 'class', 'data-assistant-title', 'data-assistant-step', 'data-assistant-product'],
    })
    document.addEventListener('focusin', onFocus)
    document.addEventListener('input', onInput)
    document.addEventListener('change', onInput)
    schedule()
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
      document.removeEventListener('focusin', onFocus)
      document.removeEventListener('input', onInput)
      document.removeEventListener('change', onInput)
    }
  }, [])

  return {
    ...screen,
    capture: () => readAssistantScreen(focusedField.current).context,
  }
}
