import { useId } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@alfalab/core-components/button'
import { IconButton } from '@alfalab/core-components/icon-button'
import { PureCell } from '@alfalab/core-components/pure-cell'
import { Status } from '@alfalab/core-components/status'
import { TooltipDesktop } from '@alfalab/core-components/tooltip/desktop'
import { Typography } from '@alfalab/core-components/typography'
import { ArrowRightMIcon } from '@alfalab/icons/glyph/dist/ArrowRightMIcon'
import { ArrowsCwMIcon } from '@alfalab/icons/glyph/dist/ArrowsCwMIcon'
import { CheckmarkCircleSIcon } from '@alfalab/icons/glyph/dist/CheckmarkCircleSIcon'
import { ClockSIcon } from '@alfalab/icons/glyph/dist/ClockSIcon'
import {
  contractIssueBlockedLabels,
  trancheStatusLabels,
  useContract,
  useContracts,
  type Contract,
} from '@/entities/contract'
import { IssueTranche, RepayTranche } from '@/features/manage-tranches'
import { useApiScope } from '@/shared/api'
import { ROUTES } from '@/shared/config'
import { formatDate, formatMoney } from '@/shared/lib'
import { RequestState } from '@/shared/ui'
import styles from './ContractOverview.module.scss'

function ContractDetails({ contract }: { contract: Contract }) {
  const headingId = useId()
  const navigate = useNavigate()
  const payable = contract.tranches.filter((tranche) => tranche.status !== 'REPAID')
  const debt = payable.reduce((total, tranche) => total + tranche.totalToRepay, 0)
  return (
    <section className={styles.card} aria-labelledby={headingId}>
      <div className={styles.heading}>
        <Typography.TitleResponsive id={headingId} tag="h2" view="medium" font="system">
          Договор № {contract.id}
        </Typography.TitleResponsive>
        <Status color={contract.status === 'ACTIVE' ? 'green' : 'orange'} view="muted"
          size={24} shape="rounded" uppercase={false}
          leftAddons={contract.status === 'ACTIVE'
            ? <CheckmarkCircleSIcon aria-hidden="true" /> : <ClockSIcon aria-hidden="true" />}>
          {contract.status === 'ACTIVE' ? 'Действует' : 'Срок истёк'}
        </Status>
      </div>
      <dl className={styles.metrics}>
        <div><dt>Лимит договора</dt><dd>{formatMoney(contract.limit, { exact: true })}</dd></div>
        <div><dt>Использовано за срок договора</dt><dd>{formatMoney(contract.usedLimit, { exact: true })}</dd></div>
        <div><dt>Доступно для новых траншей</dt><dd>{formatMoney(contract.availableLimit, { exact: true })}</dd></div>
        <div><dt>Основной долг</dt><dd>{formatMoney(contract.outstandingPrincipal, { exact: true })}</dd></div>
      </dl>
      <dl className={styles.parameters}>
        <div><dt>Срок договора</dt><dd>{contract.contractTermMonths} мес.</dd></div>
        <div><dt>Дата начала</dt><dd>{formatDate(contract.startDate)}</dd></div>
        <div><dt>Дата окончания</dt><dd>{formatDate(contract.endDate)}</dd></div>
        <div><dt>Всего к погашению сегодня</dt><dd>{formatMoney(debt, { exact: true })}</dd></div>
      </dl>
      <Typography.Text tag="p" view="primary-small" color="secondary">
        {contract.revolving
          ? 'Доступный лимит восстанавливается после погашения траншей.'
          : 'Лимит договора ограничивает общую сумму всех траншей за весь срок. После погашения использованный лимит не восстанавливается.'}
      </Typography.Text>
      <div className={styles.actions}>
        <IssueTranche contract={contract} />
        <Button view="secondary" size={48} onClick={() => { void navigate(ROUTES.documents) }}>
          Документы договора
        </Button>
      </div>
      {!contract.canIssueTranche && (
        <Typography.Text tag="p" role="status" color="secondary">
          {contract.issueBlockedReason ? contractIssueBlockedLabels[contract.issueBlockedReason] : 'Получение новых траншей недоступно.'}
          {payable.length > 0 && ' Погашение открытых траншей доступно ниже.'}
        </Typography.Text>
      )}
      <section className={styles.section} aria-label="Условия траншей по договору">
        <Typography.TitleResponsive tag="h3" view="small" font="system">Условия траншей по договору</Typography.TitleResponsive>
        <Typography.Text tag="p" view="primary-small" color="secondary">
          Срок и ставка зафиксированы в одобренных условиях и не меняются при получении нового транша. Дата погашения рассчитана сервером для выдачи сегодня.
        </Typography.Text>
        <dl className={styles.parameters}>
          <div><dt>Фиксированный срок нового транша</dt><dd>{contract.trancheTerms.termDays} дней</dd></div>
          <div><dt>Согласованная ставка</dt><dd>{contract.trancheTerms.ratePercent === null ? 'Ставка недоступна' : `${String(contract.trancheTerms.ratePercent).replace('.', ',')}% годовых`}</dd></div>
          <div><dt>Погасить новый транш до</dt><dd>{formatDate(contract.trancheTerms.dueDate)}</dd></div>
        </dl>
        {!contract.trancheTerms.available && <Typography.Text tag="p" view="primary-small" color="secondary">{contractIssueBlockedLabels.CONTRACT_ENDING}</Typography.Text>}
      </section>
      <section className={styles.section} aria-label="Транши договора">
        <Typography.TitleResponsive tag="h3" view="small" font="system">Овердрафты</Typography.TitleResponsive>
        {contract.tranches.length === 0 ? (
          <Typography.Text tag="p" color="secondary">Траншей пока нет. Подписание договора не означает выдачу денег.</Typography.Text>
        ) : (
          <ul className={styles.tranches}>
            {contract.tranches.map((tranche) => (
              <li key={tranche.id} className={styles.tranche}>
                <PureCell tag="div" direction="horizontal" verticalPadding="default">
                  <PureCell.Content>
                    <PureCell.Main>
                      <PureCell.Text titleColor="primary" view="component-primary" rowLimit={2}
                        value={trancheStatusLabels[tranche.status]}
                        valueColor={tranche.status === 'OVERDUE' ? 'negative' : tranche.status === 'REPAID' ? 'positive' : 'secondary'}>
                        Транш № {tranche.id} · {formatMoney(tranche.amount, { exact: true })}
                      </PureCell.Text>
                      <PureCell.Text titleColor="secondary" view="primary-small" rowLimit={2}>
                        {tranche.termDays} дней · {String(tranche.ratePercent).replace('.', ',')}% годовых · Получен {formatDate(tranche.issuedAt)}
                      </PureCell.Text>
                      <PureCell.Text titleColor={tranche.status === 'OVERDUE' ? 'negative' : 'secondary'} view="primary-small">
                        {tranche.status === 'REPAID' && tranche.repaidAt
                          ? `Погашен ${formatDate(tranche.repaidAt)}`
                          : `Погасить до ${formatDate(tranche.dueDate)}`}
                      </PureCell.Text>
                      <PureCell.Text titleColor="primary" view="primary-small" rowLimit={2}>
                        {tranche.status === 'REPAID' ? 'Уплачено' : 'К погашению сегодня'}: {formatMoney(tranche.totalToRepay, { exact: true })}
                        {' · '}{tranche.status === 'REPAID' ? 'Уплаченные проценты' : 'Начисленные проценты'}: {formatMoney(tranche.accruedInterest, { exact: true })}
                      </PureCell.Text>
                    </PureCell.Main>
                    <PureCell.Footer>
                      <RepayTranche tranche={tranche} />
                    </PureCell.Footer>
                  </PureCell.Content>
                </PureCell>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  )
}

function SelectedContract({ id }: { id: number }) {
  const contract = useContract(id)
  const scope = useApiScope()
  const navigate = useNavigate()
  return (
    <div className={styles.content}>
      <div className={styles.toolbar}>
        <Button view="text" size={40} onClick={() => { void navigate(ROUTES.credits) }}>Все договоры</Button>
        <TooltipDesktop content="Обновить договор" position="bottom">
          <IconButton type="button" view="secondary" size={40}
            icon={<ArrowsCwMIcon aria-hidden="true" />} aria-label="Обновить договор"
            aria-busy={contract.isFetching} loading={contract.isFetching} disabled={contract.isFetching}
            onClick={() => { void contract.refetch() }} />
        </TooltipDesktop>
      </div>
      {contract.error && <RequestState error={contract.error} retry={() => { void contract.refetch() }} />}
      {!contract.data && !contract.error && <RequestState>Загружаем договор...</RequestState>}
      {contract.data && <ContractDetails key={`${scope}-${id}`} contract={contract.data} />}
    </div>
  )
}

/** All signed contracts, including expired ones, and their separately fetched details. */
export function ContractOverview() {
  const headingId = useId()
  const { contractId } = useParams<{ contractId: string }>()
  const navigate = useNavigate()
  const contracts = useContracts(contractId === undefined)
  if (contractId !== undefined) {
    const id = Number(contractId)
    if (!/^\d+$/.test(contractId) || !Number.isSafeInteger(id) || id <= 0)
      return <RequestState error={new Error('Некорректный номер договора.')} />
    return <SelectedContract id={id} />
  }
  if (!contracts.data)
    return <RequestState error={contracts.error} retry={() => { void contracts.refetch() }}>Загружаем договоры...</RequestState>
  return (
    <div className={styles.content}>
      {contracts.error && <RequestState error={contracts.error} retry={() => { void contracts.refetch() }} />}
      {contracts.data.length === 0 ? (
        <section className={styles.card}>
          <Typography.TitleResponsive tag="h2" view="small" font="system">Подписанных договоров пока нет</Typography.TitleResponsive>
          <Typography.Text tag="p" color="secondary">После принятия предложения и подписания документов здесь появятся лимит договора и получение траншей.</Typography.Text>
          <div><Button view="primary" onClick={() => { void navigate(ROUTES.applications) }}>К заявкам</Button></div>
        </section>
      ) : (
        <ul className={styles.contracts}>
          {contracts.data.map((contract) => (
            <li key={contract.id} className={styles.card} aria-labelledby={`${headingId}-${contract.id}`}>
              <PureCell tag="div" direction="horizontal" verticalPadding="none">
                <PureCell.Content>
                  <PureCell.Main>
                    <PureCell.Text titleColor="primary" view="component-primary" value={
                      <Status color={contract.status === 'ACTIVE' ? 'green' : 'orange'} view="muted"
                        size={24} shape="rounded" uppercase={false}
                        leftAddons={contract.status === 'ACTIVE'
                          ? <CheckmarkCircleSIcon aria-hidden="true" /> : <ClockSIcon aria-hidden="true" />}>
                        {contract.status === 'ACTIVE' ? 'Действует' : 'Срок истёк'}
                      </Status>
                    }>
                      <Typography.TitleResponsive id={`${headingId}-${contract.id}`} tag="h2" view="small" font="system">
                        Договор № {contract.id}
                      </Typography.TitleResponsive>
                    </PureCell.Text>
                    <PureCell.Text titleColor="secondary" view="primary-small" rowLimit={2}>
                      {contract.contractTermMonths} мес. · С {formatDate(contract.startDate)} до {formatDate(contract.endDate)}
                    </PureCell.Text>
                  </PureCell.Main>
                  <div className={styles.summaryBody}>
                      <div className={styles.summaryBalance}>
                        <div className={styles.availableBalance}>
                          <Typography.Text view="primary-small" color="secondary">Доступный лимит</Typography.Text>
                          <PureCell.Amount value={Math.round(contract.availableLimit * 100)} minorUnits={100}
                            currency="RUR" view="default" textView="component-primary" weight="bold" color="primary" />
                        </div>
                        <dl className={styles.summaryMetrics}>
                          <div>
                            <dt><Typography.Text view="primary-small" color="secondary">Лимит договора</Typography.Text></dt>
                            <dd><Typography.Text weight="medium">{formatMoney(contract.limit, { exact: true })}</Typography.Text></dd>
                          </div>
                          <div>
                            <dt><Typography.Text view="primary-small" color="secondary">Основной долг</Typography.Text></dt>
                            <dd><Typography.Text weight="medium">{formatMoney(contract.outstandingPrincipal, { exact: true })}</Typography.Text></dd>
                          </div>
                        </dl>
                      </div>
                      <dl className={styles.summaryTerms}>
                        <div>
                          <dt><Typography.Text view="primary-small" color="secondary">Срок каждого транша</Typography.Text></dt>
                          <dd><Typography.Text weight="medium">{contract.trancheTerms.termDays} дней</Typography.Text></dd>
                        </div>
                        <div>
                          <dt><Typography.Text view="primary-small" color="secondary">Ставка по договору</Typography.Text></dt>
                          <dd><Typography.Text weight="medium">{contract.trancheTerms.ratePercent === null
                            ? 'Ставка недоступна' : `${String(contract.trancheTerms.ratePercent).replace('.', ',')}% годовых`}</Typography.Text></dd>
                        </div>
                      </dl>
                  </div>
                  <PureCell.Footer>
                    <PureCell.FooterButton view="primary" size={48} rightAddons={<ArrowRightMIcon aria-hidden="true" />}
                      aria-label={`Договор и транши: договор № ${contract.id}`}
                      onClick={() => { void navigate(ROUTES.contract(String(contract.id))) }}>
                      Договор и транши
                    </PureCell.FooterButton>
                  </PureCell.Footer>
                </PureCell.Content>
              </PureCell>
              {contract.issueBlockedReason && <Typography.Text tag="p" color="secondary" view="primary-small">{contractIssueBlockedLabels[contract.issueBlockedReason]}</Typography.Text>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
