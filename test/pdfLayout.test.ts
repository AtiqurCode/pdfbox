import { describe, it, expect } from 'vitest'
import {
  hexToRgb01,
  relativeLuminance,
  idealTextColorOn,
  mixHex,
  pageSizePt,
  wrapText,
  decodeDataUrl,
  sanitizeFilename
} from '../server/utils/pdfLayout'

describe('hexToRgb01', () => {
  it('parses #RRGGBB into 0..1 channels', () => {
    expect(hexToRgb01('#ffffff')).toEqual({ r: 1, g: 1, b: 1 })
    expect(hexToRgb01('#000000')).toEqual({ r: 0, g: 0, b: 0 })
    expect(hexToRgb01('#2563eb')).toEqual({ r: 0x25 / 255, g: 0x63 / 255, b: 0xeb / 255 })
  })

  it('falls back to black for invalid input', () => {
    expect(hexToRgb01('nope')).toEqual({ r: 0, g: 0, b: 0 })
  })
})

describe('relativeLuminance', () => {
  it('is 0 for black and 1 for white', () => {
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5)
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5)
  })
})

describe('idealTextColorOn', () => {
  it('returns white on dark backgrounds and dark on light ones', () => {
    expect(idealTextColorOn('#111827')).toBe('#ffffff')
    expect(idealTextColorOn('#2563eb')).toBe('#ffffff')
    expect(idealTextColorOn('#ffffff')).toBe('#111827')
    expect(idealTextColorOn('#f1f5f9')).toBe('#111827')
  })
})

describe('mixHex', () => {
  it('returns the endpoints at t=0 and t=1', () => {
    expect(mixHex('#000000', '#ffffff', 0)).toBe('#000000')
    expect(mixHex('#000000', '#ffffff', 1)).toBe('#ffffff')
  })

  it('blends toward the second color', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080')
  })

  it('clamps t outside 0..1', () => {
    expect(mixHex('#000000', '#ffffff', 2)).toBe('#ffffff')
    expect(mixHex('#000000', '#ffffff', -1)).toBe('#000000')
  })
})

describe('pageSizePt', () => {
  const base = { marginPt: 54 } as const

  it('returns A4 portrait dimensions', () => {
    const { w, h } = pageSizePt({ ...base, pageSize: 'A4', orientation: 'portrait' })
    expect(w).toBeCloseTo(595.28)
    expect(h).toBeCloseTo(841.89)
  })

  it('swaps width/height in landscape', () => {
    const { w, h } = pageSizePt({ ...base, pageSize: 'A4', orientation: 'landscape' })
    expect(w).toBeCloseTo(841.89)
    expect(h).toBeCloseTo(595.28)
  })

  it('honors custom dimensions with a 72pt floor', () => {
    const { w, h } = pageSizePt({
      ...base,
      pageSize: 'CUSTOM',
      orientation: 'portrait',
      customWidthPt: 10,
      customHeightPt: 500
    })
    expect(w).toBe(72)
    expect(h).toBe(500)
  })
})

describe('wrapText', () => {
  // 10pt-per-character monospace stand-in keeps the math obvious.
  const measure = (s: string) => s.length * 10

  it('wraps on word boundaries, keeping as many words as fit', () => {
    // 'one two ' = 80pt fits; adding 'three' would overflow.
    expect(wrapText('one two three', measure, 80)).toEqual(['one two ', 'three'])
  })

  it('puts each word on its own line when only one fits', () => {
    expect(wrapText('one two three', measure, 60)).toEqual(['one ', 'two ', 'three'])
  })

  it('hard-splits a token wider than the line', () => {
    const lines = wrapText('abcdefgh', measure, 30)
    expect(lines.every((l) => l.length <= 3)).toBe(true)
    expect(lines.join('')).toBe('abcdefgh')
  })

  it('returns an empty array for empty input', () => {
    expect(wrapText('', measure, 100)).toEqual([])
  })
})

describe('decodeDataUrl', () => {
  it('decodes a base64 data URL', () => {
    const { mime, bytes } = decodeDataUrl('data:text/plain;base64,aGk=')
    expect(mime).toBe('text/plain')
    expect(new TextDecoder().decode(bytes)).toBe('hi')
  })

  it('throws on a non-base64 data URL', () => {
    expect(() => decodeDataUrl('not-a-data-url')).toThrow()
  })
})

describe('sanitizeFilename', () => {
  it('replaces illegal characters with underscores', () => {
    expect(sanitizeFilename('Invoice #001: Acme/Corp')).toBe('Invoice_001_Acme_Corp')
  })

  it('keeps word chars, dashes and dots', () => {
    expect(sanitizeFilename('report-2026.final')).toBe('report-2026.final')
  })

  it('falls back to "document" for blank input', () => {
    expect(sanitizeFilename('   ')).toBe('document')
  })
})
