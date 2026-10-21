import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@alfalab/core-components/button'
import { useSession, sessionKey, sessionSchema } from '@/entities/session'
import { apiEmpty, apiRequest } from '@/shared/api'
import { Panel } from '@/shared/ui'
import { SessionActions } from '../SessionActions/SessionActions'
import styles from './LegalForm.module.scss'

export function LegalForm() {
  const session = useSession()
  const cache = useQueryClient()
  const mutation = useMutation({
    mutationFn: async (legalForm: 'IP' | 'OOO') => {
      await apiEmpty('/api/company/legal-form', {
        method: 'POST',
        body: JSON.stringify({ legalForm }),
      })
      return apiRequest('/api/auth/me', sessionSchema)
    },
    onSuccess: async (me) => {
      cache.setQueryData(sessionKey, me)
      await cache.invalidateQueries({ queryKey: ['client', me.userId] })
    },
  })
  return (
    <Panel
      open={session.data?.role === 'CLIENT' && session.data.legalForm === null}
      title="Уточните форму бизнеса"
      dismissible={false}
      onClose={() => {}}
    >
      <div className={styles.body}>
        <p>
          Название и регистрационные данные уже сохранены. Выберите правовую
          форму, чтобы подать заявку.
        </p>
        <Button
          view="primary"
          block
          disabled={mutation.isPending}
          loading={mutation.isPending && mutation.variables === 'IP'}
          onClick={() => mutation.mutate('IP')}
        >
          Индивидуальный предприниматель (ИП)
        </Button>
        <Button
          view="secondary"
          block
          disabled={mutation.isPending}
          loading={mutation.isPending && mutation.variables === 'OOO'}
          onClick={() => mutation.mutate('OOO')}
        >
          Общество с ограниченной ответственностью (ООО)
        </Button>
        {mutation.error && <p role="alert">{mutation.error.message}</p>}
        <SessionActions />
      </div>
    </Panel>
  )
}
