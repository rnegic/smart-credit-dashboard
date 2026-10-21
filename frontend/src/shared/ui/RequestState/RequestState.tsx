import { Button } from '@alfalab/core-components/button'
import type { ReactNode } from 'react'
import styles from './RequestState.module.scss'

export interface RequestStateProps {
  error?: Error | null
  retry?: () => void
  children?: ReactNode
}
export function RequestState({ error, retry, children }: RequestStateProps) {
  return (
    <div className={styles.state} role={error ? 'alert' : 'status'}>
      <p>{error ? error.message : (children ?? 'Загружаем данные…')}</p>
      {error && retry && (
        <Button view="secondary" onClick={retry}>
          Повторить
        </Button>
      )}
    </div>
  )
}
