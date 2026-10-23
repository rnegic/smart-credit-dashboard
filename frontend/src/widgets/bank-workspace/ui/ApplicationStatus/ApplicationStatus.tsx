import { Status } from '@alfalab/core-components/status'
import { CheckmarkCircleSIcon } from '@alfalab/icons/glyph/dist/CheckmarkCircleSIcon'
import { ClockSIcon } from '@alfalab/icons/glyph/dist/ClockSIcon'
import { CrossCircleSIcon } from '@alfalab/icons/glyph/dist/CrossCircleSIcon'
import { DocumentLinesLineSIcon } from '@alfalab/icons/glyph/dist/DocumentLinesLineSIcon'
import {
  applicationStatusLabels,
  type BankApplicationView,
} from '@/entities/loan-application'
import styles from '../status.module.scss'

/** The application stage, independent of the scoring recommendation. */
export interface ApplicationStatusProps {
  status: BankApplicationView['status']
}

const presentation = {
  IN_REVIEW: { color: 'orange', Icon: ClockSIcon },
  OFFER_READY: { color: 'blue', Icon: DocumentLinesLineSIcon },
  ACCEPTED: { color: 'green', Icon: CheckmarkCircleSIcon },
  DECLINED: { color: 'red', Icon: CrossCircleSIcon },
} as const

/** Renders a stage with both a label and a visual indicator. */
export function ApplicationStatus({ status }: ApplicationStatusProps) {
  const { color, Icon } = presentation[status]

  return (
    <Status
      className={styles.badge}
      color={color}
      view="muted"
      size={24}
      shape="rounded"
      uppercase={false}
      leftAddons={<Icon className={styles.icon} aria-hidden="true" />}
    >
      {applicationStatusLabels[status]}
    </Status>
  )
}
