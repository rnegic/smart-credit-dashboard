import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Button } from '@alfalab/core-components/button'
import { Input } from '@alfalab/core-components/input'
import { SidePanel } from '@alfalab/core-components/side-panel'
import { Typography } from '@alfalab/core-components/typography'
import { ArrowUpMIcon } from '@alfalab/icons/glyph/dist/ArrowUpMIcon'
import { MagicWandMIcon } from '@alfalab/icons/glyph/dist/MagicWandMIcon'
import { CrossMIcon } from '@alfalab/icons/glyph/dist/CrossMIcon'

import { formatMoney } from '@/shared/lib'

import styles from './AiCopilotDrawer.module.scss'

/** Context displayed by the local demo assistant; amounts are in rubles. */
export interface AiCopilotDrawerProps {
  companyName: string
  application: {
    amount: number
    purpose: string
    statusLabel: string
  }
}

interface DialogueTurn {
  id: number
  question: string
  answer: string
}

const prompts = ['Что по заявке?', 'Какая сумма?', 'Что умеет помощник?']
const maxQuestionLength = 500
const maxTurns = 8

/** Responsive assistant shell with canned replies and no external integrations. */
export function AiCopilotDrawer({
  companyName,
  application,
}: AiCopilotDrawerProps) {
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [turns, setTurns] = useState<DialogueTurn[]>([])
  const nextTurnId = useRef(0)
  const lastTurnRef = useRef<HTMLDivElement>(null)
  const id = useId()
  const titleId = `${id}-title`
  const panelId = `${id}-panel`
  const inputId = `${id}-question`
  const inputHintId = `${id}-hint`

  useEffect(() => {
    if (open && turns.length > 0) {
      lastTurnRef.current?.scrollIntoView({ block: 'start' })
    }
  }, [open, turns])

  function addQuestion(value: string) {
    const trimmedQuestion = value.trim().slice(0, maxQuestionLength)

    if (!trimmedQuestion) return

    const normalizedQuestion = trimmedQuestion
      .toLocaleLowerCase('ru-RU')
      .replace(/[?!.,:;]+$/u, '')
      .replace(/\s+/gu, ' ')
      .trim()

    let answer =
      'Для этого вопроса нет готовой подсказки. ' +
      'Я могу только повторить показанные в кабинете параметры и статус заявки. Выберите один из вопросов выше.'

    if (
      [
        'что по заявке',
        'статус',
        'статус заявки',
        'какой статус',
        'какой статус заявки',
      ].includes(normalizedQuestion)
    ) {
      answer =
        `В заявке ${companyName} показан статус «${application.statusLabel}». `
    } else if (
      [
        'какая сумма',
        'сумма',
        'сумма заявки',
        'параметры заявки',
        'цель',
        'цель кредита',
        'на что кредит',
      ].includes(normalizedQuestion)
    ) {
      answer =
        `В заявке ${companyName} указано ${formatMoney(application.amount)}. ` +
        `Цель: ${application.purpose}. Это параметры с экрана, а не одобренный лимит или предложение банка.`
    } else if (
      [
        'что умеет помощник',
        'что ты умеешь',
        'помощь',
        'что это',
        'привет',
      ].includes(normalizedQuestion)
    ) {
      answer =
        'Я ИИ помощник, готовый вам помочь. Могу показать сумму, цель и статус заявки из этого кабинета. '
    }

    const turn = { id: nextTurnId.current++, question: trimmedQuestion, answer }
    setTurns((previous) => [...previous, turn].slice(-maxTurns))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    addQuestion(question)
    setQuestion('')
  }

  return (
    <div className={styles.launcherSpace}>
      <Button
        className={styles.launcher}
        labelClassName={styles.launcherLabel}
        type="button"
        view="primary"
        size={56}
        leftAddons={<MagicWandMIcon aria-hidden="true" focusable="false" />}
        aria-haspopup="dialog"
        aria-label="ИИ Помощник"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen(true)}
      >
        ИИ Помощник
      </Button>

      <SidePanel
        className={styles.panel}
        open={open}
        onClose={() => setOpen(false)}
        size="s"
        scrollLock={true}
        disableAutoFocus={false}
        disableFocusLock={false}
        disableRestoreFocus={false}
        disableEscapeKeyDown={false}
        wrapperProps={{ id: panelId, 'aria-labelledby': titleId }}
      >
        <SidePanel.Header
          hasCloser={true}
          sticky={true}
          trim={false}
          closerProps={{
            'aria-label': 'Закрыть помощника',
            icon: () => <CrossMIcon aria-hidden="true" />,
          }}
          title={
            <div className={styles.headerTitle}>
              <Typography.TitleResponsive
                id={titleId}
                tag="h2"
                view="xsmall"
                font="system"
              >
                ИИ Помощник
              </Typography.TitleResponsive>
            </div>
          }
        />

        <SidePanel.Content>
          <div className={styles.body}>
            <section
              className={styles.welcome}
              aria-label="О демонстрационном помощнике"
            >
              <div className={styles.assistantIcon} aria-hidden="true">
                <MagicWandMIcon aria-hidden="true" focusable="false" />
              </div>
              <Typography.TitleResponsive tag="h3" view="small" font="system">
                Заявка под рукой
              </Typography.TitleResponsive>
              <Typography.Text
                tag="p"
                view="primary-medium"
                className={styles.muted}
              >
                Помогу сориентироваться в данных {companyName}
              </Typography.Text>
            </section>

            <section
              className={styles.contextCard}
              aria-label="Контекст демо-заявки"
            >
              <Typography.Text
                tag="span"
                view="secondary-medium"
                className={styles.muted}
              >
                Ваша заявка
              </Typography.Text>
              <Typography.TitleResponsive tag="h3" view="small" font="system">
                {formatMoney(application.amount)}
              </Typography.TitleResponsive>
              <Typography.Text tag="p" view="primary-small">
                {application.purpose}
              </Typography.Text>
              <Typography.Text
                tag="p"
                view="secondary-medium"
                className={styles.muted}
              >
                Статус на экране: {application.statusLabel}
              </Typography.Text>
            </section>

            <div
              className={styles.prompts}
              role="group"
              aria-label="Готовые вопросы"
            >
              {prompts.map((prompt) => (
                <Button
                  key={prompt}
                  className={styles.prompt}
                  type="button"
                  view="outlined"
                  size={40}
                  onClick={() => addQuestion(prompt)}
                >
                  {prompt}
                </Button>
              ))}
            </div>

            <div
              className={styles.dialogue}
              role="log"
              aria-label="Диалог с демо-помощником"
              aria-live="polite"
              aria-relevant="additions"
            >
              {turns.map((turn) => (
                <div className={styles.turn} key={turn.id}>
                  <div className={styles.userMessage}>
                    <Typography.Text
                      tag="span"
                      view="secondary-medium"
                      className={styles.muted}
                    >
                      Вы
                    </Typography.Text>
                    <Typography.Text tag="p" view="primary-small">
                      {turn.question}
                    </Typography.Text>
                  </div>
                  <div className={styles.assistantMessage}>
                    <Typography.Text
                      tag="span"
                      view="secondary-medium"
                      weight="medium"
                    >
                      ИИ Помощник
                    </Typography.Text>
                    <Typography.Text tag="p" view="primary-small">
                      {turn.answer}
                    </Typography.Text>
                  </div>
                </div>
              ))}
              <div ref={lastTurnRef} />
            </div>
          </div>
        </SidePanel.Content>

        <SidePanel.Footer sticky={true} layout="column">
          <form className={styles.form} onSubmit={handleSubmit}>
            <Input
              id={inputId}
              className={styles.input}
              block={true}
              size={56}
              label="Вопрос по заявке"
              labelView="outer"
              placeholder="Например, какой статус?"
              value={question}
              maxLength={maxQuestionLength}
              autoComplete="off"
              aria-describedby={inputHintId}
              onChange={(_, { value }) => setQuestion(value)}
            />
            <Button
              className={styles.sendButton}
              type="submit"
              view="primary"
              size={56}
              disabled={!question.trim()}
              aria-label="Отправить вопрос"
              title="Отправить вопрос"
              leftAddons={<ArrowUpMIcon aria-hidden="true" focusable="false" />}
            />
            <Typography.Text
              id={inputHintId}
              className={styles.inputHint}
              tag="p"
              view="secondary-medium"
            >
              До {maxQuestionLength} символов
            </Typography.Text>
          </form>
        </SidePanel.Footer>
      </SidePanel>
    </div>
  )
}
