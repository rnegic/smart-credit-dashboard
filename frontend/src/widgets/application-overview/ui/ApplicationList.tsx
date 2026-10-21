import { Button } from '@alfalab/core-components/button'
import { useNavigate } from 'react-router-dom'
import { useApplications } from '@/entities/loan-application'
import { ApplicationOverview } from './ApplicationOverview'
import { RequestState } from '@/shared/ui'
import { ROUTES } from '@/shared/config'

export function ApplicationList() {
  const query = useApplications()
  const navigate = useNavigate()
  if (query.isPending) return <RequestState />
  if (query.error)
    return (
      <RequestState
        error={query.error}
        retry={() => {
          void query.refetch()
        }}
      />
    )
  return (
    <>
      <Button
        view="secondary"
        onClick={() => {
          void navigate(ROUTES.application.root)
        }}
      >
        Новая заявка
      </Button>
      {query.data.length === 0 ? (
        <p>
          Заявок пока нет. Укажите задачу бизнеса и отправьте запрос на
          финансирование.
        </p>
      ) : (
        query.data.map((application) => (
          <ApplicationOverview key={application.id} application={application} />
        ))
      )}
    </>
  )
}
