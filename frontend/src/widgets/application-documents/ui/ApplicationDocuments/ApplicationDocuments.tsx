import { useId } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@alfalab/core-components/button'
import { Typography } from '@alfalab/core-components/typography'
import { ArrowRightMIcon } from '@alfalab/icons/glyph/dist/ArrowRightMIcon'
import { DocumentMIcon } from '@alfalab/icons/glyph/dist/DocumentMIcon'
import { ROUTES } from '@/shared/config'
import styles from './ApplicationDocuments.module.scss'

/** Controls whether the documents card links to its full page. */
export interface ApplicationDocumentsProps {
  compact?: boolean
}

/** Preserves the documents card without inventing data before its API exists. */
export function ApplicationDocuments({
  compact = false,
}: ApplicationDocumentsProps) {
  const headingId = useId()
  const navigate = useNavigate()

  return (
    <section className={styles.card} aria-labelledby={headingId}>
      <div className={styles.heading}>
        <Typography.TitleResponsive
          id={headingId}
          tag="h2"
          view="xsmall"
          font="system"
          weight="bold"
        >
          Документы по заявке
        </Typography.TitleResponsive>
      </div>
      <div className={styles.document}>
        <span className={styles.documentIcon}>
          <DocumentMIcon aria-hidden="true" />
        </span>
        <div className={styles.documentText}>
          <Typography.Text view="primary-small" weight="medium">
            Документы пока недоступны
          </Typography.Text>
        </div>
      </div>
      {compact && (
        <div>
          <Button
            view="text"
            size={40}
            rightAddons={<ArrowRightMIcon aria-hidden="true" />}
            onClick={() => {
              void navigate(ROUTES.documents)
            }}
          >
            Раздел документов
          </Button>
        </div>
      )}
    </section>
  )
}
