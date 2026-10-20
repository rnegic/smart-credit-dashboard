import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@alfalab/core-components/button'
import { Typography } from '@alfalab/core-components/typography'
import { ArrowRightMIcon } from '@alfalab/icons/glyph/dist/ArrowRightMIcon'
import { CheckmarkMIcon } from '@alfalab/icons/glyph/dist/CheckmarkMIcon'
import { DocumentMIcon } from '@alfalab/icons/glyph/dist/DocumentMIcon'
import { demoApplication, demoDocuments } from '@/entities/loan-application'
import { ROUTES } from '@/shared/config'
import { Panel } from '@/shared/ui'
import styles from './ApplicationDocuments.module.scss'

export interface ApplicationDocumentsProps {
  compact?: boolean
}

export function ApplicationDocuments({
  compact = false,
}: ApplicationDocumentsProps) {
  const [selectedDocument, setSelectedDocument] = useState<
    (typeof demoDocuments)[number] | null
  >(null)
  const navigate = useNavigate()

  return (
    <>
      <section className={styles.card} aria-labelledby="documents-heading">
        <div className={styles.heading}>
          <Typography.TitleResponsive
            id="documents-heading"
            tag="h2"
            view="xsmall"
            font="system"
            weight="bold"
          >
            Документы по заявке
          </Typography.TitleResponsive>
          <Typography.Text view="primary-small" color="secondary">
            {demoDocuments.length}
          </Typography.Text>
        </div>
        <ul className={styles.list}>
          {demoDocuments.map((document) => (
            <li key={document.id} className={styles.document}>
              <span className={styles.documentIcon}>
                <DocumentMIcon aria-hidden="true" />
              </span>
              <div className={styles.documentText}>
                <Typography.Text view="primary-small" weight="medium">
                  {document.title}
                </Typography.Text>
                {!compact && (
                  <Typography.Text view="primary-small" color="secondary">
                    {document.description}
                  </Typography.Text>
                )}
                <span className={styles.received}>
                  <CheckmarkMIcon aria-hidden="true" />
                  <Typography.Text view="secondary-medium">
                    Получен
                  </Typography.Text>
                </span>
              </div>
              {!compact && (
                <Button
                  view="secondary"
                  size={40}
                  onClick={() => setSelectedDocument(document)}
                  aria-label={`Сведения: ${document.title}`}
                >
                  Сведения
                </Button>
              )}
            </li>
          ))}
        </ul>
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
              Все документы
            </Button>
          </div>
        )}
      </section>
      <Panel
        open={selectedDocument !== null}
        title="Сведения о документе"
        onClose={() => setSelectedDocument(null)}
      >
        {selectedDocument && (
          <div className={styles.documentDetails}>
            <Typography.TitleResponsive tag="h2" view="small" font="system">
              {selectedDocument.title}
            </Typography.TitleResponsive>
            <Typography.Text tag="p" color="secondary">
              {selectedDocument.description}
            </Typography.Text>
            <Typography.Text tag="p">
              Прикреплен к заявке {demoApplication.number}. Документ получен,
              повторная отправка не требуется.
            </Typography.Text>
            <Typography.Text tag="p" view="primary-small" color="secondary">
              Демонстрационная запись
            </Typography.Text>
          </div>
        )}
      </Panel>
    </>
  )
}
