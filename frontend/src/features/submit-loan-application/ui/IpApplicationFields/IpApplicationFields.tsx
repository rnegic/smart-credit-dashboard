import { Fragment, useId, type ComponentProps } from 'react'
import { Input } from '@alfalab/core-components/input'
import { Select } from '@alfalab/core-components/select'
import { Checkbox } from '@alfalab/core-components/checkbox'
import { Button } from '@alfalab/core-components/button'
import { FieldLabel } from '@/shared/ui'
import styles from './IpApplicationFields.module.scss'

export interface IpApplicationData {
  companyName: string
  inn: string
  legalForm: string
  taxSystem: string
  monthlyRevenue: string
  monthlyDebtPayment: string
  personalData: boolean
  bkiRequest: boolean
  fnsRequest: boolean
  fullName: string
  ogrnip: string
  registrationDate: string
  okved: string
  registrationAddress: string
  phone: string
  email: string
  industry: string
}

export interface IpApplicationFieldsProps {
  section: 'business' | 'registration'
  value: IpApplicationData
  onChange: (patch: Partial<IpApplicationData>) => void
  profileMatches?: boolean
  confirmed?: boolean
  onConfirm?: () => void
  aiFilled?: ReadonlySet<string>
  missingFields?: ReadonlySet<string>
  errors?: Readonly<Record<string, string>>
}

type TextFieldName =
  | 'companyName'
  | 'inn'
  | 'legalForm'
  | 'monthlyRevenue'
  | 'monthlyDebtPayment'
  | 'fullName'
  | 'ogrnip'
  | 'registrationDate'
  | 'okved'
  | 'registrationAddress'
  | 'phone'
  | 'email'

type TextField = {
  name: TextFieldName
  label: string
  hint?: string
  placeholder?: string
  type?: ComponentProps<typeof Input>['type']
  inputMode?: 'numeric' | 'decimal'
  wide?: boolean
  required?: boolean
}

const businessFields: TextField[] = [
  {
    name: 'companyName',
    label: 'Название',
    hint: 'Полное название ИП',
    required: true,
  },
  {
    name: 'inn',
    label: 'ИНН',
    hint: '12 цифр, из свидетельства ИП',
    inputMode: 'numeric',
    required: true,
  },
  { name: 'legalForm', label: 'Форма бизнеса', required: true },
  {
    name: 'monthlyRevenue',
    label: 'Среднемесячная выручка, ₽',
    hint: 'Примерно, за последние 6 месяцев',
    inputMode: 'decimal',
    placeholder: 'Укажите среднюю выручку',
    required: true,
  },
  {
    name: 'monthlyDebtPayment',
    label: 'Платеж по действующим кредитам, ₽',
    hint: 'Если кредитов нет — оставьте 0',
    inputMode: 'decimal',
  },
]
const registrationFields: TextField[] = [
  {
    name: 'fullName',
    label: 'ФИО',
    hint: 'Фамилия, имя и отчество предпринимателя. Проверьте данные профиля.',
    wide: true,
  },
  {
    name: 'ogrnip',
    label: 'ОГРНИП',
    hint: '15 цифр, из Единого государственного реестра индивидуальных предпринимателей',
    inputMode: 'numeric',
    placeholder: 'Номер регистрации ИП',
  },
  {
    name: 'registrationDate',
    label: 'Дата регистрации ИП',
    hint: 'Дата государственной регистрации предпринимателя',
    inputMode: 'numeric',
    placeholder: 'ДД.ММ.ГГГГ',
  },
  {
    name: 'okved',
    label: 'Основной ОКВЭД',
    hint: 'Код основного вида деятельности из ЕГРИП',
    placeholder: 'Например, 47.11',
  },
  {
    name: 'registrationAddress',
    label: 'Адрес регистрации',
    hint: 'Адрес регистрации предпринимателя по данным реестра',
    wide: true,
    placeholder: 'Город, улица, дом, квартира',
  },
  {
    name: 'phone',
    label: 'Телефон',
    hint: 'Контактный номер. Можно исправить данные из профиля.',
    type: 'tel',
    placeholder: '+7',
  },
  {
    name: 'email',
    label: 'Email',
    hint: 'Адрес электронной почты. Можно исправить данные из профиля.',
    type: 'email',
    placeholder: 'mail@example.ru',
  },
]
const taxOptions = [
  { key: 'OSNO', content: 'ОСНО' },
  { key: 'USN', content: 'УСН' },
  { key: 'PSN', content: 'Патент' },
  { key: 'AUSN', content: 'АУСН' },
  { key: 'NPD', content: 'НПД' },
]

const aiPaths: Partial<Record<TextFieldName | 'taxSystem', string>> = {
  taxSystem: 'step2_businessData.applicant.taxSystem',
  monthlyRevenue: 'step2_businessData.financials.monthlyRevenue',
  monthlyDebtPayment:
    'step2_businessData.financials.existingMonthlyDebtPayment',
}

export function IpApplicationFields({
  section,
  value,
  onChange,
  profileMatches,
  confirmed,
  onConfirm,
  aiFilled = new Set(),
  missingFields = new Set(),
  errors = {},
}: IpApplicationFieldsProps) {
  const id = useId()
  const fields = section === 'business' ? businessFields : registrationFields

  function editPrefill() {
    onChange({})
    document.getElementById(`${id}-fullName`)?.focus()
  }
  function hasAiPath(paths: ReadonlySet<string>, fieldName: TextFieldName) {
    const path = aiPaths[fieldName]
    return path ? paths.has(path) : false
  }
  return (
    <div className={styles.body}>
      {section === 'registration' && (
        <p>
          Проверьте сведения и контакты. Все предзаполненные поля можно
          исправить.
        </p>
      )}
      {section === 'registration' && profileMatches && (
        <div className={styles.prefill}>
          <div>
            <strong>
              <p>
                <span className={styles.check}>✓ </span>
                <span className={confirmed ? styles.confirmed : undefined}>
                  {confirmed ? 'Данные подтверждены' : 'Нашли вашу компанию'}
                </span>
              </p>
            </strong>
            <p>
              {value.companyName}
              {value.ogrnip ? ` · ОГРНИП ${value.ogrnip}` : ''}
            </p>
          </div>
          {onConfirm && (
            <div className={styles.confirmActions}>
              {!confirmed && (
                <Button
                  type="button"
                  view="secondary"
                  size={32}
                  onClick={onConfirm}
                >
                  Это я
                </Button>
              )}
              <Button type="button" view="text" size={32} onClick={editPrefill}>
                Исправить данные
              </Button>
            </div>
          )}
        </div>
      )}
      <div className={styles.grid}>
        {fields.map((field) => (
          <Fragment key={field.name}>
            <div className={field.wide ? styles.wide : undefined}>
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
                type={field.type ?? 'text'}
                autoComplete={
                  field.name === 'phone'
                    ? 'tel'
                    : field.name === 'email'
                      ? 'email'
                      : field.name === 'fullName'
                        ? 'name'
                        : undefined
                }
                inputMode={field.inputMode}
                required={field.required}
                maxLength={
                  field.name === 'inn'
                    ? 12
                    : field.name === 'ogrnip'
                      ? 15
                      : undefined
                }
                value={value[field.name]}
                placeholder={field.placeholder}
                error={
                  errors[field.name] ??
                  (hasAiPath(missingFields, field.name) &&
                  !value[field.name].trim()
                    ? 'Заполните поле'
                    : undefined)
                }
                onChange={(_, { value: next }) =>
                  onChange({ [field.name]: next })
                }
              />
              {hasAiPath(aiFilled, field.name) && (
                <p className={styles.aiNote}>Заполнено ИИ, проверьте</p>
              )}
            </div>
            {section === 'business' && field.name === 'legalForm' && (
              <div>
                <FieldLabel
                  htmlFor={`${id}-taxSystem`}
                  text="Система налогообложения"
                  hint="Влияет на продукт"
                />
                <Select
                  id={`${id}-taxSystem`}
                  name="taxSystem"
                  block
                  size={48}
                  options={taxOptions}
                  selected={value.taxSystem || null}
                  fieldProps={{ 'aria-label': 'Система налогообложения' }}
                  placeholder="Выберите систему налогообложения"
                  error={errors.taxSystem}
                  onChange={({ selected }) =>
                    onChange({ taxSystem: selected?.key ?? '' })
                  }
                />
                {aiFilled.has(aiPaths.taxSystem ?? '') && (
                  <p className={styles.aiNote}>Заполнено ИИ, проверьте</p>
                )}
              </div>
            )}
          </Fragment>
        ))}
      </div>
      {section === 'business' && (
        <div className={styles.consents}>
          <FieldLabel
            text="Согласия"
            hint="Обработка персональных данных, запрос кредитной истории и сведений ФНС для рассмотрения заявки"
          />
          <Checkbox
            id={`${id}-personalData`}
            name="personalData"
            required
            checked={value.personalData}
            error={errors.personalData}
            onChange={(_, { checked }) => onChange({ personalData: checked })}
            label="Согласен на обработку персональных данных"
          />
          <Checkbox
            name="bkiRequest"
            required
            checked={value.bkiRequest}
            error={errors.bkiRequest}
            onChange={(_, { checked }) => onChange({ bkiRequest: checked })}
            label="Разрешаю запрос кредитной истории"
          />
          <Checkbox
            name="fnsRequest"
            required
            checked={value.fnsRequest}
            error={errors.fnsRequest}
            onChange={(_, { checked }) => onChange({ fnsRequest: checked })}
            label="Разрешаю получение сведений ФНС"
          />
          <details>
            <summary>Подробнее о согласиях</summary>
            <p>
              Обработка персональных данных, запрос кредитной истории и сведений
              ФНС для рассмотрения заявки.
            </p>
          </details>
        </div>
      )}
    </div>
  )
}
