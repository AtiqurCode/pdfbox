import { z } from 'zod'
import { MERGE_SUGGEST_PROMPT, chatJson, parseJsonContent, requireGroqKey } from '../../utils/ai'

const BodySchema = z.object({
  columns: z.array(z.string()).optional(),
  sampleRow: z.record(z.string(), z.unknown()).optional(),
  documentTitle: z.string().optional(),
  prompt: z.string().max(2000).optional()
})

const ResultSchema = z.object({
  fields: z.array(z.object({ key: z.string(), value: z.string() })),
  templateHint: z.string().optional()
})

export default defineEventHandler(async (event) => {
  const body = BodySchema.parse(await readBody(event))
  const apiKey = requireGroqKey()

  const parts = [
    body.prompt || 'Suggest merge fields for this PDF document.',
    body.documentTitle ? `Document title: ${body.documentTitle}` : '',
    body.columns?.length ? `CSV columns: ${body.columns.join(', ')}` : '',
    body.sampleRow ? `Sample row: ${JSON.stringify(body.sampleRow)}` : ''
  ].filter(Boolean)

  const content = await chatJson(apiKey, [
    { role: 'system', content: MERGE_SUGGEST_PROMPT },
    { role: 'user', content: parts.join('\n') }
  ])

  const raw = parseJsonContent<unknown>(content)
  const parsed = ResultSchema.safeParse(raw)
  if (!parsed.success) {
    throw createError({ statusCode: 422, message: 'AI returned invalid merge suggestions' })
  }

  return parsed.data
})
