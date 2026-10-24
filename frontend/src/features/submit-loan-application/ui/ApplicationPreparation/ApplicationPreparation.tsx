import { Typography } from '@alfalab/core-components/typography'
import styles from './ApplicationPreparation.module.scss'

/** Decorative preparation view; both states retain their layout space. */
export interface ApplicationPreparationProps {
  visible: boolean
  slow: boolean
  headingTag: 'h1' | 'h2'
}

/** Illustrate moving text into fields, without representing server progress. */
export function ApplicationPreparationVisual() {
  return (
    <div
      className={styles.illustration}
      data-active={true}
      aria-hidden="true"
    >
      <div className={styles.sourceSheet}>
        <div className={styles.sheetHeading}>
          <span className={styles.descriptionMark} />
          <span>Описание</span>
        </div>
        <div className={styles.sourceRows}>
          {['amount', 'term', 'purpose'].map((field) => (
            <div className={styles.sourceRow} key={field}>
              <span className={styles.sourceLine} />
            </div>
          ))}
        </div>
      </div>
      <div className={styles.bridge}>
        <span className={styles.bridgePulse} />
      </div>
      <div className={styles.formSheet}>
        <span className={styles.fold} />
        <div className={styles.sheetHeading}>
          <span className={styles.formMark} />
          <span>Анкета</span>
        </div>
        <div className={styles.formRows}>
          {['Сумма', 'Срок', 'Цель'].map((label) => (
            <div className={styles.field} key={label}>
              <span>{label}</span>
              <i className={styles.fieldLine} />
            </div>
          ))}
        </div>
      </div>
      <div className={styles.flights}>
        {['amount', 'term', 'purpose'].map((field) => (
          <div className={styles.flight} key={field}>
            <span className={styles.traveller} />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Explain preparation without suggesting server progress or credit approval. */
export function ApplicationPreparation({
  visible,
  slow,
  headingTag,
}: ApplicationPreparationProps) {
  return (
    <div
      className={styles.body}
      data-visible={visible}
      aria-hidden={!visible || undefined}
    >
      <div className={styles.heading}>
        <span className={styles.eyebrow}>Описание становится формой</span>
        <Typography.TitleResponsive
          tag={headingTag}
          view="large"
          font="system"
          weight="bold"
        >
          Готовим вашу заявку
        </Typography.TitleResponsive>
      </div>
      <div className={styles.visualSlot} aria-hidden="true">
        {visible && <ApplicationPreparationVisual />}
      </div>
      <p className={styles.timing}>Обработка в среднем занимает 10 секунд.</p>
      <div className={styles.explanation}>
        <p
          className={styles.copy}
          data-visible={!slow}
          aria-hidden={slow || undefined}
        >
          Переносим сведения из описания в форму. Вы сможете проверить и изменить
          заполненные поля.
        </p>
        <p
          className={styles.slow}
          data-visible={slow}
          aria-hidden={!slow || undefined}
        >
          Подготовка ещё идёт. Можно подождать или заполнить заявку самостоятельно.
        </p>
      </div>
    </div>
  )
}
