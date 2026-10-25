import { useEffect, useId, useRef, useState, type RefObject } from 'react'
import { Modal } from '@alfalab/core-components/modal'
import { Button } from '@alfalab/core-components/button'
import { Checkbox } from '@alfalab/core-components/checkbox'
import { CheckmarkMIcon } from '@alfalab/icons/glyph/dist/CheckmarkMIcon'
import { DocumentMIcon } from '@alfalab/icons/glyph/dist/DocumentMIcon'
import { CrossMIcon } from '@alfalab/icons/glyph/dist/CrossMIcon'
import {
  documentPackageVersion,
  type ApplicationDocument,
} from '@/entities/application-document'
import type { Application, Offer } from '@/entities/loan-application'
import { getSessionGeneration } from '@/shared/api'
import { formatDate, formatMoney } from '@/shared/lib'
import { AlfaMark, Skeleton } from '@/shared/ui'
import { useSignDocuments } from '../../model/use-sign-documents'
import styles from './SignDocuments.module.scss'

/** One dedicated signing experience shared by the hero and documents archive. */
export interface SignDocumentsProps {
  application: Application
  offer?: Offer | null
  open: boolean
  onClose: () => void
  initialDocument?: ApplicationDocument['type']
  returnFocusRef?: RefObject<HTMLElement | null>
}

/** Render immutable server texts and stamp them only after a persisted signature. */
export function SignDocuments({
  application, offer, open, onClose, initialDocument, returnFocusRef,
}: SignDocumentsProps) {
  const id = useId()
  const heading = useRef<HTMLHeadingElement>(null)
  const submitting = useRef(false)
  const [selectedType, setSelectedType] = useState(initialDocument)
  const [acknowledged, setAcknowledged] = useState<string | null>(null)
  const { documents, sign, refresh, uncertain } = useSignDocuments(application.id, open)
  const data = documents.data
  const version = data ? documentPackageVersion(data) : null
  const signed = Boolean(data?.signedAt && data.signedBy)
  const error = documents.error ?? (!signed ? sign.error : null)
  const confirmed = version !== null && acknowledged === version
  const active = data?.documents.find((doc) => doc.type === selectedType) ?? data?.documents[0]
  // The API title is already rendered above the text, including for legacy snapshots.
  const paragraphs = active?.content.split(/\n\s*\n/)
    .map((paragraph) => paragraph.split('\n')
      .filter((line) => !/^=+$/.test(line.trim())).join('\n').trim())
    .filter((paragraph, index) => !(index === 0 &&
      paragraph.replace(/\s*\(демонстрационный текст\)$/iu, '').toLocaleUpperCase('ru-RU') ===
      active?.title.toLocaleUpperCase('ru-RU'))) ?? []
  const activeIndex = active ? data?.documents.indexOf(active) ?? 0 : 0
  const matchingOffer = offer?.id === data?.offerId ? offer : null
  const canSign = data?.signingAllowed && !signed && !uncertain && !documents.isError && confirmed

  useEffect(() => {
    if (open) heading.current?.focus({ preventScroll: true })
  }, [open])

  function close() {
    if (submitting.current || sign.isPending) return
    onClose()
  }

  return (
    <Modal
      open={open}
      size={1140}
      fixedPosition
      scrollLock
      disableRestoreFocus
      className={styles.modal}
      disableEscapeKeyDown={sign.isPending}
      disableBackdropClick={sign.isPending}
      onClose={close}
      wrapperProps={{ 'aria-labelledby': `${id}-title` }}
      onUnmount={() => {
        setAcknowledged(null)
        setSelectedType(initialDocument)
        requestAnimationFrame(() => {
          if (returnFocusRef?.current?.isConnected && !document.querySelector('[role="dialog"]'))
            returnFocusRef.current.focus({ preventScroll: true })
        })
      }}
    >
      <Modal.Header
        sticky
        title="Документы по заявке"
        hasCloser={!sign.isPending}
        closerProps={{ icon: () => <CrossMIcon aria-hidden="true" />, 'aria-label': 'Закрыть документы' }}
      />
      <Modal.Content className={styles.content}>
        <header className={`${styles.intro} ${signed ? styles.introSigned : ''}`}>
          <div>
            <span className={styles.eyebrow}>Заявка № {application.id} · Этап 05</span>
            <h2 id={`${id}-title`} ref={heading} tabIndex={-1}>
              {signed ? 'Документы подписаны' : 'Осталось подписать документы'}
            </h2>
            <p>
              {signed
                ? 'Оформление завершено. Подписанные документы доступны в вашем кабинете.'
                : 'Проверьте документы по предложению банка и подтвердите подписание одним действием.'}
            </p>
          </div>
        </header>

        {matchingOffer && (
          <dl className={styles.terms}>
            <div><dt>Сумма предложения</dt><dd>{formatMoney(matchingOffer.amount, { exact: true })}</dd></div>
            <div><dt>Срок</dt><dd>{matchingOffer.termDays} дней</dd></div>
            <div><dt>Итоговая ставка</dt><dd>{String(matchingOffer.finalRate).replace('.', ',')}% годовых</dd></div>
          </dl>
        )}

        {error && (
          <div className={styles.error} role="alert">
            <p>{error.message}</p>
            <Button size={32} view="text" disabled={sign.isPending || documents.isFetching}
              onClick={() => { setAcknowledged(null); void refresh() }}>
              {uncertain ? 'Проверить результат' : 'Обновить документы'}
            </Button>
          </div>
        )}

        {documents.isPending && (
          <div className={styles.loading} role="status">
            <span>Готовим документы к просмотру…</span>
            <Skeleton height="2rem" width="60%" />
            <Skeleton height="1rem" />
            <Skeleton height="1rem" width="80%" />
            <Skeleton height="14rem" radius="var(--border-radius-16)" />
          </div>
        )}

        {data && data.documents.length === 0 && (
          <div className={styles.empty}>
            <DocumentMIcon aria-hidden="true" />
            <h3>Документы пока недоступны</h3>
            <p>{application.status === 'ACCEPTED'
              ? 'В этой заявке нет сохранённого пакета документов и данных подписи.'
              : 'Документы появятся после подготовки предложения банком. Если предложение готово, сначала примите его условия.'}</p>
          </div>
        )}

        {data && active && (
          <div className={styles.workspace}>
            <aside className={styles.sidebar}>
              <nav className={styles.documentNav} aria-label="Выбор документа">
                {data.documents.map((doc, index) => (
                  <button key={doc.type} type="button"
                    className={`${styles.documentTab} ${active.type === doc.type ? styles.selected : ''}`}
                    aria-pressed={active.type === doc.type}
                    aria-controls={`${id}-paper`}
                    onClick={() => setSelectedType(doc.type)}>
                    <span className={styles.documentNumber}>0{index + 1}</span>
                    <span className={styles.tabText}>
                      <strong>{doc.title}</strong>
                      <small>{signed ? 'Подписан' : 'Для ознакомления'}</small>
                    </span>
                    {signed && <CheckmarkMIcon className={styles.miniCheck} aria-hidden="true" />}
                  </button>
                ))}
              </nav>
              <div className={styles.sideNote}>
                <strong>{signed ? 'Оба документа сохранены' : 'Подпишите пакет документов'}</strong>
              </div>
            </aside>

            <div className={styles.paperStage}>
              <article id={`${id}-paper`} className={styles.paper} aria-labelledby={`${id}-document-title`}>
                <div className={styles.paperTopline}>
                  <span className={styles.bankLogo} role="img" aria-label="Альфа-Банк">
                    <AlfaMark />
                  </span>
                  <span>ДОКУМЕНТ 0{activeIndex + 1} / 0{data.documents.length}</span>
                </div>
                <h3 id={`${id}-document-title`}>{active.title}</h3>
                <div className={styles.paperMeta}>
                  <span>Заявка № {data.applicationId}</span>
                  <span>Предложение № {data.offerId}</span>
                </div>
                <div className={styles.documentText}>
                  {paragraphs.map((paragraph, index) => (
                    <p key={`${active.type}-${index}`}>
                      {paragraph}
                    </p>
                  ))}
                </div>
                {signed && data.signedAt && data.signedBy ? (
                  <div className={styles.signature} key={`${active.type}-${data.signedAt}`} aria-label="Подпись документа">
                    <div className={styles.signatureSeal}><CheckmarkMIcon aria-hidden="true" /></div>
                    <div className={styles.signatureDetails}>
                      <strong>ПОДПИСАНО</strong>
                      <span>{data.demo ? 'Электронная подпись (демо)' : 'Электронное подтверждение'}</span>
                      <b>{data.signedBy.fullName}</b>
                      <time dateTime={data.signedAt}>
                        {formatDate(data.signedAt)} · {new Intl.DateTimeFormat('ru-RU', {
                          hour: '2-digit', minute: '2-digit', second: '2-digit',
                        }).format(new Date(data.signedAt))}
                      </time>
                      <small>Предложение № {data.offerId} · Версия {data.documentVersion}</small>
                    </div>
                  </div>
                ) : (
                  <div className={styles.signaturePlaceholder}>
                    <DocumentMIcon aria-hidden="true" />
                    <div><strong>Место для подписи</strong><span>Отметка появится после сохранения подписи</span></div>
                  </div>
                )}
              </article>
            </div>
          </div>
        )}
      </Modal.Content>
      <Modal.Footer sticky className={styles.modalFooter}>
        <div className={styles.footer} aria-busy={sign.isPending}>
          <div className={styles.footerText}>
            {signed ? (
              <div className={styles.success} role="status">
                <CheckmarkMIcon aria-hidden="true" />
                <span><strong>2 из 2 документов подписаны</strong><small>Сохранены в разделе «Документы»</small></span>
              </div>
            ) : data?.signingAllowed && !uncertain ? (
              <Checkbox
                checked={confirmed}
                disabled={sign.isPending || documents.isError}
                label="Ознакомлен с двумя документами и подтверждаю их подписание"
                onChange={(_, { checked }) => setAcknowledged(checked ? version : null)}
              />
            ) : (
              <p>{uncertain
                ? 'Сначала проверьте, сохранилась ли подпись.'
                : application.status === 'OFFER_READY'
                  ? 'Чтобы подписать документы, сначала примите предложение банка.'
                  : 'Просмотр доступен. Подписание разрешает банк на соответствующем этапе.'}</p>
            )}
          </div>
          {signed || (!data?.signingAllowed && !uncertain) ? (
            <Button view={signed ? 'primary' : 'secondary'} size={48} onClick={close}>Готово</Button>
          ) : uncertain ? (
            <Button view="primary" size={48} loading={documents.isFetching}
              disabled={documents.isFetching} onClick={() => { setAcknowledged(null); void refresh() }}>
              Проверить результат
            </Button>
          ) : (
            <Button view="primary" size={48} loading={sign.isPending}
              disabled={!canSign || sign.isPending || documents.isFetching}
              onClick={() => {
                if (!canSign || !data || submitting.current) return
                submitting.current = true
                sign.mutate({ snapshot: data, generation: getSessionGeneration() }, {
                  onSettled: () => { submitting.current = false },
                  onError: () => setAcknowledged(null),
                })
              }}>
              {sign.isPending ? 'Сохраняем подпись…' : 'Подписать 2 документа'}
            </Button>
          )}
        </div>
      </Modal.Footer>
    </Modal>
  )
}
