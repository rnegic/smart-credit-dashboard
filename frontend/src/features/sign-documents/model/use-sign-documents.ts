import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  applicationDocumentsKey,
  applicationDocumentsSchema,
  documentPackageVersion,
  getApplicationDocuments,
  useApplicationDocuments,
  type ApplicationDocuments,
} from '@/entities/application-document'
import { useApplications, type Offer } from '@/entities/loan-application'
import { ApiError, apiRequest, getSessionGeneration, useApiScope } from '@/shared/api'

function assertSession(generation: number) {
  if (generation !== getSessionGeneration())
    throw new ApiError(409, 'SESSION_CHANGED', 'Профиль изменился. Повторите действие.')
}

/** Recheck reviewed documents and contract duration; reconcile an uncertain POST before retrying. */
export function useSignDocuments(applicationId: number, open: boolean, providedOffer?: Offer | null) {
  const scope = useApiScope()
  const cache = useQueryClient()
  const documents = useApplicationDocuments(applicationId, open)
  const applications = useApplications()
  const application = applications.data?.find((item) => item.id === applicationId)
  const offer = application ? application.offer : providedOffer
  const key = applicationDocumentsKey(scope, applicationId)

  const sign = useMutation({
    retry: false,
    mutationFn: async ({ snapshot, contractTermMonths, generation }: {
      snapshot: ApplicationDocuments
      contractTermMonths: Offer['contractTermMonths']
      generation: number
    }) => {
      assertSession(generation)
      const latest = await getApplicationDocuments(applicationId)
      assertSession(generation)
      await cache.cancelQueries({ queryKey: key, exact: true })
      assertSession(generation)
      cache.setQueryData(key, latest)
      if (latest.offerId !== snapshot.offerId ||
          documentPackageVersion(latest) !== documentPackageVersion(snapshot))
        throw new ApiError(409, 'DOCUMENT_VERSION_MISMATCH', 'Документы обновились. Прочитайте новую версию и подтвердите ознакомление ещё раз.')
      const current = await applications.refetch({ throwOnError: true })
      assertSession(generation)
      const currentApplication = current.data?.find((item) => item.id === applicationId)
      const currentOffer = currentApplication?.offer
      if (!currentOffer || currentOffer.id !== latest.offerId ||
          currentOffer.contractTermMonths !== contractTermMonths)
        throw new ApiError(409, 'DOCUMENT_VERSION_MISMATCH', 'Условия договора обновились. Проверьте срок договора и документы и подтвердите ознакомление ещё раз.')
      if (latest.signedAt) return latest
      if (currentApplication?.status !== 'SIGNATURE_PENDING' || currentOffer.status !== 'ACCEPTED' ||
          !latest.signingAllowed || latest.offerId === null || latest.documentVersion === null)
        throw new ApiError(409, 'INVALID_STAGE', 'Подписание сейчас недоступно. Проверьте актуальное предложение.')

      try {
        const result = await apiRequest(`/api/offers/${latest.offerId}/sign`, applicationDocumentsSchema, {
          method: 'POST',
          body: JSON.stringify({ documentVersion: latest.documentVersion, confirmed: true }),
        })
        if (result.applicationId !== applicationId || result.offerId !== latest.offerId ||
            documentPackageVersion(result) !== documentPackageVersion(latest) || !result.signedAt)
          throw new ApiError(200, 'INVALID_RESPONSE', 'Сервер не подтвердил подписание выбранных документов')
        return result
      } catch (error) {
        assertSession(generation)
        if (error instanceof ApiError &&
            (error.code === 'SESSION_CHANGED' || [400, 401, 403, 404, 409].includes(error.status)))
          throw error
        let recovered: ApplicationDocuments
        let recoveredOffer: Offer | null | undefined
        try {
          recovered = await getApplicationDocuments(applicationId)
          assertSession(generation)
          const current = await applications.refetch({ throwOnError: true })
          assertSession(generation)
          recoveredOffer = current.data?.find((item) => item.id === applicationId)?.offer
        } catch {
          assertSession(generation)
          throw new ApiError(0, 'SIGNATURE_RESULT_UNKNOWN', 'Ответ не получен. Подпись могла сохраниться: проверьте результат перед повторной попыткой.')
        }
        cache.setQueryData(key, recovered)
        if (recovered.signedAt && recovered.offerId === snapshot.offerId &&
            recoveredOffer?.id === snapshot.offerId && recoveredOffer.contractTermMonths === contractTermMonths &&
            documentPackageVersion(recovered) === documentPackageVersion(snapshot))
          return recovered
        throw error
      }
    },
    onSuccess: async (data, { generation }) => {
      if (generation !== getSessionGeneration()) return
      await cache.cancelQueries({ queryKey: key, exact: true })
      if (generation !== getSessionGeneration()) return
      cache.setQueryData(key, data)
      for (const resource of ['applications', 'dashboard', 'notifications'])
        void cache.invalidateQueries({ queryKey: ['client', scope, resource] })
    },
    onError: (error, { generation }) => {
      if (generation !== getSessionGeneration()) return
      if (error instanceof ApiError && error.status === 409)
        void cache.invalidateQueries({ queryKey: key, exact: true })
    },
  })

  async function refresh() {
    const generation = getSessionGeneration()
    try {
      await Promise.all([
        documents.refetch({ throwOnError: true }),
        applications.refetch({ throwOnError: true }),
      ])
      if (generation === getSessionGeneration()) sign.reset()
    } catch {
      // The query exposes the error; keep the uncertain result blocked.
    }
  }

  return {
    documents,
    applications,
    offer,
    sign,
    refresh,
    uncertain: sign.error instanceof ApiError && sign.error.code === 'SIGNATURE_RESULT_UNKNOWN',
  }
}
