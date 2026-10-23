import { useId, useMemo, useState } from 'react'
import { Button } from '@alfalab/core-components/button'
import { IconButton } from '@alfalab/core-components/icon-button'
import { Input } from '@alfalab/core-components/input'
import { Select } from '@alfalab/core-components/select'
import { ArrowRightMIcon } from '@alfalab/icons/glyph/dist/ArrowRightMIcon'
import { ArrowsUpDownMIcon } from '@alfalab/icons/glyph/dist/ArrowsUpDownMIcon'
import { CheckmarkCircleSIcon } from '@alfalab/icons/glyph/dist/CheckmarkCircleSIcon'
import { ClockSIcon } from '@alfalab/icons/glyph/dist/ClockSIcon'
import { CrossCircleSIcon } from '@alfalab/icons/glyph/dist/CrossCircleSIcon'
import { DocumentLinesLineSIcon } from '@alfalab/icons/glyph/dist/DocumentLinesLineSIcon'
import { MagnifierMIcon } from '@alfalab/icons/glyph/dist/MagnifierMIcon'
import {
  applicationDecisionLabels,
  type BankApplicationView,
} from '@/entities/loan-application'
import { formatMoney } from '@/shared/lib'
import {
  getVisibleApplications,
  type QueueSort,
  type QueueStatus,
} from '../../model/queue'
import { ApplicationStatus } from '../ApplicationStatus'
import { DecisionStatus } from '../DecisionStatus'
import styles from './ApplicationQueue.module.scss'

/** Presentation-only controls for the already loaded bank queue. */
export interface ApplicationQueueProps {
  applications: BankApplicationView[]
  disabled: boolean
  onSelect: (application: BankApplicationView, trigger: HTMLButtonElement) => void
}

const filters = [
  { key: 'ALL', label: 'Все заявки', Icon: null },
  { key: 'IN_REVIEW', label: 'На рассмотрении', Icon: ClockSIcon },
  { key: 'OFFER_READY', label: 'Предложение банка', Icon: DocumentLinesLineSIcon },
  { key: 'ACCEPTED', label: 'Принято', Icon: CheckmarkCircleSIcon },
  { key: 'DECLINED', label: 'Отказ', Icon: CrossCircleSIcon },
] as const

const sortOptions: { key: QueueSort; content: string }[] = [
  { key: 'review', content: 'Сначала на рассмотрении' },
  { key: 'newest', content: 'Сначала новые' },
  { key: 'oldest', content: 'Сначала старые' },
  { key: 'amount-desc', content: 'Сумма: по убыванию' },
  { key: 'amount-asc', content: 'Сумма: по возрастанию' },
  { key: 'company', content: 'Компания: А–Я' },
]

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})
const timeFormatter = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit',
  minute: '2-digit',
})

/** Keeps filtering and sorting local while retaining the original records. */
export function ApplicationQueue({
  applications,
  disabled,
  onSelect,
}: ApplicationQueueProps) {
  const id = useId()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<QueueStatus>('ALL')
  const [sort, setSort] = useState<QueueSort>('review')
  const visibleApplications = useMemo(
    () => getVisibleApplications(applications, search, status, sort),
    [applications, search, status, sort],
  )
  const counts: Record<QueueStatus, number> = {
    ALL: applications.length,
    IN_REVIEW: 0,
    OFFER_READY: 0,
    ACCEPTED: 0,
    DECLINED: 0,
  }
  for (const application of applications) counts[application.status] += 1
  const hasFilters = search !== '' || status !== 'ALL'

  function resetFilters() {
    setSearch('')
    setStatus('ALL')
  }

  return (
    <div className={styles.queue}>
      <div className={styles.filters} role="group" aria-label="Статус заявки">
        {filters.map(({ key, label, Icon }) => (
          <Button
            key={key}
            type="button"
            view="transparent"
            size={40}
            className={styles.filter}
            aria-pressed={status === key}
            aria-controls={`${id}-results`}
            leftAddons={Icon && <Icon aria-hidden="true" />}
            rightAddons={<span className={styles.count}>{counts[key]}</span>}
            onClick={() => setStatus(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className={styles.toolbar}>
        <Input
          className={styles.search}
          aria-label="Поиск по компании, ИНН или номеру заявки"
          placeholder="Компания, ИНН или № заявки"
          leftAddons={<MagnifierMIcon aria-hidden="true" />}
          size={48}
          value={search}
          onChange={(_, { value }) => setSearch(value)}
          clear={search !== ''}
          onClear={() => setSearch('')}
          block
        />
        <div className={styles.sort}>
          <ArrowsUpDownMIcon className={styles.sortIcon} aria-hidden="true" />
          <Select
            label="Сортировка"
            labelView="inner"
            size={48}
            options={sortOptions}
            selected={sort}
            onChange={({ selected }) => {
              const option = sortOptions.find((item) => item.key === selected?.key)
              if (option) setSort(option.key)
            }}
            block
          />
        </div>
      </div>

      <div className={styles.resultBar}>
        <p className={styles.resultCount} role="status">
          Показано {visibleApplications.length} из {applications.length}
        </p>
        {hasFilters && (
          <Button type="button" view="text" size={32} onClick={resetFilters}>
            Сбросить фильтры
          </Button>
        )}
      </div>

      <div id={`${id}-results`}>
        {visibleApplications.length > 0 ? (
          <table className={styles.table} aria-label="Кредитные заявки" role="table">
            <thead role="rowgroup">
              <tr role="row">
                <th scope="col" className={styles.companyColumn}>Заявка / компания</th>
                <th scope="col" className={styles.amountColumn}>Сумма / срок</th>
                <th scope="col" className={styles.statusColumn}>Статус заявки</th>
                <th scope="col" className={styles.scoringColumn}>Рекомендация скоринга</th>
                <th scope="col" className={styles.dateColumn}>Создана</th>
                <th scope="col" className={styles.actionColumn}>
                  <span className={styles.visuallyHidden}>Открыть заявку</span>
                </th>
              </tr>
            </thead>
            <tbody role="rowgroup">
              {visibleApplications.map((application) => (
                <tr key={application.id} className={styles.row} role="row">
                  <td className={styles.company} role="cell">
                    <span className={styles.applicationNumber}>№ {application.id}</span>
                    <button
                      type="button"
                      className={styles.companyButton}
                      disabled={disabled}
                      aria-label={`Открыть заявку № ${application.id}: ${application.companyName}`}
                      onClick={(event) => onSelect(application, event.currentTarget)}
                    >
                      {application.companyName}
                    </button>
                    <span className={styles.secondary}>ИНН {application.inn}</span>
                  </td>
                  <td className={styles.amount} role="cell">
                    <span className={styles.cellLabel}>Сумма / срок</span>
                    <strong className={styles.money}>{formatMoney(application.amount)}</strong>
                    <span className={styles.secondary}>{application.termDays} дней</span>
                    <span className={styles.purpose} title={application.purpose ?? undefined}>
                      {application.purpose ?? 'Цель не указана'}
                    </span>
                  </td>
                  <td className={styles.stage} role="cell">
                    <span className={styles.cellLabel}>Статус заявки</span>
                    <ApplicationStatus status={application.status} />
                    <span className={styles.secondary}>
                      {application.decision
                        ? applicationDecisionLabels[application.decision]
                        : 'Решение не принято'}
                    </span>
                  </td>
                  <td className={styles.scoring} role="cell">
                    <span className={styles.cellLabel}>Рекомендация скоринга</span>
                    <span>
                      {application.recommendation ? (
                        <DecisionStatus decision={application.recommendation.decision} />
                      ) : 'Нет рекомендации'}
                    </span>
                    {(application.internalScore !== null || application.riskClass !== null) && (
                      <span className={styles.secondary}>
                        {application.internalScore !== null && `${application.internalScore} / 100`}
                        {application.internalScore !== null && application.riskClass !== null && ' · '}
                        {application.riskClass !== null && `Класс ${application.riskClass}`}
                      </span>
                    )}
                  </td>
                  <td className={styles.created} role="cell">
                    <span className={styles.cellLabel}>Создана</span>
                    <time dateTime={application.createdAt}>
                      <span>{dateFormatter.format(new Date(application.createdAt))}</span>
                      <span className={styles.secondary}>
                        {timeFormatter.format(new Date(application.createdAt))}
                      </span>
                    </time>
                  </td>
                  <td className={styles.action} role="cell">
                    <IconButton
                      type="button"
                      view="secondary"
                      size={40}
                      icon={<ArrowRightMIcon aria-hidden="true" />}
                      aria-label={`Подробнее о заявке № ${application.id}`}
                      title="Открыть заявку"
                      disabled={disabled}
                      onClick={(event) => onSelect(application, event.currentTarget)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className={styles.empty}>
            {applications.length === 0
              ? <DocumentLinesLineSIcon aria-hidden="true" />
              : <MagnifierMIcon aria-hidden="true" />}
            <h2>{applications.length === 0 ? 'Заявок пока нет' : 'Заявки не найдены'}</h2>
            <p>
              {applications.length === 0
                ? 'Новые заявки появятся здесь автоматически.'
                : 'Попробуйте другой запрос или выберите другой статус.'}
            </p>
            {hasFilters && (
              <Button type="button" view="secondary" size={40} onClick={resetFilters}>
                Показать все заявки
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
