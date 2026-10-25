import { useRef, useState } from 'react'
import { Button } from '@alfalab/core-components/button'
import { Typography } from '@alfalab/core-components/typography'
import { repayTranche, useContract, type Tranche } from '@/entities/contract'
import { formatDate, formatMoney } from '@/shared/lib'
import { Panel, RequestState } from '@/shared/ui'
import { getTrancheErrorMessage, useTrancheMutation } from '../../model/use-tranche-mutation'
import styles from './RepayTranche.module.scss'

/** Confirm a full repayment using the latest server-calculated debt and interest. */
export interface RepayTrancheProps {
  tranche: Tranche
}

export function RepayTranche({ tranche }: RepayTrancheProps) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const submitting = useRef(false)
  const latest = useContract(tranche.contractId, open)
  const current = latest.data?.tranches.find((item) => item.id === tranche.id)
  const repay = useTrancheMutation((id: number) => repayTranche(id))
  const repaid = repay.data ?? current

  return (
    <>
      {tranche.status !== 'REPAID' && (
        <Button ref={trigger} view="secondary" size={40} onClick={() => setOpen(true)}
          aria-label={`Погасить транш № ${tranche.id}`}>
          Погасить транш
        </Button>
      )}
      <Panel open={open} title={`Погасить транш № ${tranche.id}`} dismissible={!repay.isPending}
        returnFocusRef={trigger} onClose={() => { setOpen(false); repay.reset() }}>
        <div className={styles.content} aria-busy={repay.isPending}>
          {!current && !repay.isSuccess ? (
            latest.data && !latest.isFetching ? (
              <Typography.Text tag="p" role="alert">Транш больше не доступен в этом договоре.</Typography.Text>
            ) : (
              <RequestState error={latest.error} retry={() => { void latest.refetch() }}>Уточняем сумму погашения...</RequestState>
            )
          ) : repaid?.status === 'REPAID' ? (
            <div className={styles.content} role="status">
              <Typography.TitleResponsive tag="h2" view="small" font="system">Транш погашен</Typography.TitleResponsive>
              <Typography.Text tag="p">Уплачено {formatMoney(repaid.totalToRepay, { exact: true })}{repaid.repaidAt ? ` · ${formatDate(repaid.repaidAt)}` : ''}.</Typography.Text>
              <Button view="secondary" onClick={() => { setOpen(false); repay.reset() }}>К договору</Button>
            </div>
          ) : current ? (
            <>
              <dl className={styles.parameters}>
                <div><dt>Основной долг</dt><dd>{formatMoney(current.amount, { exact: true })}</dd></div>
                <div><dt>Начисленные проценты</dt><dd>{formatMoney(current.accruedInterest, { exact: true })}</dd></div>
                <div><dt>К погашению сегодня</dt><dd>{formatMoney(current.totalToRepay, { exact: true })}</dd></div>
                <div><dt>Погасить до</dt><dd>{formatDate(current.dueDate)}</dd></div>
              </dl>
              <Typography.Text tag="p" view="primary-small" color="secondary">
                Полное погашение основного долга и процентов за фактический срок пользования. Итоговую сумму подтверждает сервер.
                {latest.data?.revolving === false && ' Погашение не восстанавливает лимит договора.'}
              </Typography.Text>
              {latest.error && <RequestState error={latest.error} retry={() => { void latest.refetch() }} />}
              {repay.error && <p role="alert">{getTrancheErrorMessage(repay.error)}</p>}
              <Button view="primary" block loading={repay.isPending}
                disabled={repay.isPending || latest.isFetching || latest.isError}
                onClick={() => {
                  if (submitting.current || latest.isFetching || latest.isError) return
                  submitting.current = true
                  repay.mutate(current.id, { onSettled: () => { submitting.current = false } })
                }}>
                Погасить полностью
              </Button>
            </>
          ) : null}
        </div>
      </Panel>
    </>
  )
}
