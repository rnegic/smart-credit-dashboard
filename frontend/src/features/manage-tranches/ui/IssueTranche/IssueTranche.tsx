import { useId, useRef, useState, type FormEvent } from 'react'
import { Button } from '@alfalab/core-components/button'
import { AmountInput } from '@alfalab/core-components/amount-input'
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
  const [amountError, setAmountError] = useState<string>()
  const [reviewRequired, setReviewRequired] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const submitting = useRef(false)
  const id = useId()
  const latest = useContract(contract.id, open)
  const current = latest.data
  const terms = current?.trancheTerms
  const issue = useTrancheMutation(async (input: TrancheRequest & {
    expectedTermDays: Contract['trancheTerms']['termDays']
    expectedRate: number
    expectedDueDate: string
  }, assertCurrent) => {
    const fresh = await getContract(contract.id)
    const term = fresh.trancheTerms
    if (!fresh.canIssueTranche)
      throw new ApiError(409, fresh.issueBlockedReason ?? 'CONTRACT_NOT_ACTIVE',
        fresh.issueBlockedReason ? contractIssueBlockedLabels[fresh.issueBlockedReason] : 'Выдача транша недоступна.')
    if (!term.available)
      throw new ApiError(422, 'TRANCHE_EXCEEDS_CONTRACT', contractIssueBlockedLabels.CONTRACT_ENDING)
    if (term.ratePercent === null)
      throw new ApiError(422, 'RATE_UNAVAILABLE', contractIssueBlockedLabels.RATE_UNAVAILABLE)
    if (term.termDays !== input.expectedTermDays || term.ratePercent !== input.expectedRate || term.dueDate !== input.expectedDueDate)
      throw new ApiError(409, 'TRANCHE_TERMS_CHANGED', 'Условия транша обновились. Проверьте согласованный срок, ставку и дату погашения перед получением.')
    if (input.amount < fresh.minTrancheAmount)
      throw new ApiError(422, 'TRANCHE_AMOUNT_TOO_SMALL', `Минимальная сумма: ${formatMoney(fresh.minTrancheAmount, { exact: true })}`)
    if (input.amount > fresh.availableLimit)
      throw new ApiError(422, 'LIMIT_EXCEEDED', `Доступно: ${formatMoney(fresh.availableLimit, { exact: true })}`)
    assertCurrent()
    return issueTranche(contract.id, { amount: input.amount })
  })
  const uncertain = reviewRequired || isIssuanceUncertain(issue.error)
  const termsAvailable = terms?.available && terms.ratePercent !== null

  function submit(event: FormEvent) {
    event.preventDefault()
    if (submitting.current || uncertain || latest.isFetching || latest.isError || !current?.canIssueTranche || !terms?.available || terms.ratePercent === null)
      return
    const result = trancheRequestSchema.safeParse({
      amount: amountMinor === null ? null : amountMinor / 100,
    })
    let error: string | undefined
    if (!result.success)
      error = result.error.issues[0]?.message
    else if (result.data.amount < current.minTrancheAmount)
      error = `От ${formatMoney(current.minTrancheAmount, { exact: true })}`
    else if (result.data.amount > current.availableLimit)
      error = `Не больше ${formatMoney(current.availableLimit, { exact: true })}`
    setAmountError(error)
    if (!result.success || error) return
    submitting.current = true
    issue.mutate({ ...result.data, expectedTermDays: terms.termDays, expectedRate: terms.ratePercent, expectedDueDate: terms.dueDate }, {
      onSettled: () => { submitting.current = false },
      onError: (error) => { if (isIssuanceUncertain(error)) setReviewRequired(true) },
    })
  }

  function edit() {
    setAmountError(undefined)
    if (!uncertain) issue.reset()
  }

  function close() {
    setOpen(false)
    if (issue.isSuccess) {
      setAmountMinor(null)
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
              required block value={amountMinor} minority={100} error={amountError}
              disabled={issue.isPending || uncertain}
              onChange={(_, { value }) => { setAmountMinor(value); edit() }} />
            <dl className={styles.parameters}>
              <div><dt>Срок транша по договору</dt><dd>{current.trancheTerms.termDays} дней</dd></div>
              <div><dt>Согласованная ставка</dt><dd>{current.trancheTerms.ratePercent === null ? 'Ставка недоступна' : `${String(current.trancheTerms.ratePercent).replace('.', ',')}% годовых`}</dd></div>
              <div><dt>Погасить новый транш до</dt><dd>{formatDate(current.trancheTerms.dueDate)}</dd></div>
            </dl>
            <Typography.Text tag="p" view="primary-small" color="secondary">
              Срок и ставка зафиксированы в договоре. Дату погашения нового транша рассчитывает сервер.
            </Typography.Text>
            <Typography.Text tag="p" view="primary-small" color="secondary">
              {current.revolving
                ? 'После погашения доступный лимит восстановится.'
                : 'Лимит расходуется на общую сумму всех траншей за срок договора. Погашение его не восстанавливает.'}
            </Typography.Text>
            {!current.canIssueTranche && (
              <p role="alert">{current.issueBlockedReason ? contractIssueBlockedLabels[current.issueBlockedReason] : 'Получение транша недоступно.'}</p>
            )}
            {current.canIssueTranche && !current.trancheTerms.available && <p role="alert">{contractIssueBlockedLabels.CONTRACT_ENDING}</p>}
            {current.canIssueTranche && current.trancheTerms.ratePercent === null && <p role="alert">{contractIssueBlockedLabels.RATE_UNAVAILABLE}</p>}
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
                  issue.reset()
                  setOpen(false)
                }}>Проверить договор</Button>
              </div>
            )}
            <Button type="submit" view="primary" block loading={issue.isPending}
              disabled={issue.isPending || uncertain || latest.isFetching || latest.isError || !current.canIssueTranche || !termsAvailable}>
              Получить транш
            </Button>
          </form>
        )}
      </Panel>
    </>
  )
}
