import { useId, type ReactNode, type RefObject } from 'react'
import { SidePanel } from '@alfalab/core-components/side-panel'
import { CrossMIcon } from '@alfalab/icons/glyph/dist/CrossMIcon'
import styles from './Panel.module.scss'

export interface PanelProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  dismissible?: boolean
  returnFocusRef?: RefObject<HTMLElement | null>
}

export function Panel({
  open,
  title,
  onClose,
  children,
  footer,
  dismissible = true,
  returnFocusRef,
}: PanelProps) {
  const titleId = useId()

  return (
    <SidePanel
      open={open}
      onClose={() => {
        if (dismissible) onClose()
      }}
      className={styles.panel}
      scrollLock
      disableEscapeKeyDown={!dismissible}
      disableBackdropClick={!dismissible}
      onUnmount={() => {
        if (returnFocusRef)
          requestAnimationFrame(() => {
            if (
              returnFocusRef.current?.isConnected &&
              !document.querySelector('[role="dialog"]')
            )
              returnFocusRef.current.focus()
          })
      }}
      wrapperProps={{ 'aria-labelledby': titleId }}
    >
      <SidePanel.Header
        hasCloser={dismissible}
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
