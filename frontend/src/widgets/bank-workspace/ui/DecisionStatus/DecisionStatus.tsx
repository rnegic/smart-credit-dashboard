import { Status } from '@alfalab/core-components/status'
import { CheckmarkCircleSIcon } from '@alfalab/icons/glyph/dist/CheckmarkCircleSIcon'
import { ClockSIcon } from '@alfalab/icons/glyph/dist/ClockSIcon'
import { CrossCircleSIcon } from '@alfalab/icons/glyph/dist/CrossCircleSIcon'
import { DocumentLinesLineSIcon } from '@alfalab/icons/glyph/dist/DocumentLinesLineSIcon'
import { InformationCircleMIcon } from '@alfalab/icons/glyph/dist/InformationCircleMIcon'
import {
  applicationDecisionLabels,
  type BankApplicationView,
} from '@/entities/loan-application'
import styles from '../status.module.scss'

/** A saved decision or scoring recommendation, not an application stage. */
export interface DecisionStatusProps {
  decision: NonNullable<BankApplicationView['decision']>
}

const presentation = {
  APPROVED: { color: 'green', Icon: CheckmarkCircleSIcon },
  DECLINED: { color: 'red', Icon: CrossCircleSIcon },
  ALTERNATIVE_OFFER: { color: 'blue', Icon: DocumentLinesLineSIcon },
  INFO_REQUIRED: { color: 'orange', Icon: InformationCircleMIcon },
  MANUAL_REVIEW: { color: 'orange', Icon: ClockSIcon },
} as const

/** Uses the same compact alignment for recommendations and saved decisions. */
export function DecisionStatus({ decision }: DecisionStatusProps) {
  const { color, Icon } = presentation[decision]

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
      {applicationDecisionLabels[decision]}
    </Status>
  )
}
