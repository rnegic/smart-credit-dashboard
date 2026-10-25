import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { apiRequest, ApiError, useApiScope } from '@/shared/api'

export const applicationDocumentSchema = z.object({
  type: z.enum(['OVERDRAFT_AGREEMENT', 'INDIVIDUAL_TERMS']),
  title: z.string().min(1),
  content: z.string().min(1),
})

export const applicationDocumentsSchema = z.object({
  applicationId: z.number().int().positive(),
  offerId: z.number().int().positive().nullable(),
  documentVersion: z.string().min(1).nullable(),
  documents: z.array(applicationDocumentSchema),
  signingAllowed: z.boolean(),
  signedAt: z.iso.datetime({ offset: true }).nullable(),
  signedBy: z.object({
    id: z.number().int().positive(),
    fullName: z.string().min(1),
  }).nullable(),
  demo: z.boolean(),
}).superRefine((data, context) => {
  const complete = data.offerId !== null && data.documentVersion !== null &&
    data.documents.length === 2 && new Set(data.documents.map((doc) => doc.type)).size === 2
  if (
    (data.signedAt === null) !== (data.signedBy === null) ||
    ((data.signingAllowed || data.signedAt !== null) && !complete) ||
    (data.signingAllowed && data.signedAt !== null)
  ) context.addIssue({ code: 'custom', message: 'Некорректный пакет документов' })
})

export type ApplicationDocument = z.infer<typeof applicationDocumentSchema>
export type ApplicationDocuments = z.infer<typeof applicationDocumentsSchema>

/** Keep document caches isolated by session and application. */
export function applicationDocumentsKey(
  scope: ReturnType<typeof useApiScope>,
  applicationId: number | null | undefined,
) {
  return ['client', scope, 'documents', applicationId] as const
}

/** Bind the server package to the requested application before displaying it. */
export async function getApplicationDocuments(applicationId: number, signal?: AbortSignal) {
  const data = await apiRequest(
    `/api/applications/${applicationId}/documents`,
    applicationDocumentsSchema,
    { signal },
  )
  if (data.applicationId !== applicationId)
    throw new ApiError(200, 'INVALID_RESPONSE', 'Документы не относятся к выбранной заявке')
  return data
}

/** Acknowledgement belongs to the exact displayed texts, not just their filenames. */
export function documentPackageVersion(data: ApplicationDocuments) {
  return JSON.stringify([data.applicationId, data.offerId, data.documentVersion, data.documents])
}

/** Server data is shared by the documents page, dashboard and signing dialog. */
export function useApplicationDocuments(
  applicationId: number | null | undefined,
  enabled = true,
) {
  const scope = useApiScope()
  return useQuery({
    queryKey: applicationDocumentsKey(scope, applicationId),
    queryFn: ({ signal }) => {
      if (applicationId == null) throw new Error('Заявка не выбрана')
      return getApplicationDocuments(applicationId, signal)
    },
    enabled: enabled && applicationId != null && scope !== null,
    retry: false,
    staleTime: 15_000,
    refetchInterval: (query) => query.state.data?.signingAllowed ? 15_000 : false,
  })
}
