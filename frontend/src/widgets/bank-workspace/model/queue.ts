import type { BankApplicationView } from '@/entities/loan-application'

export type QueueStatus = BankApplicationView['status'] | 'ALL'
export type QueueSort =
  | 'review'
  | 'newest'
  | 'oldest'
  | 'amount-desc'
  | 'amount-asc'
  | 'company'

/** Filters and orders the visible queue without changing the server cache. */
export function getVisibleApplications(
  applications: readonly BankApplicationView[],
  search: string,
  status: QueueStatus,
  sort: QueueSort,
) {
  const query = search.trim().toLocaleLowerCase('ru-RU')
  const applicationNumber = query.match(/^[№#]\s*(\d+)$/)?.[1]
  const terms = query.split(/\s+/).filter(Boolean)

  return applications
    .filter((application) => {
      if (status !== 'ALL' && application.status !== status) return false
      if (applicationNumber) return String(application.id) === applicationNumber
      const text =
        `${application.companyName} ${application.inn} ${application.id}`.toLocaleLowerCase(
          'ru-RU',
        )
      return terms.every((term) => text.includes(term))
    })
    .sort((first, second) => {
      const byDate =
        Date.parse(first.createdAt) - Date.parse(second.createdAt)
      const newestFirst = -byDate || second.id - first.id

      switch (sort) {
        case 'review': {
          const firstInReview = first.status === 'IN_REVIEW'
          const secondInReview = second.status === 'IN_REVIEW'
          return (
            Number(secondInReview) - Number(firstInReview) ||
            (firstInReview ? byDate || first.id - second.id : newestFirst)
          )
        }
        case 'oldest':
          return byDate || first.id - second.id
        case 'amount-desc':
          return second.amount - first.amount || newestFirst
        case 'amount-asc':
          return first.amount - second.amount || newestFirst
        case 'company':
          return (
            first.companyName.localeCompare(second.companyName, 'ru-RU', {
              sensitivity: 'base',
              numeric: true,
            }) || newestFirst
          )
        case 'newest':
          return newestFirst
      }
    })
}
