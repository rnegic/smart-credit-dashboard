import { useId, type ComponentProps } from 'react'
import { Input } from '@alfalab/core-components/input'
import { Select } from '@alfalab/core-components/select'
import { Checkbox } from '@alfalab/core-components/checkbox'
import { Button } from '@alfalab/core-components/button'
import { getIndustryGroup } from '@/entities/company'
import { formatDate } from '@/shared/lib'
import { FieldLabel } from '@/shared/ui'
import type { IpApplicationData } from '../IpApplicationFields'
import styles from './OooApplicationFields.module.scss'

/** Corporate fields supported by the application and draft API. */
export interface OooApplicationData
  extends Omit<IpApplicationData, 'legalForm' | 'fullName' | 'ogrnip'> {
  ogrn: string
  kpp: string
  annualRevenue: string
  averageEmployeeCount: string
  otherMonthlyObligations: string
}

/** One corporate wizard section, also reused on the final review screen. */
export interface OooApplicationFieldsProps {
  section: 'business' | 'registration' | 'consents'
  value: OooApplicationData
  onChange: (patch: Partial<OooApplicationData>) => void
  onBlur?: (field: keyof OooApplicationData) => void
  confirmed?: boolean
  onConfirm?: () => void
  onEdit?: () => void
  aiFilled?: ReadonlySet<string>
  missingFields?: ReadonlySet<string>
  errors?: Readonly<Record<string, string>>
}

type TextFieldName = Exclude<
  keyof OooApplicationData,
  'personalData' | 'bkiRequest' | 'fnsRequest' | 'taxSystem' | 'industry'
>
type TextField = {
  name: TextFieldName
  label: string
  hint: string
  inputMode?: 'numeric' | 'decimal'
  type?: ComponentProps<typeof Input>['type']
  maxLength?: number
  readOnly?: boolean
  wide?: boolean
}

const companyFields: TextField[] = [
  {
    name: 'companyName',
    label: 'Наименование организации',
    hint: 'Название из профиля организации в банке',
    readOnly: true,
    wide: true,
  },
  {
    name: 'inn',
    label: 'ИНН ООО',
    hint: '10 цифр. ИНН организации из профиля банка',
    inputMode: 'numeric',
    maxLength: 10,
    readOnly: true,
  },
]
const financialFields: TextField[] = [
  {
    name: 'annualRevenue',
    label: 'Годовая выручка, ₽',
    hint: 'За последний завершенный отчетный год. Укажите отдельно от среднемесячной выручки',
    inputMode: 'decimal',
  },
  {
    name: 'averageEmployeeCount',
    label: 'Среднесписочная численность',
    hint: 'Целое число сотрудников за тот же отчетный год. Допускается 0',
    inputMode: 'numeric',
  },
  {
    name: 'monthlyRevenue',
    label: 'Среднемесячная выручка, ₽',
    hint: 'Средняя выручка за последние 6 месяцев, больше 0',
    inputMode: 'decimal',
    wide: true,
  },
  {
    name: 'existingDebt',
    label: 'Ежемесячные платежи по кредитам, ₽',
    hint: 'Сумма платежей по действующим кредитам. Если кредитов нет, оставьте 0',
    inputMode: 'decimal',
  },
  {
    name: 'otherMonthlyObligations',
    label: 'Иные ежемесячные обязательства, ₽',
    hint: 'Аренда, лизинг и другие регулярные обязательства без платежей по кредитам. При отсутствии оставьте 0',
    inputMode: 'decimal',
  },
]
const registrationFields: TextField[] = [
  {
    name: 'ogrn',
    label: 'ОГРН',
    hint: '13 цифр из ЕГРЮЛ',
    inputMode: 'numeric',
    maxLength: 13,
  },
  {
    name: 'kpp',
    label: 'КПП',
    hint: '9 цифр из сведений организации',
    inputMode: 'numeric',
    maxLength: 9,
  },
  {
    name: 'okved',
    label: 'Основной ОКВЭД',
    hint: 'Код из профиля организации. Банк использует его для определения отрасли',
    readOnly: true,
    wide: true,
  },
  {
    name: 'registrationAddress',
    label: 'Юридический адрес',
    hint: 'Юридический адрес организации по данным ЕГРЮЛ',
    wide: true,
  },
  {
    name: 'phone',
    label: 'Телефон организации',
    hint: 'Контактный номер для связи по заявке',
    type: 'tel',
  },
  {
    name: 'email',
    label: 'Email организации',
    hint: 'Адрес электронной почты для связи по заявке',
    type: 'email',
  },
]
const taxOptions = [
  { key: 'OSNO', content: 'ОСНО' },
  { key: 'USN', content: 'УСН' },
  { key: 'AUSN', content: 'АУСН' },
  { key: 'ESHN', content: 'ЕСХН' },
  { key: 'OTHER', content: 'Иной применимый режим' },
]
const consentFields = [
  { name: 'personalData', label: 'Согласен на обработку персональных данных' },
  { name: 'bkiRequest', label: 'Разрешаю запрос кредитной истории' },
  { name: 'fnsRequest', label: 'Разрешаю получение сведений ФНС' },
] as const

/** Render editable company details without calculating rates or scoring locally. */
export function OooApplicationFields({
  section,
  value,
  onChange,
  onBlur,
  confirmed,
  onConfirm,
  onEdit,
  aiFilled = new Set(),
  missingFields = new Set(),
  errors = {},
}: OooApplicationFieldsProps) {
  const id = useId()
  const industry = getIndustryGroup(value.okved)

  function renderField(field: TextField) {
    const financial = financialFields.some(({ name }) => name === field.name)
    const path = `step2_businessData.${financial ? 'financials' : 'applicant'}.${field.name === 'okved' ? 'mainOkved' : field.name}`
    return (
      <div key={field.name} className={field.wide ? styles.wide : undefined}>
        <FieldLabel
          htmlFor={`${id}-${field.name}`}
          text={field.label}
          hint={field.hint}
        />
        <Input
          id={`${id}-${field.name}`}
          name={field.name}
          aria-label={field.label}
          block
          size={48}
          required
          type={field.type ?? 'text'}
          inputMode={field.inputMode}
          maxLength={field.maxLength}
          readOnly={field.readOnly}
          autoComplete={
            field.type === 'tel'
              ? 'tel'
              : field.type === 'email'
                ? 'email'
                : undefined
          }
          value={value[field.name]}
          error={
            errors[field.name] ??
            (missingFields.has(path) && !value[field.name].trim()
              ? 'Заполните поле'
              : undefined)
          }
          onChange={(_, { value: next }) => onChange({ [field.name]: next })}
          onBlur={() => onBlur?.(field.name)}
        />
        {aiFilled.has(path) && (
          <p className={styles.aiNote}>Заполнено автоматически, проверьте</p>
        )}
      </div>
    )
  }

  if (section === 'consents') {
    return (
      <div className={styles.consents}>
        <FieldLabel
          text="Согласия"
          hint="Необходимы для рассмотрения заявки. Каждое согласие подтверждается отдельно"
        />
        {consentFields.map(({ name, label }) => (
          <Checkbox
            key={name}
            name={name}
            required
            checked={value[name]}
            label={label}
            error={errors[name]}
            onChange={(_, { checked }) => onChange({ [name]: checked })}
            onBlur={() => onBlur?.(name)}
          />
        ))}
      </div>
    )
  }

  return (
    <div className={styles.body}>
      {section === 'business' ? (
        <>
          <p>
            Форма бизнеса: ООО. Наименование и ИНН берутся из профиля организации
            в банке. Если они не совпадают, обратитесь к сотруднику банка.
          </p>
          <div className={styles.grid}>
            {companyFields.map(renderField)}
            <div>
              <FieldLabel
                htmlFor={`${id}-taxSystem-input`}
                text="Система налогообложения"
                hint="Выберите действующий налоговый режим ООО. Патент и НПД для ООО не применяются"
              />
              <Select
                id={`${id}-taxSystem`}
                name="taxSystem"
                block
                size={48}
                options={taxOptions}
                selected={value.taxSystem || null}
                fieldProps={{
                  'aria-required': true,
                  'aria-label': 'Система налогообложения',
                }}
                placeholder="Выберите систему налогообложения"
                error={errors.taxSystem}
                onChange={({ selected }) =>
                  onChange({ taxSystem: selected?.key ?? '' })
                }
                onBlur={() => onBlur?.('taxSystem')}
              />
              {aiFilled.has('step2_businessData.applicant.taxSystem') && (
                <p className={styles.aiNote}>Заполнено автоматически, проверьте</p>
              )}
            </div>
          </div>
          <h3 className={styles.title}>Финансы организации</h3>
          <div className={styles.grid}>{financialFields.map(renderField)}</div>
          <div className={styles.notice}>
            <strong>Масштаб бизнеса и предварительная ставка</strong>
            <p>
              Банк определит масштаб по годовой выручке и численности, а ставку
              с учетом срока. Расчет появится после отправки заявки и не означает
              одобрение кредита.
            </p>
          </div>
        </>
      ) : (
        <>
          <p>
            Проверьте сведения ЕГРЮЛ и контакты. Если ОГРН, КПП или адрес не
            заполнены, укажите их по документам организации.
          </p>
          <div className={styles.grid}>{registrationFields.map(renderField)}</div>
          <dl className={styles.details}>
            <div>
              <dt>Группа отраслей (ОКВЭД)</dt>
              <dd>{industry?.label ?? 'Не определена'}</dd>
            </div>
            {value.registrationDate && (
              <div>
                <dt>Дата регистрации по данным банка</dt>
                <dd>{formatDate(value.registrationDate)}</dd>
              </div>
            )}
          </dl>
          {errors.industry && <p role="alert">{errors.industry}</p>}
          <div className={styles.notice}>
            <strong className={confirmed ? styles.confirmed : undefined}>
              {confirmed && (
                <span className={styles.check} aria-hidden="true">✓ </span>
              )}
              {confirmed
                ? 'Сведения об организации подтверждены'
                : 'Подтвердите вашу организацию'}
            </strong>
            <p>{value.companyName} · ИНН {value.inn}</p>
            <p>ОГРН {value.ogrn || 'не указан'} · КПП {value.kpp || 'не указан'}</p>
            <div className={styles.actions}>
              {!confirmed && onConfirm && (
                <Button
                  type="button"
                  name="confirmed"
                  view="secondary"
                  size={32}
                  onClick={onConfirm}
                >
                  Это наша компания
                </Button>
              )}
              <Button
                type="button"
                view="text"
                size={32}
                onClick={() => {
                  if (onEdit) onEdit()
                  else onChange({})
                  document.getElementById(`${id}-ogrn`)?.focus()
                }}
              >
                Данные не совпадают
              </Button>
            </div>
            {errors.confirmed && <p role="alert">{errors.confirmed}</p>}
          </div>
        </>
      )}
    </div>
  )
}
