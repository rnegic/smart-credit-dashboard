import { useId, useRef, useState, type FormEvent } from 'react'
import { Button } from '@alfalab/core-components/button'
import { AmountInput } from '@alfalab/core-components/amount-input'
import { Select } from '@alfalab/core-components/select'
import { Typography } from '@alfalab/core-components/typography'
import {
  contractIssueBlockedLabels,
  getContract,
  issueTranche,
  trancheRequestSchema,
  useContract,
  type Contract,
  type TrancheRequest,
} from '@/entities/contract'
import { ApiError } from '@/shared/api'
import { formatDate, formatMoney } from '@/shared/lib'
import { Panel, RequestState } from '@/shared/ui'
import { getTrancheErrorMessage, isIssuanceUncertain, useTrancheMutation } from '../../model/use-tranche-mutation'
import styles from './IssueTranche.module.scss'

/** Opens an explicit, validated issuance form for one signed contract. */
export interface IssueTrancheProps {
  contract: Contract
}

export function IssueTranche({ contract }: IssueTrancheProps) {
  const [open, setOpen] = useState(false)
  const [amountMinor, setAmountMinor] = useState<number | null>(null)
  const [termDays, setTermDays] = useState<number | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [reviewRequired, setReviewRequired] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const submitting = useRef(false)
  const id = useId()
  const latest = useContract(contract.id, open)
  const current = latest.data
  const selected = current?.trancheTerms.find((term) => term.termDays === termDays)
  const issue = useTrancheMutation(async (input: TrancheRequest & {
    expectedRate: number
    expectedDueDate: string
  }, assertCurrent) => {
    const fresh = await getContract(contract.id)
    const term = fresh.trancheTerms.find((option) => option.termDays === input.termDays)
    if (!fresh.canIssueTranche)
      throw new ApiError(409, fresh.issueBlockedReason ?? 'CONTRACT_NOT_ACTIVE',
        fresh.issueBlockedReason ? contractIssueBlockedLabels[fresh.issueBlockedReason] : 'Выдача транша недоступна.')
    if (!term?.available)
      throw new ApiError(422, 'TRANCHE_EXCEEDS_CONTRACT', 'Выберите меньший срок транша.')
    if (term.ratePercent === null)
      throw new ApiError(422, 'RATE_UNAVAILABLE', 'Ставка для этого срока недоступна.')
    if (term.ratePercent !== input.expectedRate || term.dueDate !== input.expectedDueDate)
      throw new ApiError(409, 'TRANCHE_TERMS_CHANGED', 'Условия транша обновились. Проверьте ставку и дату погашения перед получением.')
    if (input.amount < fresh.minTrancheAmount)
      throw new ApiError(422, 'TRANCHE_AMOUNT_TOO_SMALL', `Минимальная сумма: ${formatMoney(fresh.minTrancheAmount, { exact: true })}`)
    if (input.amount > fresh.availableLimit)
      throw new ApiError(422, 'LIMIT_EXCEEDED', `Доступно: ${formatMoney(fresh.availableLimit, { exact: true })}`)
    assertCurrent()
    return issueTranche(contract.id, { amount: input.amount, termDays: input.termDays })
  })
  const uncertain = reviewRequired || isIssuanceUncertain(issue.error)
  const availableTerms = current?.trancheTerms.some((term) => term.available && term.ratePercent !== null)

  function submit(event: FormEvent) {
    event.preventDefault()
    if (submitting.current || uncertain || latest.isFetching || latest.isError || !current?.canIssueTranche)
      return
    const result = trancheRequestSchema.safeParse({
      amount: amountMinor === null ? null : amountMinor / 100,
      termDays,
    })
    const nextErrors: Record<string, string> = {}
    if (!result.success)
      for (const issue of result.error.issues) nextErrors[String(issue.path[0])] = issue.message
    else if (result.data.amount < current.minTrancheAmount)
      nextErrors.amount = `От ${formatMoney(current.minTrancheAmount, { exact: true })}`
    else if (result.data.amount > current.availableLimit)
      nextErrors.amount = `Не больше ${formatMoney(current.availableLimit, { exact: true })}`
    if (termDays !== null && (!selected?.available || selected.ratePercent === null))
      nextErrors.termDays = 'Выберите доступный срок со ставкой'
    setErrors(nextErrors)
    if (!result.success || Object.keys(nextErrors).length || !selected || selected.ratePercent === null) return
    submitting.current = true
    issue.mutate({ ...result.data, expectedRate: selected.ratePercent, expectedDueDate: selected.dueDate }, {
      onSettled: () => { submitting.current = false },
      onError: (error) => { if (isIssuanceUncertain(error)) setReviewRequired(true) },
    })
  }

  function edit() {
    setErrors({})
    if (!uncertain) issue.reset()
  }

  function close() {
    setOpen(false)
    if (issue.isSuccess) {
      setAmountMinor(null)
      setTermDays(null)
      issue.reset()
    }
  }

  return (
    <>
      <Button ref={trigger} view="primary" size={48} disabled={!contract.canIssueTranche}
        onClick={() => { setOpen(true) }}>
        Получить транш
      </Button>
      <Panel open={open} title={`Получить транш по договору № ${contract.id}`}
        dismissible={!issue.isPending} returnFocusRef={trigger} onClose={close}>
        {issue.isSuccess && issue.data ? (
          <div className={styles.form} role="status">
            <Typography.TitleResponsive tag="h2" view="small" font="system">Транш получен</Typography.TitleResponsive>
            <Typography.Text tag="p">
              № {issue.data.id} · {formatMoney(issue.data.amount, { exact: true })} · {issue.data.termDays} дней
            </Typography.Text>
            <Typography.Text tag="p">
              Ставка {String(issue.data.ratePercent).replace('.', ',')}% годовых. Погасить до {formatDate(issue.data.dueDate)}.
            </Typography.Text>
            <Button view="secondary" onClick={close}>К договору</Button>
          </div>
        ) : !current ? (
          <RequestState error={latest.error} retry={() => { void latest.refetch() }}>Загружаем условия транша...</RequestState>
        ) : (
          <form className={styles.form} onSubmit={submit} noValidate aria-busy={issue.isPending}>
            <Typography.Text tag="p" color="secondary">
              Доступно {formatMoney(current.availableLimit, { exact: true })}. Минимум {formatMoney(current.minTrancheAmount, { exact: true })}.
            </Typography.Text>
            <AmountInput id={`${id}-amount`} name="amount" label="Сумма транша" labelView="outer"
              required block value={amountMinor} minority={100} error={errors.amount}
              disabled={issue.isPending || uncertain}
              onChange={(_, { value }) => { setAmountMinor(value); edit() }} />
            <Select id={`${id}-term`} name="termDays" label="Срок транша" labelView="outer" block
              fieldProps={{ 'aria-required': true }}
              selected={termDays === null ? null : String(termDays)} placeholder="Выберите срок"
              error={errors.termDays} disabled={issue.isPending || uncertain}
              options={current.trancheTerms.map((term) => ({
                key: String(term.termDays),
                content: `${term.termDays} дней${!term.available ? ' · За пределами договора' : term.ratePercent === null ? ' · Ставка недоступна' : ` · ${String(term.ratePercent).replace('.', ',')}% годовых`}`,
                disabled: !term.available || term.ratePercent === null,
              }))}
              onChange={({ selected }) => { setTermDays(selected ? Number(selected.key) : null); edit() }} />
            {selected?.available && selected.ratePercent !== null && (
              <Typography.Text tag="p">Погасить до {formatDate(selected.dueDate)}. Ставка фиксируется при получении транша.</Typography.Text>
            )}
            <Typography.Text tag="p" view="primary-small" color="secondary">
              {current.revolving
                ? 'После погашения доступный лимит восстановится.'
                : 'Лимит расходуется на общую сумму всех траншей за срок договора. Погашение его не восстанавливает.'}
            </Typography.Text>
            {!current.canIssueTranche && (
              <p role="alert">{current.issueBlockedReason ? contractIssueBlockedLabels[current.issueBlockedReason] : 'Получение транша недоступно.'}</p>
            )}
            {current.canIssueTranche && !availableTerms && <p role="alert">Нет доступных сроков со ставкой. Обновите условия.</p>}
            {latest.error && <RequestState error={latest.error} retry={() => { void latest.refetch() }} />}
            {issue.error && <p role="alert">{getTrancheErrorMessage(issue.error)}</p>}
            {uncertain && (
              <div className={styles.form} role="alert">
                <Typography.Text tag="p">Результат выдачи не подтверждён. Проверьте список траншей по договору перед повторной попыткой.</Typography.Text>
                <Button view="secondary" loading={latest.isFetching} onClick={async () => {
                  const refreshed = await latest.refetch()
                  if (refreshed.isError) return
                  setReviewRequired(false)
                  setAmountMinor(null)
                  setTermDays(null)
                  issue.reset()
                  setOpen(false)
                }}>Проверить договор</Button>
              </div>
            )}
            <Button type="submit" view="primary" block loading={issue.isPending}
              disabled={issue.isPending || uncertain || latest.isFetching || latest.isError || !current.canIssueTranche || !availableTerms}>
              Получить транш
            </Button>
          </form>
        )}
      </Panel>
    </>
  )
}
