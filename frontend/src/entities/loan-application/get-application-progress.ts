import type { Application } from './index'

const stages = [
  { code: 'SUBMITTED', title: 'Заявка' },
  { code: 'REVIEW', title: 'Проверка' },
  { code: 'DECISION', title: 'Статус' },
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
    OFFER_READY: 'DECISION',
    ACCEPTED: 'ISSUED',
    DECLINED: 'DECISION',
  } as const
  const currentIndex = stages.findIndex(
    (stage) => stage.code === currentCode[status],
  )
  // OFFER_READY awaits client choice; ACCEPTED confirms signing, not issuance.
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
