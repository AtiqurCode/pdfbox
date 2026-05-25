import JSZip from 'jszip'
import { z } from 'zod'
import { PdfDocSchema, mergeTemplate } from '../../utils/pdfSchema'

// We implement a minimal in-process batch pipeline by reusing the same payload
// shape and calling the same renderer via $fetch. Nitro runs this in the same
// server runtime; we keep it sequential to avoid blowing memory.

const BatchSchema = z.object({
  template: PdfDocSchema,
  rows: z.array(z.record(z.string(), z.unknown())).min(1).max(500),
  namePattern: z.string().min(1).max(200).optional()
})

function sanitizeFilename(name: string): string {
  const base = name.trim().length > 0 ? name.trim() : 'document'
  return base.replaceAll(/[^\w\-\.]+/g, '_')
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = BatchSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid batch request',
      data: { issues: parsed.error.issues }
    })
  }

  const { template, rows, namePattern } = parsed.data
  const zip = new JSZip()

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    const payload = { ...template, data: row }
    const pdfBytes = await $fetch<ArrayBuffer>('/api/pdf', {
      method: 'POST',
      body: payload,
      responseType: 'arrayBuffer'
    })

    const dataForName = { ...row, index: i + 1, title: mergeTemplate(template.title, row) }
    const rawName = mergeTemplate(namePattern ?? '{{title}}-{{index}}.pdf', dataForName)
    const filename = sanitizeFilename(rawName.endsWith('.pdf') ? rawName : `${rawName}.pdf`)
    zip.file(filename, new Uint8Array(pdfBytes))
  }

  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } })
  setHeader(event, 'Content-Type', 'application/zip')
  setHeader(event, 'Content-Disposition', `attachment; filename="${sanitizeFilename(template.title)}.zip"`)
  return bytes
})

