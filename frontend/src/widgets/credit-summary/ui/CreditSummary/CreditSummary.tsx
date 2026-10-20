import { useNavigate } from 'react-router-dom'
import { Button } from '@alfalab/core-components/button'
import { Typography } from '@alfalab/core-components/typography'
import { ArrowRightMIcon } from '@alfalab/icons/glyph/dist/ArrowRightMIcon'
import { WalletMIcon } from '@alfalab/icons/glyph/dist/WalletMIcon'
import { ROUTES } from '@/shared/config'
import styles from './CreditSummary.module.scss'

export function CreditSummary() {
  const navigate = useNavigate()

  return (
    <section className={styles.card} aria-labelledby="credit-summary-heading">
      <Typography.TitleResponsive
        tag="h2"
        id="credit-summary-heading"
        view="xsmall"
        font="system"
        weight="bold"
      >
        Кредиты и лимиты
      </Typography.TitleResponsive>
      <div className={styles.body}>
        <span className={styles.icon}>
          <WalletMIcon aria-hidden="true" />
        </span>
        <Typography.Text tag="p" view="primary-medium" weight="medium">
          Действующих кредитов пока нет
        </Typography.Text>
        <Typography.Text tag="p" view="primary-small" color="secondary">
          После выдачи здесь появятся остаток долга, график и ближайший платеж.
        </Typography.Text>
      </div>
      <div>
        <Button
          view="text"
          size={40}
          rightAddons={<ArrowRightMIcon aria-hidden="true" />}
          onClick={() => {
            void navigate(ROUTES.applications)
          }}
        >
          К текущей заявке
        </Button>
      </div>
    </section>
  )
}
