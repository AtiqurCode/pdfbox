import { describe, it, expect } from 'vitest'
import { PdfDocSchema, mergeTemplate, resolvePath } from '../server/utils/pdfSchema'

function validDoc() {
  return {
    title: 'Test',
    header: { blocks: [] },
    body: { blocks: [{ id: 'p1', type: 'paragraph', spans: [{ text: 'hi' }] }] },
    footer: { blocks: [] },
    design: {
      font: 'Helvetica',
      textColor: '#111827',
      backgroundColor: '#ffffff',
      accentColor: '#2563eb',
      headingColor: '#111827'
    },
    layout: { pageSize: 'A4', orientation: 'portrait', marginPt: 54 }
  }
}

describe('PdfDocSchema', () => {
  it('accepts a valid document', () => {
    expect(PdfDocSchema.safeParse(validDoc()).success).toBe(true)
  })

  it('rejects an empty title', () => {
    const doc = validDoc()
    doc.title = ''
    expect(PdfDocSchema.safeParse(doc).success).toBe(false)
  })

  it('rejects a malformed color', () => {
    const doc = validDoc()
    doc.design.textColor = 'black'
    expect(PdfDocSchema.safeParse(doc).success).toBe(false)
  })

  it('rejects a margin outside 12..144', () => {
    const doc = validDoc()
    doc.layout.marginPt = 5
    expect(PdfDocSchema.safeParse(doc).success).toBe(false)
  })

  it('rejects an unknown block type', () => {
    const doc = validDoc() as any
    doc.body.blocks = [{ id: 'x', type: 'video', spans: [] }]
    expect(PdfDocSchema.safeParse(doc).success).toBe(false)
  })
})

describe('resolvePath', () => {
  const data = { client: { name: 'Acme' }, items: [{ sku: 'A1' }], total: 0 }
  it('resolves nested paths', () => {
    expect(resolvePath(data, 'client.name')).toBe('Acme')
  })
  it('resolves array indexes', () => {
    expect(resolvePath(data, 'items[0].sku')).toBe('A1')
  })
  it('returns undefined for missing paths', () => {
    expect(resolvePath(data, 'client.email')).toBeUndefined()
    expect(resolvePath(data, 'nope.deep')).toBeUndefined()
  })
  it('resolves falsy-but-present values', () => {
    expect(resolvePath(data, 'total')).toBe(0)
  })
})

describe('mergeTemplate', () => {
  const data = { client: { name: 'Acme' }, count: 3, paid: true }

  it('replaces tokens from nested data', () => {
    expect(mergeTemplate('Hi {{client.name}}', data)).toBe('Hi Acme')
  })

  it('stringifies numbers and booleans', () => {
    expect(mergeTemplate('{{count}} / {{paid}}', data)).toBe('3 / true')
  })

  it('replaces missing tokens with empty string', () => {
    expect(mergeTemplate('x={{client.email}}', data)).toBe('x=')
  })

  it('returns input unchanged when no data is provided', () => {
    expect(mergeTemplate('Page {{page}}', undefined)).toBe('Page {{page}}')
  })

  it('supports page-number tokens (as used by the footer renderer)', () => {
    expect(mergeTemplate('Page {{page}} of {{pages}}', { page: 2, pages: 5 })).toBe('Page 2 of 5')
  })
})
