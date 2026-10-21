import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@alfalab/core-components/button'
import { Typography } from '@alfalab/core-components/typography'
import type { Application, Offer } from '@/entities/loan-application'
import { apiEmpty, useApiScope } from '@/shared/api'
import { formatMoney } from '@/shared/lib'
import styles from './AcceptOffer.module.scss'

/** The real offer belonging to the application being displayed. */
export interface AcceptOfferProps {
  offer: Offer
  application: Application
}
/** Separates choosing the offered terms from their signing confirmation. */
export function AcceptOffer({ offer, application }: AcceptOfferProps) {
  const [confirm, setConfirm] = useState(false)
  const submitting = useRef(false)
  const cache = useQueryClient()
  const scope = useApiScope()
  const expired = new Date(`${offer.validUntil}T23:59:59`) < new Date()
  const sign = useMutation({
    mutationFn: () =>
      apiEmpty(`/api/offers/${offer.id}/sign`, { method: 'POST' }),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ['client', scope] })
    },
    onError: () => {
      void cache.invalidateQueries({ queryKey: ['client', scope] })
    },
    onSettled: () => {
      submitting.current = false
    },
  })
  if (sign.isSuccess) {
    return (
      <div className={styles.body} role="status">
        <Typography.TitleResponsive tag="h3" view="small" font="system">
          Предложение принято
        </Typography.TitleResponsive>
        <p>Ожидаем подтверждения выдачи. Деньги еще не зачислены.</p>
      </div>
    )
  }
  if (
    offer.status !== 'ACTIVE' ||
    expired ||
    application.status !== 'OFFER_READY'
  )
    return <p>Предложение недоступно для принятия. Обновите данные заявки.</p>
  return (
    <div className={styles.body}>
      <Typography.TitleResponsive tag="h3" view="small" font="system">
        {confirm ? 'Подписание' : 'Выбор предложения'}
      </Typography.TitleResponsive>
      {confirm ? (
        <div className={styles.body} role="status">
          <p>
            Вы выбрали предложение банка. Подтвердите подписание условий:{' '}
            {formatMoney(offer.amount)} на {offer.termMonths} мес. по ставке{' '}
            {offer.ratePercent}% годовых. Ежемесячный платеж:{' '}
            {formatMoney(offer.monthlyPayment)}.
          </p>
          <p>После подписания ожидайте подтверждения выдачи.</p>
        </div>
      ) : (
        <p>
          Выберите предложенные банком условия, чтобы перейти к подписанию. На
          следующем шаге вы сможете проверить и подтвердить свой выбор.
        </p>
      )}
      {sign.error && <p role="alert">{sign.error.message}</p>}
      <Button
        view="primary"
        block
        loading={sign.isPending}
        disabled={sign.isPending}
        onClick={() => {
          if (!confirm) {
            setConfirm(true)
            return
          }
          if (!submitting.current) {
            submitting.current = true
            sign.mutate()
          }
        }}
      >
        {confirm ? 'Подтвердить подписание' : 'Выбрать предложение банка'}
      </Button>
      {confirm && (
        <Button
          view="text"
          block
          disabled={sign.isPending}
          onClick={() => {
            setConfirm(false)
            sign.reset()
          }}
        >
          Вернуться к условиям
        </Button>
      )}
    </div>
  )
}
