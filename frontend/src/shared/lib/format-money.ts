const rubles = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
})

const exactRubles = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

/** Formats rubles, optionally preserving kopecks without changing the default. */
export function formatMoney(
  amount: number,
  options?: { exact?: boolean },
): string {
  return (options?.exact ? exactRubles : rubles).format(amount)
}
