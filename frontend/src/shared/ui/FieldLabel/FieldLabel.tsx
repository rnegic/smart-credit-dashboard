import { useId, useState } from 'react'
import { TooltipDesktop } from '@alfalab/core-components/tooltip/desktop'
import { InformationCircleLineSIcon } from '@alfalab/icons/glyph/dist/InformationCircleLineSIcon'
import styles from './FieldLabel.module.scss'

export interface FieldLabelProps {
  htmlFor: string
  text: string
  hint?: string
}

export function FieldLabel({ htmlFor, text, hint }: FieldLabelProps) {
  const [open, setOpen] = useState(false)
  const tooltipId = useId()
  return (
    <div className={styles.label}>
      <label htmlFor={htmlFor}>{text}</label>
      {hint && (
        <TooltipDesktop
          open={open}
          trigger="hover"
          position="top"
          fallbackPlacements={['bottom', 'right', 'left']}
          onOpen={() => setOpen(true)}
          onClose={() => setOpen(false)}
          content={
            <span id={tooltipId} role="tooltip">
              {hint}
            </span>
          }
          contentClassName={styles.hint}
          targetTag="span"
        >
          <button
            type="button"
            className={styles.button}
            aria-label={`${text}: подсказка`}
            aria-describedby={open ? tooltipId : undefined}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onClick={() => setOpen(true)}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && open) {
                event.preventDefault()
                event.stopPropagation()
                setOpen(false)
              }
            }}
          >
            <InformationCircleLineSIcon aria-hidden="true" />
          </button>
        </TooltipDesktop>
      )}
    </div>
  )
}
