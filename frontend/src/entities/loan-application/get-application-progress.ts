import type { Application } from './index'

const stages = [
  { code: 'SUBMITTED', title: 'Заявка' },
  { code: 'REVIEW', title: 'Проверка' },
  { code: 'DECISION', title: 'Решение' },
  { code: 'OFFER', title: 'Предложение' },
  { code: 'SIGNING', title: 'Подписание' },
  { code: 'ISSUED', title: 'Выдача' },
] as const

/** A product stage derived from the application's actual status. */
export interface ApplicationProgressStage {
  code: (typeof stages)[number]['code']
  title: (typeof stages)[number]['title']
  state: 'DONE' | 'CURRENT' | 'PENDING'
}

/** Maps current statuses to six UI stages without inferring loan issuance. */
export function getApplicationProgress(
  status: Application['status'],
): ApplicationProgressStage[] {
  const currentCode = {
    IN_REVIEW: 'REVIEW',
    OFFER_READY: 'OFFER',
    ACCEPTED: 'ISSUED',
    DECLINED: 'DECISION',
  } as const
  const currentIndex = stages.findIndex(
    (stage) => stage.code === currentCode[status],
  )
  // ACCEPTED confirms signing only; issuance remains current until a linked loan is available.
  return stages.map((stage, index) => ({
    ...stage,
    state:
      index < currentIndex
        ? 'DONE'
        : index === currentIndex
          ? 'CURRENT'
          : 'PENDING',
  }))
}
