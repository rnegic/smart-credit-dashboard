import { Fragment, useId, type ComponentProps } from 'react'
import { Input } from '@alfalab/core-components/input'
import { Select } from '@alfalab/core-components/select'
import { Checkbox } from '@alfalab/core-components/checkbox'
import { Button } from '@alfalab/core-components/button'
import { getIndustryGroup, industryGroups } from '@/entities/company'
import { FieldLabel } from '@/shared/ui'
import styles from './IpApplicationFields.module.scss'

export interface IpApplicationData {
  companyName: string
  inn: string
  legalForm: string
  taxSystem: string
  monthlyRevenue: string
  existingDebt: string
  personalData: boolean
  bkiRequest: boolean
  fnsRequest: boolean
  fullName: string
  ogrnip: string
  /** Registry metadata retained in drafts and requests, not an editable field. */
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
  | 'existingDebt'
  | 'fullName'
  | 'ogrnip'
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
}

const businessFields: TextField[] = [
  {
    name: 'companyName',
    label: 'Название',
    hint: 'Полное название ИП',
  },
  {
    name: 'inn',
    label: 'ИНН',
    hint: '12 цифр, из свидетельства ИП',
    inputMode: 'numeric',
  },
  { name: 'legalForm', label: 'Форма бизнеса' },
  {
    name: 'monthlyRevenue',
    label: 'Среднемесячная выручка, ₽',
    hint: 'Примерно, за последние 6 месяцев',
    inputMode: 'decimal',
    placeholder: 'Укажите среднюю выручку',
  },
  {
    name: 'existingDebt',
    label: 'Ежемесячный платеж по кредитам, ₽',
    hint: 'Сумма ежемесячных платежей по действующим кредитам. Если кредитов нет, оставьте 0.',
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
    wide: true,
  },
  {
    name: 'okved',
    label: 'Основной ОКВЭД',
    hint: 'Точный код из ЕГРИП. Группа отраслей определяется по первым двум цифрам.',
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
const industryOptions = industryGroups.map(({ key, label }) => ({
  key,
  content: label,
}))

const aiPaths: Partial<Record<TextFieldName | 'taxSystem', string>> = {
  taxSystem: 'step2_businessData.applicant.taxSystem',
  monthlyRevenue: 'step2_businessData.financials.monthlyRevenue',
  existingDebt: 'step2_businessData.financials.existingDebt',
  phone: 'step2_businessData.applicant.phone',
  email: 'step2_businessData.applicant.email',
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
            <div
              className={
                field.wide
                  ? styles.wide
                  : field.name === 'legalForm'
                    ? styles.pairedField
                    : undefined
              }
            >
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
                required
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
                  onChange(
                    field.name === 'okved'
                      ? {
                          okved: next,
                          industry:
                            getIndustryGroup(next)?.key ?? value.industry,
                        }
                      : { [field.name]: next },
                  )
                }
              />
              {hasAiPath(aiFilled, field.name) && (
                <p className={styles.aiNote}>
                  Заполнено автоматически, проверьте
                </p>
              )}
            </div>
            {section === 'business' && field.name === 'legalForm' && (
              <div className={styles.pairedField}>
                <div className={styles.pairedLabel}>
                  <FieldLabel
                    htmlFor={`${id}-taxSystem-input`}
                    text="Система налогообложения"
                    hint="Режим, по которому ИП платит налоги: например, УСН или ОСНО. Свой режим можно проверить в личном кабинете ИП на сайте ФНС."
                  />
                  <span
                    id={`${id}-taxSystem-label`}
                    className={styles.controlLabel}
                  >
                    Система налогообложения
                  </span>
                </div>
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
                />
                {aiFilled.has(aiPaths.taxSystem ?? '') && (
                  <p className={styles.aiNote}>
                    Заполнено автоматически, проверьте
                  </p>
                )}
              </div>
            )}
            {section === 'registration' && field.name === 'okved' && (
              <div>
                <FieldLabel
                  htmlFor={`${id}-industry`}
                  text="Группа отраслей (ОКВЭД)"
                  hint="Выберите диапазон и укажите точный код ОКВЭД. Остальные коды относятся к группе «По умолчанию»."
                />
                <Select
                  id={`${id}-industry`}
                  name="industry"
                  block
                  size={48}
                  options={industryOptions}
                  selected={value.industry || null}
                  fieldProps={{
                    'aria-required': true,
                    'aria-label': 'Группа отраслей (ОКВЭД)',
                  }}
                  placeholder="Выберите группу отраслей"
                  error={errors.industry}
                  onChange={({ selected }) => {
                    const industry = selected?.key ?? ''
                    onChange({
                      industry,
                      okved:
                        getIndustryGroup(value.okved)?.key === industry
                          ? value.okved
                          : '',
                    })
                  }}
                />
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
