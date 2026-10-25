import { z } from 'zod'

export const assistantFieldSchema = z.object({
  id: z.string().max(160),
  label: z.string().max(200),
  hint: z.string().max(600),
  value: z.string().max(300).nullable(),
  filled: z.boolean(),
  required: z.boolean(),
  invalid: z.boolean(),
  readOnly: z.boolean(),
})

export const assistantScreenSchema = z.object({
  path: z.string().max(200),
  title: z.string().max(300),
  step: z.string().max(160).nullable(),
  product: z.string().max(200).nullable(),
  text: z.string().max(12_000),
  focusedFieldId: z.string().max(160).nullable(),
  fields: z.array(assistantFieldSchema).max(40),
})

export const assistantMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(6000),
})

export const assistantAnswerSchema = z.object({
  answer: z.string().trim().min(1).max(6000),
  focusFieldId: z.string().max(160).nullable().default(null),
})

export type AssistantScreen = z.infer<typeof assistantScreenSchema>
export type AssistantMessage = z.infer<typeof assistantMessageSchema>
export type AssistantAnswer = z.infer<typeof assistantAnswerSchema>

/** Only rendered screen context and a bounded conversation leave the browser. */
export interface AssistantRequest {
  message: string
  history: AssistantMessage[]
  screen: AssistantScreen
}
