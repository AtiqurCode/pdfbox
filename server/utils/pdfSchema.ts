import { z } from 'zod'

// ─────────────────────────────────────────────────────────────────────────────
// Shared PDF document schema + merge helpers.
// Imported by both /api/pdf and /api/pdf/batch so the contract can't drift.
// ─────────────────────────────────────────────────────────────────────────────

export const ColorHex = z
  .string()
  .regex(/^#([0-9a-fA-F]{6})$/, 'Expected hex color like #RRGGBB')

export const DataUrl = z.string().startsWith('data:', 'Expected a data: URL')

export const RichTextSpanSchema = z.object({
  text: z.string(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  color: ColorHex.optional()
})

export const ParagraphBlockSchema = z.object({
  id: z.string(),
  type: z.literal('paragraph'),
  spans: z.array(RichTextSpanSchema),
  align: z.enum(['left', 'center', 'right']).optional()
})

export const HeadingBlockSchema = z.object({
  id: z.string(),
  type: z.literal('heading'),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  text: z.string()
})

export const TableCellSchema = z.object({
  text: z.string(),
  header: z.boolean().optional()
})

export const TableBlockSchema = z.object({
  id: z.string(),
  type: z.literal('table'),
  columns: z.number().int().min(1).max(20),
  rows: z.number().int().min(1).max(100),
  cells: z.array(z.array(TableCellSchema))
})

export const ImageBlockSchema = z.object({
  id: z.string(),
  type: z.literal('image'),
  dataUrl: DataUrl,
  widthPt: z.number().positive().optional(),
  heightPt: z.number().positive().optional(),
  align: z.enum(['left', 'center', 'right']).optional(),
  opacity: z.number().min(0).max(1).optional()
})

export const BlockSchema = z.discriminatedUnion('type', [
  ParagraphBlockSchema,
  HeadingBlockSchema,
  TableBlockSchema,
  ImageBlockSchema
])

export const SectionSchema = z.object({
  blocks: z.array(BlockSchema)
})

export const LayoutSchema = z.object({
  pageSize: z.enum(['A4', 'A5', 'CUSTOM']),
  customWidthPt: z.number().optional(),
  customHeightPt: z.number().optional(),
  orientation: z.enum(['portrait', 'landscape']),
  marginPt: z.number().min(12).max(144)
})

export const DesignSchema = z.object({
  font: z.enum(['Helvetica', 'TimesRoman', 'Courier']),
  customFonts: z
    .object({
      regular: DataUrl.optional(),
      bold: DataUrl.optional(),
      italic: DataUrl.optional(),
      boldItalic: DataUrl.optional()
    })
    .optional(),
  textColor: ColorHex,
  backgroundColor: ColorHex,
  accentColor: ColorHex,
  headingColor: ColorHex
})

export const PdfDocSchema = z.object({
  title: z.string().min(1).max(200),
  data: z.record(z.string(), z.unknown()).optional(),
  header: SectionSchema,
  body: SectionSchema,
  footer: SectionSchema,
  design: DesignSchema,
  layout: LayoutSchema
})

export type PdfDoc = z.infer<typeof PdfDocSchema>

// ── Merge-template helpers ───────────────────────────────────────────────────

export function resolvePath(data: any, path: string): unknown {
  const p = path
    .trim()
    .replace(/^\./, '')
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean)
  let cur: any = data
  for (const k of p) {
    if (cur == null) return undefined
    cur = cur[k]
  }
  return cur
}

export function mergeTemplate(input: string, data: Record<string, unknown> | undefined): string {
  if (!data) return input
  return input.replace(/{{\s*([^}]+)\s*}}/g, (_m, expr: string) => {
    const v = resolvePath(data, expr)
    if (v == null) return ''
    if (typeof v === 'string') return v
    if (typeof v === 'number' || typeof v === 'boolean') return String(v)
    try {
      return JSON.stringify(v)
    } catch {
      return String(v)
    }
  })
}
