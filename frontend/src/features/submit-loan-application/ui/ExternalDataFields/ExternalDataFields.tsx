import { useId } from 'react'
import { Input } from '@alfalab/core-components/input'
import { Select } from '@alfalab/core-components/select'
import type { RevenueTrend } from '@/entities/application-form'
import { FieldLabel } from '@/shared/ui'
import styles from './ExternalDataFields.module.scss'

export interface ExternalDataDraft {
  bkiScore: string
  delinquencies12m: string
  inquiries12m: string
  revenueTrend: string
  companyAgeYears: string
}

export interface ExternalDemoData {
  bkiScore: number
  delinquencies12m: number
  inquiries12m: number
  revenueTrend: RevenueTrend
  companyAgeYears: number
}

export interface ExternalDataFieldsProps {
  value: Partial<ExternalDataDraft>
  onChange: (patch: Partial<ExternalDataDraft>) => void
  onBlur?: (field: keyof ExternalDataDraft) => void
  demo?: ExternalDemoData | null
  errors?: Readonly<Record<string, string>>
}

const numberFields = [
  {
    name: 'bkiScore',
    label: 'БКИ-скор',
    hint: 'Целое число от 0 до 1 000. Если оставить пустым, используем демо-значение по ИНН.',
    placeholder: 'Например, 680',
  },
  {
    name: 'delinquencies12m',
    label: 'Просрочки за 12 месяцев',
    hint: 'Количество просроченных платежей. Пустое поле — демо-значение.',
    placeholder: 'Например, 1',
  },
  {
    name: 'inquiries12m',
    label: 'Запросы в БКИ за 12 месяцев',
    hint: 'Сколько раз проверяли кредитную историю. Пустое поле — демо-значение.',
    placeholder: 'Например, 4',
  },
  {
    name: 'companyAgeYears',
    label: 'Возраст бизнеса для скоринга, лет',
    hint: 'Используется в модели скоринга. Пустое поле — демо-значение.',
    placeholder: 'Например, 9',
  },
] as const

const trendOptions = [
  { key: 'GROWING', content: 'Растёт' },
  { key: 'STABLE', content: 'Стабильна' },
  { key: 'DECLINING', content: 'Снижается' },
]

const trendLabels: Record<RevenueTrend, string> = {
  GROWING: 'растёт',
  STABLE: 'стабильна',
  DECLINING: 'снижается',
}

function withDemo(hint: string, demoValue: string | number | undefined) {
  return demoValue == null ? hint : `${hint} Сейчас: ${demoValue}.`
}

export function ExternalDataFields({
  value,
  onChange,
  onBlur,
  demo,
  errors = {},
}: ExternalDataFieldsProps) {
  const id = useId()
  return (
    <section className={styles.panel} aria-labelledby={`${id}-title`}>
      <header className={styles.header}>
        <span className={styles.badge}>Демо</span>
        <h3 className={styles.title} id={`${id}-title`}>
          Внешние данные для скоринга
        </h3>
      </header>
      <p className={styles.note}>
        Эти значения влияют на скоринговый балл и решение по заявке. В реальном
        сценарии банк получает их из БКИ, ФНС и реестров. Если поле оставить
        пустым, применится демо-значение по ИНН — оно указано в подсказке.
      </p>
      <div className={styles.grid}>
        {numberFields.map((field) => (
          <div key={field.name} className={styles.field}>
            <FieldLabel
              htmlFor={`${id}-${field.name}`}
              text={field.label}
              hint={withDemo(field.hint, demo?.[field.name])}
            />
            <Input
              id={`${id}-${field.name}`}
              name={field.name}
              aria-label={field.label}
              block
              size={48}
              inputMode="numeric"
              value={value[field.name] ?? ''}
              placeholder={field.placeholder}
              error={errors[field.name]}
              onChange={(_, { value: next }) => onChange({ [field.name]: next })}
              onBlur={() => onBlur?.(field.name)}
            />
          </div>
        ))}
        <div className={styles.field}>
          <FieldLabel
            htmlFor={`${id}-revenueTrend-input`}
            text="Динамика выручки"
            hint={withDemo(
              'Как менялась выручка за последний год. Пустое поле — демо-значение.',
              demo ? trendLabels[demo.revenueTrend] : undefined,
            )}
          />
          <Select
            id={`${id}-revenueTrend`}
            name="revenueTrend"
            block
            size={48}
            options={trendOptions}
            selected={value.revenueTrend || null}
            placeholder="Демо-значение"
            error={errors.revenueTrend}
            onChange={({ selected }) =>
              onChange({ revenueTrend: selected?.key ?? '' })
            }
            onBlur={() => onBlur?.('revenueTrend')}
          />
        </div>
      </div>
    </section>
  )
}
