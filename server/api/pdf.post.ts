import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { z } from 'zod'
import {
  PdfDocSchema,
  RichTextSpanSchema,
  TableBlockSchema,
  ImageBlockSchema,
  SectionSchema,
  DesignSchema,
  mergeTemplate
} from '../utils/pdfSchema'
import {
  hexToRgb01,
  idealTextColorOn,
  mixHex,
  pageSizePt,
  wrapText,
  decodeDataUrl,
  sanitizeFilename
} from '../utils/pdfLayout'

/** Convert a #RRGGBB string straight into a pdf-lib color. */
function rgbHex(hex: string) {
  const { r, g, b } = hexToRgb01(hex)
  return rgb(r, g, b)
}

function pickStandardFonts(font: z.infer<typeof DesignSchema>['font']) {
  if (font === 'TimesRoman') {
    return {
      regular: StandardFonts.TimesRoman,
      bold: StandardFonts.TimesRomanBold,
      italic: StandardFonts.TimesRomanItalic,
      boldItalic: StandardFonts.TimesRomanBoldItalic
    }
  }
  if (font === 'Courier') {
    return {
      regular: StandardFonts.Courier,
      bold: StandardFonts.CourierBold,
      italic: StandardFonts.CourierOblique,
      boldItalic: StandardFonts.CourierBoldOblique
    }
  }
  return {
    regular: StandardFonts.Helvetica,
    bold: StandardFonts.HelveticaBold,
    italic: StandardFonts.HelveticaOblique,
    boldItalic: StandardFonts.HelveticaBoldOblique
  }
}

type RendererCtx = {
  pdf: PDFDocument
  pageW: number
  pageH: number
  margin: number
  cursorY: number
  page: ReturnType<PDFDocument['addPage']>
  data?: Record<string, unknown>
  measure: (font: any, size: number, s: string) => number
  embedImageFromDataUrl: (dataUrl: string) => Promise<{ img: any; w: number; h: number }>
  colors: {
    text: ReturnType<typeof rgb>
    heading: ReturnType<typeof rgb>
    accent: ReturnType<typeof rgb>
    background: ReturnType<typeof rgb>
  }
  /** Raw hex values, kept so renderers can derive tints / contrast colors. */
  hex: {
    text: string
    heading: string
    accent: string
    background: string
  }
  fonts: {
    regular: any
    bold: any
    italic: any
    boldItalic: any
  }
}

function addPageWithBackground(ctx: Pick<RendererCtx, 'pdf' | 'pageW' | 'pageH' | 'colors'>) {
  const page = ctx.pdf.addPage([ctx.pageW, ctx.pageH])
  // Important: background must be drawn FIRST, otherwise it will cover content.
  page.drawRectangle({
    x: 0,
    y: 0,
    width: ctx.pageW,
    height: ctx.pageH,
    color: ctx.colors.background
  })
  return page
}

function ensureSpace(ctx: RendererCtx, needed: number, opts?: { allowNewPage?: boolean }) {
  if (ctx.cursorY - needed >= ctx.margin) return true
  if (opts?.allowNewPage === false) return false
  ctx.page = addPageWithBackground(ctx)
  ctx.cursorY = ctx.pageH - ctx.margin
  return true
}

function renderHeading(ctx: RendererCtx, level: 1 | 2 | 3, text: string) {
  const size = level === 1 ? 22 : level === 2 ? 15 : 12.5
  const lineH = size * 1.25
  // Generous space above, tighter below — gives each section a clear start.
  const spaceAbove = level === 1 ? 10 : level === 2 ? 14 : 10
  ensureSpace(ctx, lineH + spaceAbove + (level === 1 ? 8 : 0))
  ctx.cursorY -= spaceAbove

  const label = mergeTemplate(text, ctx.data)
  const baselineY = ctx.cursorY - size
  ctx.page.drawText(label, {
    x: ctx.margin,
    y: baselineY,
    size,
    font: ctx.fonts.bold,
    color: ctx.colors.heading
  })

  // H1 gets a short accent underline that tracks the title width — the small
  // touch that makes a document read as "designed" rather than typed.
  if (level === 1) {
    // A short, fixed accent bar under the title — a recognizable design accent
    // rather than a half-underline that trails off under whitespace.
    ctx.page.drawRectangle({
      x: ctx.margin,
      y: baselineY - 6,
      width: 48,
      height: 3,
      color: ctx.colors.accent
    })
    ctx.cursorY -= lineH + 8
  } else {
    ctx.cursorY -= lineH
  }
}

function renderParagraph(
  ctx: RendererCtx,
  spans: Array<z.infer<typeof RichTextSpanSchema>>,
  align: 'left' | 'center' | 'right' | undefined,
  fontSize = 11
) {
  const size = fontSize
  const lineH = size * 1.45
  const maxW = ctx.pageW - ctx.margin * 2

  const safeSpans = spans
    .map((s) => ({
      ...s,
      // Keep newlines: they're honored as hard line breaks below.
      text: mergeTemplate(String(s.text ?? ''), ctx.data).replace(/\r\n/g, '\n')
    }))
    .filter((s) => s.text.length > 0)

  type Run = { text: string; font: any; color: ReturnType<typeof rgb> }
  const runs: Run[] = safeSpans.map((span) => {
    const useFont =
      span.bold && span.italic
        ? ctx.fonts.boldItalic
        : span.bold
          ? ctx.fonts.bold
          : span.italic
            ? ctx.fonts.italic
            : ctx.fonts.regular
    const c = span.color ? hexToRgb01(span.color) : null
    const color = c ? rgb(c.r, c.g, c.b) : ctx.colors.text
    return { text: span.text, font: useFont, color }
  })

  type Piece = { text: string; font: any; color: ReturnType<typeof rgb>; w: number }
  let line: Piece[] = []
  let lineW = 0

  function flushLine() {
    if (line.length === 0) return
    ensureSpace(ctx, lineH)
    const xStart =
      align === 'center'
        ? ctx.margin + (maxW - lineW) / 2
        : align === 'right'
          ? ctx.margin + (maxW - lineW)
          : ctx.margin
    let x = xStart
    for (const p of line) {
      if (p.text.length === 0) continue
      ctx.page.drawText(p.text, { x, y: ctx.cursorY - size, size, font: p.font, color: p.color })
      x += p.w
    }
    ctx.cursorY -= lineH
    line = []
    lineW = 0
  }

  function pushPiece(text: string, font: any, color: ReturnType<typeof rgb>) {
    if (text.length === 0) return
    const w = ctx.measure(font, size, text)
    line.push({ text, font, color, w })
    lineW += w
  }

  function splitTokenToFit(token: string, font: any, available: number): { head: string; tail: string } {
    if (available <= 0) return { head: '', tail: token }
    let buf = ''
    for (const ch of token) {
      const next = buf + ch
      if (ctx.measure(font, size, next) <= available) buf = next
      else break
    }
    return { head: buf, tail: token.slice(buf.length) }
  }

  for (const run of runs) {
    const tokens = run.text.split(/(\s+)/).filter((t) => t.length > 0)
    for (let token of tokens) {
      // A whitespace token containing a newline forces a hard line break.
      if (/\n/.test(token)) {
        flushLine()
        continue
      }
      if (line.length === 0 && /^\s+$/.test(token)) continue

      const tokenW = ctx.measure(run.font, size, token)
      if (lineW + tokenW <= maxW) {
        pushPiece(token, run.font, run.color)
        continue
      }

      if (line.length > 0) {
        flushLine()
        if (/^\s+$/.test(token)) continue
      }

      while (token.length > 0) {
        const available = maxW - lineW
        const { head, tail } = splitTokenToFit(token, run.font, available)
        if (head.length > 0) pushPiece(head, run.font, run.color)
        token = tail
        if (token.length > 0) flushLine()
      }
    }
  }

  flushLine()
  ctx.cursorY -= 2
}

function renderTable(ctx: RendererCtx, table: z.infer<typeof TableBlockSchema>) {
  const size = 10
  const rowH = 24
  const padding = 8
  const maxW = ctx.pageW - ctx.margin * 2
  const cols = Math.max(1, table.columns)
  const colW = maxW / cols

  // A modern, restrained palette derived from the document colors:
  //  - header cells use the accent band with an auto-contrast text color
  //  - body rows alternate a faint accent tint (zebra striping)
  //  - separators are thin horizontal rules; no heavy vertical grid lines
  const headerText = rgbHex(idealTextColorOn(ctx.hex.accent))
  const zebra = rgbHex(mixHex(ctx.hex.background, ctx.hex.accent, 0.06))
  const ruleColor = rgbHex(mixHex(ctx.hex.background, ctx.hex.text, 0.14))
  const tableTop = ctx.cursorY
  const startPage = ctx.page

  for (let r = 0; r < table.rows; r++) {
    ensureSpace(ctx, rowH + 6)

    const yTop = ctx.cursorY
    const yBottom = yTop - rowH
    const rowCells = Array.from({ length: cols }, (_, c) => table.cells?.[r]?.[c] ?? { text: '' })
    const rowHasHeader = rowCells.some((cell) => cell.header)

    // Row background: accent band for header rows, alternating tint otherwise.
    if (rowHasHeader) {
      ctx.page.drawRectangle({ x: ctx.margin, y: yBottom, width: maxW, height: rowH, color: ctx.colors.accent })
    } else if (r % 2 === 1) {
      ctx.page.drawRectangle({ x: ctx.margin, y: yBottom, width: maxW, height: rowH, color: zebra })
    }

    for (let c = 0; c < cols; c++) {
      const cell = rowCells[c]!
      const x = ctx.margin + c * colW
      const isHeader = cell.header || rowHasHeader
      const font = isHeader ? ctx.fonts.bold : ctx.fonts.regular
      const color = cell.header || rowHasHeader ? headerText : ctx.colors.text
      const text = mergeTemplate(String(cell.text ?? ''), ctx.data).replace(/\r?\n/g, ' ')
      const maxTextW = colW - padding * 2
      const measure = (s: string) => ctx.measure(font, size, s)
      const lines = wrapText(text, measure, maxTextW).slice(0, 2)
      // Vertically center the text block within the row.
      const blockH = lines.length * size + (lines.length - 1) * (size * 0.15)
      const firstBaseline = yTop - (rowH - blockH) / 2 - size
      for (let i = 0; i < lines.length; i++) {
        ctx.page.drawText(lines[i]!, {
          x: x + padding,
          y: firstBaseline - i * (size * 1.15),
          size,
          font,
          color
        })
      }
    }

    // Thin separator under each non-header row.
    if (!rowHasHeader) {
      ctx.page.drawLine({
        start: { x: ctx.margin, y: yBottom },
        end: { x: ctx.margin + maxW, y: yBottom },
        thickness: 0.5,
        color: ruleColor
      })
    }
    ctx.cursorY -= rowH
  }

  // Crisp outer frame — only when the table fit on a single page (otherwise a
  // frame spanning the page break would draw at the wrong height).
  if (ctx.page === startPage) {
    ctx.page.drawRectangle({
      x: ctx.margin,
      y: ctx.cursorY,
      width: maxW,
      height: tableTop - ctx.cursorY,
      borderColor: ruleColor,
      borderWidth: 0.75
    })
  }

  ctx.cursorY -= 14
}

async function renderImage(ctx: RendererCtx, img: z.infer<typeof ImageBlockSchema>) {
  if (!String(img.dataUrl || '').startsWith('data:image/')) return
  const maxW = ctx.pageW - ctx.margin * 2
  const { img: embedded, w: iw, h: ih } = await ctx.embedImageFromDataUrl(img.dataUrl)

  let drawW = img.widthPt
  let drawH = img.heightPt
  if (!drawW && !drawH) {
    const scale = Math.min(1, maxW / iw)
    drawW = iw * scale
    drawH = ih * scale
  } else if (drawW && !drawH) {
    drawH = (ih / iw) * drawW
  } else if (!drawW && drawH) {
    drawW = (iw / ih) * drawH
  }
  drawW = Math.min(drawW!, maxW)

  const needed = (drawH ?? 0) + 10
  ensureSpace(ctx, needed)
  const x =
    img.align === 'center'
      ? ctx.margin + (maxW - drawW) / 2
      : img.align === 'right'
        ? ctx.margin + (maxW - drawW)
        : ctx.margin
  const y = ctx.cursorY - (drawH ?? 0)
  ctx.page.drawImage(embedded, {
    x,
    y,
    width: drawW,
    height: drawH,
    opacity: img.opacity ?? 1
  })
  ctx.cursorY = y - 10
}

function renderSection(
  ctx: RendererCtx,
  section: z.infer<typeof SectionSchema>,
  opts?: { paragraphFontSize?: number }
) {
  for (const block of section.blocks) {
    if (block.type === 'heading') renderHeading(ctx, block.level, block.text)
    else if (block.type === 'paragraph') renderParagraph(ctx, block.spans, block.align, opts?.paragraphFontSize)
    else if (block.type === 'image') {
      // caller should use renderSectionAsync
      throw new Error('Image block requires async renderer')
    } else renderTable(ctx, block)
  }
}

async function renderSectionAsync(
  ctx: RendererCtx,
  section: z.infer<typeof SectionSchema>,
  opts?: { paragraphFontSize?: number }
) {
  for (const block of section.blocks) {
    if (block.type === 'heading') renderHeading(ctx, block.level, block.text)
    else if (block.type === 'paragraph') renderParagraph(ctx, block.spans, block.align, opts?.paragraphFontSize)
    else if (block.type === 'image') await renderImage(ctx, block)
    else renderTable(ctx, block)
  }
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = PdfDocSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid PDF config',
      data: { issues: parsed.error.issues }
    })
  }

  const cfg = parsed.data
  const { w: pageW, h: pageH } = pageSizePt(cfg.layout)
  const margin = cfg.layout.marginPt

  const doc = await PDFDocument.create()
  doc.setTitle(mergeTemplate(cfg.title, cfg.data))

  const fontNames = pickStandardFonts(cfg.design.font)
  const fontCache = new Map<string, any>()
  async function embedFontFromDataUrlOrStandard(dataUrl: string | undefined, standard: string) {
    if (!dataUrl) return await doc.embedFont(standard)
    if (fontCache.has(dataUrl)) return fontCache.get(dataUrl)
    const { bytes } = decodeDataUrl(dataUrl)
    const f = await doc.embedFont(bytes, { subset: true } as any)
    fontCache.set(dataUrl, f)
    return f
  }

  const fonts = {
    regular: await embedFontFromDataUrlOrStandard(cfg.design.customFonts?.regular, fontNames.regular),
    bold: await embedFontFromDataUrlOrStandard(cfg.design.customFonts?.bold, fontNames.bold),
    italic: await embedFontFromDataUrlOrStandard(cfg.design.customFonts?.italic, fontNames.italic),
    boldItalic: await embedFontFromDataUrlOrStandard(cfg.design.customFonts?.boldItalic, fontNames.boldItalic)
  }

  const bg = hexToRgb01(cfg.design.backgroundColor)
  const text = hexToRgb01(cfg.design.textColor)
  const heading = hexToRgb01(cfg.design.headingColor)
  const accent = hexToRgb01(cfg.design.accentColor)

  const fontId = new WeakMap<object, number>()
  let fontSeq = 1
  const widthCache = new Map<string, number>()
  const measure = (font: any, size: number, s: string) => {
    if (!s) return 0
    const keyFontObj = font as object
    let id = fontId.get(keyFontObj)
    if (!id) {
      id = fontSeq++
      fontId.set(keyFontObj, id)
    }
    const key = `${id}|${size}|${s}`
    const cached = widthCache.get(key)
    if (cached != null) return cached
    const w = font.widthOfTextAtSize(s, size)
    widthCache.set(key, w)
    return w
  }

  const imageCache = new Map<string, { img: any; w: number; h: number }>()
  async function embedImageFromDataUrl(dataUrl: string) {
    const cached = imageCache.get(dataUrl)
    if (cached) return cached
    const { mime, bytes } = decodeDataUrl(dataUrl)
    const embedded =
      mime === 'image/png'
        ? await doc.embedPng(bytes)
        : mime === 'image/jpeg' || mime === 'image/jpg'
          ? await doc.embedJpg(bytes)
          : null
    if (!embedded) throw new Error('Unsupported image type. Use PNG or JPG.')
    const dims = embedded.scale(1)
    const out = { img: embedded, w: dims.width, h: dims.height }
    imageCache.set(dataUrl, out)
    return out
  }

  const ctx: RendererCtx = {
    pdf: doc,
    pageW,
    pageH,
    margin,
    cursorY: pageH - margin,
    page: null as any,
    data: cfg.data,
    measure,
    embedImageFromDataUrl,
    colors: {
      text: rgb(text.r, text.g, text.b),
      heading: rgb(heading.r, heading.g, heading.b),
      accent: rgb(accent.r, accent.g, accent.b),
      background: rgb(bg.r, bg.g, bg.b)
    },
    hex: {
      text: cfg.design.textColor,
      heading: cfg.design.headingColor,
      accent: cfg.design.accentColor,
      background: cfg.design.backgroundColor
    },
    fonts
  }

  // First page (draw background first)
  ctx.page = addPageWithBackground(ctx)

  // Header — render with larger paragraph font
  await renderSectionAsync(ctx, cfg.header, { paragraphFontSize: 14 })
  const afterHeaderY = ctx.cursorY

  // Header separator
  ctx.page.drawLine({
    start: { x: margin, y: afterHeaderY + 4 },
    end: { x: pageW - margin, y: afterHeaderY + 4 },
    thickness: 1,
    color: ctx.colors.accent
  })
  ctx.cursorY = afterHeaderY - 12

  // Body
  await renderSectionAsync(ctx, cfg.body)

  // Footer — render on every page at the very bottom
  const footerFontSize = 9
  const footerLineH = footerFontSize * 1.4
  const footerBlockCount = cfg.footer.blocks.length || 1
  const footerHeight = footerBlockCount * footerLineH + 14
  const footerTopY = margin + footerHeight

  const allPages = doc.getPages()
  const pageCount = allPages.length
  for (let pageIndex = 0; pageIndex < allPages.length; pageIndex++) {
    const p = allPages[pageIndex]!
    p.drawLine({
      start: { x: margin, y: footerTopY + 6 },
      end: { x: pageW - margin, y: footerTopY + 6 },
      thickness: 0.5,
      color: rgb(0.82, 0.82, 0.85)
    })

    // Render footer content on each page by temporarily swapping ctx.page.
    // Expose {{page}} / {{pages}} tokens for this specific page.
    const savedPage = ctx.page
    const savedY = ctx.cursorY
    const savedData = ctx.data
    ctx.page = p
    ctx.cursorY = footerTopY
    ctx.data = { ...(cfg.data ?? {}), page: pageIndex + 1, pages: pageCount }
    // Footer should never paginate
    for (const block of cfg.footer.blocks) {
      if (!ensureSpace(ctx, footerFontSize * 2, { allowNewPage: false })) break
      if (block.type === 'heading') renderHeading(ctx, block.level, block.text)
      else if (block.type === 'paragraph') renderParagraph(ctx, block.spans, block.align, footerFontSize)
      else if (block.type === 'image') await renderImage(ctx, block)
      else renderTable(ctx, block)
    }
    ctx.page = savedPage
    ctx.cursorY = savedY
    ctx.data = savedData
  }

  const bytes = await doc.save()
  setHeader(event, 'Content-Type', 'application/pdf')
  const mergedTitle = mergeTemplate(cfg.title, cfg.data)
  setHeader(event, 'Content-Disposition', `attachment; filename="${sanitizeFilename(mergedTitle)}.pdf"`)
  return bytes
})

