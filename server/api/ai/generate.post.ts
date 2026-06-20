import { z } from 'zod'
import {
  DOC_SYSTEM_PROMPT,
  chatJson,
  parseJsonContent,
  requireGroqKey,
  sanitizeAiDoc
} from '../../utils/ai'
import { PdfDocSchema } from '../../utils/pdfSchema'

const BodySchema = z.object({
  prompt: z.string().min(3).max(4000),
  mode: z.enum(['replace', 'merge-body', 'improve']).default('replace'),
  currentConfig: PdfDocSchema.optional()
})

export default defineEventHandler(async (event) => {
  const body = BodySchema.parse(await readBody(event))
  const apiKey = requireGroqKey()

  let userPrompt = body.prompt
  if (body.mode === 'improve' && body.currentConfig) {
    userPrompt = `${body.prompt}\n\nImprove this existing document config (keep structure, improve content and design):\n${JSON.stringify(body.currentConfig)}`
  } else if (body.mode === 'merge-body' && body.currentConfig) {
    userPrompt = `${body.prompt}\n\nGenerate only body content blocks. I will merge them into my existing document. Current header/footer/design for context:\n${JSON.stringify({
      title: body.currentConfig.title,
      header: body.currentConfig.header,
      footer: body.currentConfig.footer,
      design: body.currentConfig.design
    })}`
  }

  let lastError = 'Invalid document from AI'
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const content = await chatJson(apiKey, [
        { role: 'system', content: DOC_SYSTEM_PROMPT },
        {
          role: 'user',
          content:
            attempt === 0
              ? userPrompt
              : `${userPrompt}\n\nYour previous response failed validation. Return ONLY a valid JSON object matching the schema exactly.`
        }
      ])
      const raw = parseJsonContent<unknown>(content)
      const doc = sanitizeAiDoc(raw)

      if (body.mode === 'merge-body' && body.currentConfig) {
        return {
          ...body.currentConfig,
          title: doc.title || body.currentConfig.title,
          body: doc.body
        }
      }

      return doc
    } catch (e: any) {
      lastError = e?.message || lastError
    }
  }

  throw createError({ statusCode: 422, message: lastError })
})
