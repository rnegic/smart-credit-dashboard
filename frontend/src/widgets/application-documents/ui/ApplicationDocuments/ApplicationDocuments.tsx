import { useId, useRef, useState, type MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@alfalab/core-components/button'
import { Typography } from '@alfalab/core-components/typography'
import { PureCell } from '@alfalab/core-components/pure-cell'
import { ArrowRightMIcon } from '@alfalab/icons/glyph/dist/ArrowRightMIcon'
import { DocumentMIcon } from '@alfalab/icons/glyph/dist/DocumentMIcon'
import { CheckmarkMIcon } from '@alfalab/icons/glyph/dist/CheckmarkMIcon'
import { useApplications, type ApplicationView } from '@/entities/loan-application'
import { useApplicationDocuments, type ApplicationDocument } from '@/entities/application-document'
import { SignDocuments } from '@/features/sign-documents'
import { useApiScope } from '@/shared/api'
import { ROUTES } from '@/shared/config'
import { formatDate, formatMoney } from '@/shared/lib'
import { RequestState, Skeleton } from '@/shared/ui'
import styles from './ApplicationDocuments.module.scss'

/** Controls whether the documents card links to its full page. */
export interface ApplicationDocumentsProps {
  compact?: boolean
}

function DocumentPackage({ application }: { application: ApplicationView }) {
  const documents = useApplicationDocuments(application.id)
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<ApplicationDocument['type']>()
  const trigger = useRef<HTMLElement | null>(null)
  const data = documents.data
  const signed = Boolean(data?.signedAt && data.signedBy)
  const offer = application.offer?.id === data?.offerId ? application.offer : null

  return (
    <>
      <section className={styles.package} aria-label={`Документы по заявке № ${application.id}`}>
        <div className={styles.packageHeader}>
          <div className={styles.packageInfo}>
            <Typography.Text view="primary-small" color="secondary">
              Заявка № {application.id}
            </Typography.Text>
            <Typography.TitleResponsive tag="h3" view="xsmall" font="system" weight="bold" className={styles.packageTitle}>
              {application.companyName}
            </Typography.TitleResponsive>
            {offer && (
              <Typography.Text view="primary-small" color="secondary">
                Лимит {formatMoney(offer.amount, { exact: true })} · Срок договора {offer.contractTermMonths == null ? 'не указан' : `${offer.contractTermMonths} мес.`}
              </Typography.Text>
            )}
          </div>
          {data && data.documents.length > 0 && (
            <Typography.Text view="primary-small" color={signed ? 'positive' : 'secondary'} className={styles.status}>
              {signed && <CheckmarkMIcon aria-hidden="true" />}
              {signed ? 'Подписано' : 'Ожидает подписи'}
            </Typography.Text>
          )}
        </div>
        {documents.isPending && (
          <div className={styles.loading} role="status" aria-label="Загружаем документы">
            {[0, 1].map((item) => <Skeleton key={item} height="5rem" radius="var(--border-radius-12)" />)}
          </div>
        )}
        {documents.error && <RequestState error={documents.error} retry={() => { void documents.refetch() }} />}
        {data?.documents.length === 0 && (
          <Typography.Text tag="p" view="primary-small" color="secondary" className={styles.note}>
            {application.status === 'ACCEPTED'
              ? 'В архивной заявке нет сохранённых документов и данных подписи.'
              : 'Документы будут доступны после принятия предложения банка.'}
          </Typography.Text>
        )}
        {data && data.documents.length > 0 && (
          <>
            <ul className={styles.documents}>
              {data.documents.map((document) => (
                <li key={document.type} className={styles.document}>
                  <PureCell tag="div" direction="horizontal" verticalPadding="default">
                    <PureCell.Graphics>
                      <DocumentMIcon className={styles.documentIcon} aria-hidden="true" />
                    </PureCell.Graphics>
                    <PureCell.Content>
                      <PureCell.Main>
                        <PureCell.Text titleColor="primary" view="component-primary" rowLimit={2}>
                          {document.title}
                        </PureCell.Text>
                        <PureCell.Text titleColor={signed ? 'positive' : 'secondary'} view="primary-small">
                          {signed && data.signedAt
                            ? `Подписан ${formatDate(data.signedAt)}`
                            : `Не подписан · Версия ${data.documentVersion}`}
                        </PureCell.Text>
                      </PureCell.Main>
                      <PureCell.Footer footerPadding="default">
                        <PureCell.FooterButton
                          view="secondary"
                          size={40}
                          aria-label={`Просмотреть: ${document.title}`}
                          onClick={(event: MouseEvent<HTMLButtonElement>) => {
                            trigger.current = event.currentTarget
                            setSelected(document.type)
                            setOpen(true)
                          }}
                        >
                          Просмотреть
                        </PureCell.FooterButton>
                      </PureCell.Footer>
                    </PureCell.Content>
                  </PureCell>
                </li>
              ))}
            </ul>
            <div className={styles.packageFooter}>
              <Typography.Text tag="p" view="primary-small" color="secondary" className={styles.footerNote}>
                {signed && data.signedAt
                ? `Подписано ${formatDate(data.signedAt)}. Отметка ЭП доступна в каждом документе.`
                : application.status === 'OFFER_READY'
                  ? 'Ознакомьтесь с документами. Для подписи сначала примите предложение банка.'
                  : 'Подпись подтверждает оба документа.'}
              </Typography.Text>
              {data.signingAllowed && !documents.isError && (
                <Button view="primary" size={48} rightAddons={<ArrowRightMIcon aria-hidden="true" />}
                  onClick={(event: MouseEvent<HTMLButtonElement>) => {
                    trigger.current = event.currentTarget
                    setSelected(undefined)
                    setOpen(true)
                  }}>
                  Подписать 2 документа
                </Button>
              )}
            </div>
          </>
        )}
      </section>
      <SignDocuments key={selected ?? 'package'} application={application} offer={application.offer} open={open}
        initialDocument={selected} onClose={() => setOpen(false)} returnFocusRef={trigger} />
    </>
  )
}

/** Server-backed archive with the same signing flow as the application hero. */
export function ApplicationDocuments({
  compact = false,
}: ApplicationDocumentsProps) {
  const headingId = useId()
  const navigate = useNavigate()
  const scope = useApiScope()
  const applications = useApplications()
  const candidates = applications.data?.filter((application) =>
    ['OFFER_READY', 'SIGNATURE_PENDING', 'ACCEPTED'].includes(application.status),
  ) ?? []
  const featured = candidates.find((application) => application.status === 'SIGNATURE_PENDING') ?? candidates[0]
  const visible = compact ? (featured ? [featured] : []) : candidates

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
      {!compact && (
        <Typography.Text tag="p" view="primary-medium" color="secondary" className={styles.note}>
          Договоры, индивидуальные условия и подписи по вашим заявкам.
        </Typography.Text>
      )}
      {applications.isPending && <Skeleton height="12rem" radius="var(--border-radius-16)" />}
      {applications.error && <RequestState error={applications.error} retry={() => { void applications.refetch() }} />}
      {!applications.isPending && !applications.isError && visible.length === 0 && (
        <div className={styles.empty}>
          <DocumentMIcon aria-hidden="true" />
          <Typography.Text view="primary-medium" weight="medium">Здесь будут ваши документы</Typography.Text>
          <Typography.Text tag="p" view="primary-small" color="secondary" className={styles.note}>
            После решения банка мы подготовим договор и индивидуальные условия по заявке.
          </Typography.Text>
        </div>
      )}
      {visible.map((application) => <DocumentPackage key={`${scope}-${application.id}`} application={application} />)}
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
