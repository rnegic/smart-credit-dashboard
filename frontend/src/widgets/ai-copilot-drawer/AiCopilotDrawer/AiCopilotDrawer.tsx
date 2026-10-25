import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@alfalab/core-components/button'
import { IconButton } from '@alfalab/core-components/icon-button'
import { useMatchMedia } from '@alfalab/core-components/mq'
import { SidePanel } from '@alfalab/core-components/side-panel'
import { Textarea } from '@alfalab/core-components/textarea'
import { Typography } from '@alfalab/core-components/typography'
import { stackingOrder } from '@alfalab/core-components-stack-context'
import { ArrowUpMIcon } from '@alfalab/icons/glyph/dist/ArrowUpMIcon'
import { MagicWandMIcon } from '@alfalab/icons/glyph/dist/MagicWandMIcon'
import { CrossMIcon } from '@alfalab/icons/glyph/dist/CrossMIcon'

import {
  maxAssistantQuestionLength,
  useAssistantChat,
  useAssistantScreen,
} from '@/features/send-ai-message'
import { formatMoney } from '@/shared/lib'

import styles from './AiCopilotDrawer.module.scss'

/** The assistant reads fresh screen context and server-owned cabinet data. */
export interface AiCopilotDrawerProps {
  companyName: string
  application: {
    amount: number
    purpose: string
    statusLabel: string
  } | null
}

export function AiCopilotDrawer({ companyName, application }: AiCopilotDrawerProps) {
  const screen = useAssistantScreen()
  const chat = useAssistantChat()
  const [desktop] = useMatchMedia('(min-width: 768px)')
  const [panel, setPanel] = useState({ dialog: screen.dialog, open: false })
  const [question, setQuestion] = useState('')
  const launcherRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const id = useId()
  const titleId = `${id}-title`
  const panelId = `${id}-panel`
  const hintId = `${id}-hint`

  // A newly opened business dialog must never be covered by an already open chat.
  if (panel.dialog !== screen.dialog) {
    setPanel({ dialog: screen.dialog, open: false })
  }
  const open = panel.open && panel.dialog === screen.dialog
  const context = screen.context
  const popup = desktop && Boolean(screen.dialog && context.step)
  const focusedField = context.fields.find((field) => field.id === context.focusedFieldId)
  const relevantField = focusedField ?? context.fields.find((field) => field.invalid) ??
    context.fields.find((field) => /оквэд/iu.test(field.label))
  const prompts = context.fields.length > 0
    ? [
        relevantField ? `Где взять «${relevantField.label}»?` : 'Что заполнить на этом шаге?',
        context.fields.some((field) => field.invalid) ? 'Как исправить ошибки на этом шаге?' : 'Что важно проверить перед продолжением?',
      ]
    : ['Что мне делать дальше?', 'Объясни условия на экране', 'Чем ты можешь помочь?']
  const lastTurn = chat.turns.at(-1)

  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }))
    return () => cancelAnimationFrame(frame)
  }, [open, popup])

  useEffect(() => {
    if (!open || chat.turns.length === 0) return
    const element = scrollRef.current
    element?.scrollTo({ top: element.scrollHeight })
  }, [open, chat.turns, chat.pending, chat.error])

  function restoreFocus() {
    const target = returnFocusRef.current ?? launcherRef.current
    if (target?.isConnected) target.focus({ preventScroll: true })
    returnFocusRef.current = null
  }

  function close(target?: HTMLElement) {
    returnFocusRef.current = target ?? launcherRef.current
    setPanel({ dialog: screen.dialog, open: false })
    if (popup) requestAnimationFrame(restoreFocus)
  }

  function ask(value: string) {
    if (!value.trim() || chat.pending) return
    void chat.send(value, screen.capture())
    setQuestion('')
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    ask(question)
  }

  function showField(fieldId: string) {
    const target = document.getElementById(fieldId)
    if (!target || !screen.capture().fields.some((field) => field.id === fieldId)) return
    target.scrollIntoView({ block: 'center', behavior: 'instant' })
    close(target)
  }

  const header = (
    <div className={styles.header}>
      <div className={styles.heading}>
        <Typography.TitleResponsive id={titleId} tag="h2" view="xsmall" font="system">
          Помощник
        </Typography.TitleResponsive>
        <Typography.Text tag="p" view="secondary-small" color="secondary">
          {context.step}
        </Typography.Text>
      </div>
      <IconButton
        icon={CrossMIcon}
        size={32}
        view="secondary"
        aria-label="Свернуть помощника"
        onClick={() => close()}
      />
    </div>
  )

  const body = (
    <div className={styles.body} ref={scrollRef}>
      {!popup && chat.turns.length === 0 && (
        <section className={styles.welcome} aria-label="О помощнике">
          <Typography.TitleResponsive tag="h3" view="small" font="system">
            Заявка под рукой
          </Typography.TitleResponsive>
          <Typography.Text tag="p" view="primary-medium" color="secondary">
            Помогу сориентироваться в данных {companyName}.
          </Typography.Text>
        </section>
      )}

      {!popup && application && chat.turns.length === 0 && (
        <section className={styles.contextCard} aria-label="Данные заявки">
          <Typography.Text tag="span" view="secondary-medium" color="secondary">Ваша заявка</Typography.Text>
          <Typography.TitleResponsive tag="h3" view="small" font="system">{formatMoney(application.amount)}</Typography.TitleResponsive>
          <Typography.Text tag="p" view="primary-small">{application.purpose}</Typography.Text>
          <Typography.Text tag="p" view="secondary-medium" color="secondary">{application.statusLabel}</Typography.Text>
        </section>
      )}

      {!popup && <div className={styles.contextLine} aria-label="Контекст помощника">
        <Typography.Text tag="p" view="secondary-medium" color="secondary">
          {context.step ?? `На экране: ${context.title}`}
        </Typography.Text>
        {focusedField && (
          <Typography.Text tag="p" view="secondary-medium" color="secondary">Поле: {focusedField.label}</Typography.Text>
        )}
      </div>}
      {popup && chat.turns.length === 0 && (
        <Typography.Text tag="p" view="primary-small">
          Задайте вопрос по заполнению. Подскажу, где взять данные и как исправить ошибки.
        </Typography.Text>
      )}

      <div className={styles.dialogue} role="log" aria-label="Диалог с помощником" aria-live="polite" aria-relevant="additions text">
        {chat.turns.map((turn) => (
          <div className={styles.turn} key={turn.id}>
            <div className={styles.userMessage}>
              <Typography.Text tag="p" view="primary-small">{turn.question}</Typography.Text>
            </div>
            {turn.answer && (
              <div className={styles.assistantMessage}>
                <Typography.Text tag="span" view="secondary-small" color="secondary">
                  {turn.contextTitle}
                </Typography.Text>
                <Typography.Text tag="p" view="primary-small" className={styles.answer}>
                  {turn.answer.answer}
                </Typography.Text>
                {turn.answer.focusFieldId && turn.contextTitle === (context.step ?? context.title) &&
                  context.fields.some((field) => field.id === turn.answer?.focusFieldId) && (
                    <Button type="button" view="outlined" size={32} onClick={() => showField(turn.answer!.focusFieldId!)}>
                      Показать поле
                    </Button>
                  )}
              </div>
            )}
            {turn.error && turn.id !== lastTurn?.id && (
              <Typography.Text tag="p" view="secondary-medium" color="secondary">Ответ не получен. Задайте вопрос повторно.</Typography.Text>
            )}
          </div>
        ))}
        {chat.pending && (
          <Typography.Text className={styles.pending} tag="p" view="primary-small" role="status">
            Готовим ответ...
          </Typography.Text>
        )}
      </div>

      {chat.error && !chat.pending && (
        <div className={styles.error} role="alert">
          <Typography.Text tag="p" view="primary-small">
            {chat.error.message || 'Не удалось получить ответ помощника.'}
          </Typography.Text>
          {lastTurn && !lastTurn.answer && (
            <Button type="button" view="outlined" size={32} onClick={() => void chat.send(lastTurn.question, screen.capture(), lastTurn)}>
              Повторить запрос
            </Button>
          )}
        </div>
      )}

      {!chat.pending && (
        <div className={styles.prompts} role="group" aria-label="Вопросы по текущему экрану">
          {prompts.map((prompt) => (
            <Button key={prompt} className={styles.prompt} type="button" view="outlined" size={32} onClick={() => ask(prompt)}>
              {prompt}
            </Button>
          ))}
        </div>
      )}
    </div>
  )

  const composer = (
    <div className={styles.composer}>
      {chat.turns.length > 0 && (
        <Button className={styles.newChat} type="button" view="transparent" size={32} disabled={chat.pending} onClick={() => { chat.clear(); setQuestion('') }}>
          Новый диалог
        </Button>
      )}
      <form className={styles.form} onSubmit={submit}>
        <Textarea
          ref={inputRef}
          className={styles.input}
          block={true}
          size={48}
          autosize={true}
          minRows={1}
          maxRows={4}
          aria-label="Вопрос помощнику"
          placeholder="Ваш вопрос"
          value={question}
          maxLength={maxAssistantQuestionLength}
          autoComplete="off"
          aria-describedby={hintId}
          onChange={(_, { value }) => setQuestion(value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault()
              ask(question)
            }
          }}
        />
        <Button
          className={styles.sendButton}
          type="submit"
          view="primary"
          size={48}
          loading={chat.pending}
          disabled={!question.trim() || chat.pending}
          aria-label="Отправить вопрос"
          leftAddons={<ArrowUpMIcon aria-hidden="true" focusable="false" />}
        />
      </form>
      <Typography.Text id={hintId} className={styles.hint} tag="p" view="secondary-small" color="secondary">
        Ответы ИИ стоит проверять. Значения личных полей не передаются.
      </Typography.Text>
    </div>
  )

  const wrapperProps = {
    id: panelId,
    'aria-labelledby': titleId,
    'data-ai-assistant': true,
  }

  return (
    <>
      {createPortal(
        <div className={styles.floatingRoot} data-ai-assistant>
          {popup && open && (
            <section
              className={styles.popup}
              id={panelId}
              role="dialog"
              aria-modal="false"
              aria-labelledby={titleId}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.stopPropagation()
                  close()
                }
              }}
            >
              {header}
              {body}
              {composer}
            </section>
          )}
          <Button
            ref={launcherRef}
            className={`${styles.launcher} ${screen.dialog ? styles.compactLauncher : ''}`}
            labelClassName={styles.launcherLabel}
            type="button"
            view="primary"
            size={56}
            leftAddons={<MagicWandMIcon aria-hidden="true" focusable="false" />}
            aria-haspopup="dialog"
            aria-label={open ? 'Свернуть помощника' : 'Помощник'}
            aria-expanded={open}
            aria-controls={open ? panelId : undefined}
            onClick={() => open ? close() : setPanel({ dialog: screen.dialog, open: true })}
          >
            Помощник
          </Button>
        </div>,
        screen.dialog ?? document.body,
      )}
      {!popup && (
        <SidePanel
          open={open}
          className={styles.nativePanel}
          onClose={() => close()}
          size="s"
          breakpoint={768}
          zIndex={stackingOrder.TOAST}
          scrollLock={true}
          disableRestoreFocus={true}
          onUnmount={restoreFocus}
          wrapperProps={wrapperProps}
        >
          <SidePanel.Header
            title={<Typography.TitleResponsive id={titleId} tag="h2" view="xsmall" font="system">Помощник</Typography.TitleResponsive>}
            hasCloser={true}
            closerProps={{ 'aria-label': 'Закрыть помощника', icon: () => <CrossMIcon aria-hidden="true" /> }}
            sticky={true}
            trim={false}
          />
          <SidePanel.Content className={styles.panelContent}>{body}</SidePanel.Content>
          <SidePanel.Footer sticky={true} layout="column">{composer}</SidePanel.Footer>
        </SidePanel>
      )}
    </>
  )
}
