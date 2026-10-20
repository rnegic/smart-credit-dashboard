export const demoApplication = {
  id: 'demo-1042',
  number: 'КР-1042',
  amount: 3_000_000,
  termMonths: 24,
  productName: 'Оборотный кредит',
  purpose: 'Закупка товара',
  status: 'checking',
  statusLabel: 'Проверяем данные',
  activeStep: 2,
  submittedLabel: '20 октября 2026, 12:42',
} as const

export const applicationSteps = [
  'Заявка',
  'Проверка',
  'Решение',
  'Подписание',
  'Выдача',
] as const

export const demoDocuments = [
  {
    id: 'questionnaire',
    title: 'Анкета предпринимателя',
    description: 'Сведения о компании и цели кредита',
  },
  {
    id: 'statement',
    title: 'Выписка по счету',
    description: 'Финансовые данные за 6 месяцев',
  },
  {
    id: 'consent',
    title: 'Согласие на обработку данных',
    description: 'Для рассмотрения кредитной заявки',
  },
] as const
