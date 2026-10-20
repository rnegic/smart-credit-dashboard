const rubles = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
})

/** Formats an amount expressed in rubles. */
export function formatMoney(amount: number): string {
  return rubles.format(amount)
}
