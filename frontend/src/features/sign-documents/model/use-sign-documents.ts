import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  applicationDocumentsKey,
  applicationDocumentsSchema,
  documentPackageVersion,
  getApplicationDocuments,
  useApplicationDocuments,
  type ApplicationDocuments,
} from '@/entities/application-document'
import { ApiError, apiRequest, getSessionGeneration, useApiScope } from '@/shared/api'

function assertSession(generation: number) {
  if (generation !== getSessionGeneration())
    throw new ApiError(409, 'SESSION_CHANGED', 'Профиль изменился. Повторите действие.')
}

/** Recheck the exact reviewed package and reconcile an uncertain POST before retrying. */
export function useSignDocuments(applicationId: number, open: boolean) {
  const scope = useApiScope()
  const cache = useQueryClient()
  const documents = useApplicationDocuments(applicationId, open)
  const key = applicationDocumentsKey(scope, applicationId)

  const sign = useMutation({
    retry: false,
    mutationFn: async ({ snapshot, generation }: {
      snapshot: ApplicationDocuments
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
      if (latest.signedAt) return latest
      if (!latest.signingAllowed || latest.offerId === null || latest.documentVersion === null)
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
        try {
          recovered = await getApplicationDocuments(applicationId)
          assertSession(generation)
        } catch {
          assertSession(generation)
          throw new ApiError(0, 'SIGNATURE_RESULT_UNKNOWN', 'Ответ не получен. Подпись могла сохраниться: проверьте результат перед повторной попыткой.')
        }
        cache.setQueryData(key, recovered)
        if (recovered.signedAt && recovered.offerId === snapshot.offerId &&
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
      await documents.refetch({ throwOnError: true })
      if (generation === getSessionGeneration()) sign.reset()
    } catch {
      // The query exposes the error; keep the uncertain result blocked.
    }
  }

  return {
    documents,
    sign,
    refresh,
    uncertain: sign.error instanceof ApiError && sign.error.code === 'SIGNATURE_RESULT_UNKNOWN',
  }
}
