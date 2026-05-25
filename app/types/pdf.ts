export type PageSizePreset = 'A4' | 'A5' | 'CUSTOM'
export type PageOrientation = 'portrait' | 'landscape'

export type PdfFontPreset = 'Helvetica' | 'TimesRoman' | 'Courier'

export type PdfColorHex = `#${string}`

export type DataUrl = `data:${string}`

export type RichTextSpan = {
  text: string
  bold?: boolean
  italic?: boolean
  color?: PdfColorHex
}

export type ParagraphBlock = {
  id: string
  type: 'paragraph'
  spans: RichTextSpan[]
  align?: 'left' | 'center' | 'right'
}

export type HeadingBlock = {
  id: string
  type: 'heading'
  level: 1 | 2 | 3
  text: string
}

export type TableCell = {
  text: string
  header?: boolean
}

export type TableBlock = {
  id: string
  type: 'table'
  columns: number
  rows: number
  cells: TableCell[][]
}

export type ImageBlock = {
  id: string
  type: 'image'
  dataUrl: DataUrl
  /** If omitted, we auto-fit to content width with preserved aspect ratio. */
  widthPt?: number
  /** If omitted, we auto-fit to content width with preserved aspect ratio. */
  heightPt?: number
  align?: 'left' | 'center' | 'right'
  /** If set, we draw it with this opacity. 0..1 */
  opacity?: number
}

export type PdfBlock = ParagraphBlock | HeadingBlock | TableBlock | ImageBlock

export type PdfSection = {
  blocks: PdfBlock[]
}

export type PdfDesign = {
  font: PdfFontPreset
  /**
   * Optional custom font uploads (TTF/OTF) as base64 data URLs.
   * If provided, they override the preset fonts for the matching style.
   */
  customFonts?: {
    regular?: DataUrl
    bold?: DataUrl
    italic?: DataUrl
    boldItalic?: DataUrl
  }
  textColor: PdfColorHex
  backgroundColor: PdfColorHex
  accentColor: PdfColorHex
  headingColor: PdfColorHex
}

export type PdfLayout = {
  pageSize: PageSizePreset
  customWidthPt?: number
  customHeightPt?: number
  orientation: PageOrientation
  marginPt: number
}

export type PdfDocumentConfig = {
  title: string
  /**
   * Optional merge data for `{{path.to.value}}` replacements.
   * Only used server-side during generation.
   */
  data?: Record<string, unknown>
  header: PdfSection
  body: PdfSection
  footer: PdfSection
  design: PdfDesign
  layout: PdfLayout
}

