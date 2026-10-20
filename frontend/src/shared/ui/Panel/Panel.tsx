import { useId, type ReactNode } from 'react'
import { SidePanel } from '@alfalab/core-components/side-panel'
import { CrossMIcon } from '@alfalab/icons/glyph/dist/CrossMIcon'
import styles from './Panel.module.scss'

export interface PanelProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

export function Panel({ open, title, onClose, children, footer }: PanelProps) {
  const titleId = useId()

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      className={styles.panel}
      scrollLock
      wrapperProps={{ 'aria-labelledby': titleId }}
    >
      <SidePanel.Header
        hasCloser
        closerProps={{
          icon: () => <CrossMIcon aria-hidden="true" />,
          'aria-label': 'Закрыть панель',
        }}
        title={<span id={titleId}>{title}</span>}
      />
      <SidePanel.Content>{children}</SidePanel.Content>
      {footer && <SidePanel.Footer sticky>{footer}</SidePanel.Footer>}
    </SidePanel>
  )
}
