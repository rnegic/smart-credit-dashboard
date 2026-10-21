import { z } from 'zod'

export const companySchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  inn: z.string(),
  okved: z.string().nullable(),
  legalForm: z.string().nullable(),
})
export type Company = z.infer<typeof companySchema>
