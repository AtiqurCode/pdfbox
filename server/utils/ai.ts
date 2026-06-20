import { BlockSchema, PdfDocSchema, type PdfDoc } from './pdfSchema'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
export const GROQ_MODEL = 'llama-3.3-70b-versatile'

export function newBlockId(type: string): string {
  const p =
    type === 'heading' ? 'h' : type === 'paragraph' ? 'p' : type === 'table' ? 't' : 'b'
  return `${p}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`
}

export function sanitizeSection(section: { blocks: unknown[] }) {
  const blocks = []
  for (const raw of section.blocks) {
    const parsed = BlockSchema.safeParse(raw)
    if (!parsed.success) continue
    const block = parsed.data
    block.id = newBlockId(block.type)
    if (block.type === 'image') continue
    blocks.push(block)
  }
  return { blocks }
}

export function sanitizeAiDoc(raw: unknown): PdfDoc {
  const parsed = PdfDocSchema.parse(raw)
  return {
    ...parsed,
    header: sanitizeSection(parsed.header),
    body: sanitizeSection(parsed.body),
    footer: sanitizeSection(parsed.footer)
  }
}

export const DOC_SYSTEM_PROMPT = `You are a PDF document designer. Output ONLY valid JSON matching this schema:

{
  "title": string (1-200 chars),
  "header": { "blocks": Block[] },
  "body": { "blocks": Block[] },
  "footer": { "blocks": Block[] },
  "design": {
    "font": "Helvetica" | "TimesRoman" | "Courier",
    "textColor": "#RRGGBB",
    "backgroundColor": "#RRGGBB",
    "accentColor": "#RRGGBB",
    "headingColor": "#RRGGBB"
  },
  "layout": {
    "pageSize": "A4" | "A5" | "CUSTOM",
    "orientation": "portrait" | "landscape",
    "marginPt": number (12-144)
  }
}

Block types:
- heading: { "id": string, "type": "heading", "level": 1|2|3, "text": string }
- paragraph: { "id": string, "type": "paragraph", "spans": [{ "text": string, "bold"?: bool, "italic"?: bool, "color"?: "#RRGGBB" }], "align"?: "left"|"center"|"right" }
- table: { "id": string, "type": "table", "columns": number, "rows": number, "cells": [[{ "text": string, "header"?: bool }]] }

Rules:
- Do NOT include image blocks.
- Use {{field.name}} merge tokens when the user wants personalization.
- Use realistic placeholder content, not lorem ipsum unless asked.
- Every block needs a unique id string.
- Colors must be valid 6-digit hex.`

export const REWRITE_SYSTEM_PROMPT = `You rewrite a single PDF content block. Output ONLY valid JSON for ONE block (heading, paragraph, or table — never image).

Preserve the block type and structure. For paragraphs keep the spans array format.
Apply the user's instruction to the content only.`

export const MERGE_SUGGEST_PROMPT = `You suggest merge fields for a PDF template. Output ONLY JSON:
{
  "fields": [{ "key": string, "value": string }],
  "templateHint": string
}

Keys use dot notation for groups (e.g. client.name). Values are realistic sample data.
Match column names from the CSV when provided.`

type GroqMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export async function chatJson(apiKey: string, messages: GroqMessage[]): Promise<string> {
  const res = await $fetch<{
    choices?: { message?: { content?: string } }[]
  }>(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: {
      model: GROQ_MODEL,
      messages,
      temperature: 0.35,
      response_format: { type: 'json_object' }
    }
  })
  const content = res.choices?.[0]?.message?.content
  if (!content) throw new Error('Empty response from AI')
  return content
}

export function parseJsonContent<T>(content: string): T {
  const trimmed = content.trim()
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON object in AI response')
  return JSON.parse(jsonMatch[0]) as T
}

export function requireGroqKey(): string {
  const key = useRuntimeConfig().groqApiKey
  if (!key) {
    throw createError({
      statusCode: 503,
      message: 'AI is not configured. Set GROQ_API_KEY in your environment.'
    })
  }
  return key
}
