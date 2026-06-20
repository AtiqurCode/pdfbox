import { z } from 'zod'
import {
  REWRITE_SYSTEM_PROMPT,
  chatJson,
  newBlockId,
  parseJsonContent,
  requireGroqKey
} from '../../utils/ai'
import { BlockSchema } from '../../utils/pdfSchema'

const BodySchema = z.object({
  block: BlockSchema,
  instruction: z.string().min(2).max(500)
})

export default defineEventHandler(async (event) => {
  const { block, instruction } = BodySchema.parse(await readBody(event))
  if (block.type === 'image') {
    throw createError({ statusCode: 400, message: 'Cannot rewrite image blocks with AI' })
  }

  const apiKey = requireGroqKey()
  const content = await chatJson(apiKey, [
    { role: 'system', content: REWRITE_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Instruction: ${instruction}\n\nBlock to rewrite:\n${JSON.stringify(block)}`
    }
  ])

  const raw = parseJsonContent<unknown>(content)
  const parsed = BlockSchema.safeParse(raw)
  if (!parsed.success) {
    throw createError({ statusCode: 422, message: 'AI returned an invalid block' })
  }

  const next = parsed.data
  next.id = block.id
  if (next.type === 'image') {
    throw createError({ statusCode: 422, message: 'AI cannot output image blocks' })
  }

  // Preserve table dimensions if AI drifted
  if (block.type === 'table' && next.type === 'table') {
    next.columns = block.columns
    next.rows = block.rows
    if (next.cells.length !== block.rows) {
      next.cells = block.cells
    }
  }

  if (!next.id) next.id = newBlockId(next.type)
  return next
})
