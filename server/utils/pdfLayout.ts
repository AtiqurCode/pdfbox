import { Buffer } from 'node:buffer'

// ─────────────────────────────────────────────────────────────────────────────
// Pure layout / color helpers used by the PDF renderer.
// Kept free of pdf-lib so they can be unit-tested in a plain node environment.
// ─────────────────────────────────────────────────────────────────────────────

export type LayoutLike = {
  pageSize: 'A4' | 'A5' | 'CUSTOM'
  customWidthPt?: number
  customHeightPt?: number
  orientation: 'portrait' | 'landscape'
  marginPt: number
}

/** Parse a #RRGGBB color into 0..1 RGB channels. Invalid input falls back to black. */
export function hexToRgb01(hex: string): { r: number; g: number; b: number } {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex)
  if (!m) return { r: 0, g: 0, b: 0 }
  const n = parseInt(m[1]!, 16)
  return {
    r: ((n >> 16) & 0xff) / 255,
    g: ((n >> 8) & 0xff) / 255,
    b: (n & 0xff) / 255
  }
}

/** WCAG relative luminance (0..1) for a #RRGGBB color. */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb01(hex)
  const lin = [r, g, b].map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!
}

/**
 * Pick a legible text color (near-black or white) to sit on top of `bgHex`.
 * Used so header cells stay readable whatever accent the user chooses.
 */
export function idealTextColorOn(bgHex: string): string {
  return relativeLuminance(bgHex) > 0.5 ? '#111827' : '#ffffff'
}

/** Mix two #RRGGBB colors. `t` is the weight of `b` (0 → all a, 1 → all b). */
export function mixHex(a: string, b: string, t: number): string {
  const ca = hexToRgb01(a)
  const cb = hexToRgb01(b)
  const k = Math.max(0, Math.min(1, t))
  const ch = (x: number, y: number) =>
    Math.round((x * (1 - k) + y * k) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${ch(ca.r, cb.r)}${ch(ca.g, cb.g)}${ch(ca.b, cb.b)}`
}

/** Page dimensions in PDF points (72pt = 1in), honoring orientation. */
export function pageSizePt(layout: LayoutLike): { w: number; h: number } {
  const A4 = { w: 595.28, h: 841.89 }
  const A5 = { w: 419.53, h: 595.28 }
  const raw =
    layout.pageSize === 'A4'
      ? A4
      : layout.pageSize === 'A5'
        ? A5
        : {
            w: Math.max(72, layout.customWidthPt ?? A4.w),
            h: Math.max(72, layout.customHeightPt ?? A4.h)
          }
  if (layout.orientation === 'landscape') return { w: raw.h, h: raw.w }
  return raw
}

/**
 * Greedy word-wrap. Splits on whitespace; a single token wider than `maxWidth`
 * is hard-broken character by character so it never overflows the column.
 */
export function wrapText(text: string, measure: (s: string) => number, maxWidth: number): string[] {
  const words = text.split(/(\s+)/).filter((w) => w.length > 0)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const next = line.length === 0 ? w : line + w
    if (measure(next) <= maxWidth) {
      line = next
      continue
    }
    if (line.length > 0) lines.push(line)
    if (measure(w) > maxWidth) {
      let buf = ''
      for (const ch of w) {
        const t = buf + ch
        if (measure(t) <= maxWidth) buf = t
        else {
          if (buf) lines.push(buf)
          buf = ch
        }
      }
      line = buf
    } else {
      line = w
    }
  }
  if (line.length > 0) lines.push(line)
  return lines
}

/** Decode a base64 `data:` URL into its MIME type and bytes. */
export function decodeDataUrl(dataUrl: string): { mime: string; bytes: Uint8Array } {
  const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl)
  if (!m) throw new Error('Invalid data URL; expected base64 data: URL.')
  const mime = m[1]!
  const b64 = m[2]!
  const buf = Buffer.from(b64, 'base64')
  return { mime, bytes: new Uint8Array(buf) }
}

/** Make a string safe to use as a download filename (no path/illegal chars). */
export function sanitizeFilename(name: string): string {
  const base = name.trim().length > 0 ? name.trim() : 'document'
  return base.replaceAll(/[^\w\-.]+/g, '_')
}
