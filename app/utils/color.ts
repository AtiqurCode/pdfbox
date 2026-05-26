export const isHexColor = (v: string): boolean => /^#[0-9a-fA-F]{6}$/.test(v)

/** WCAG relative luminance for a #RRGGBB color (0..1). */
export function relativeLuminance(hex: string): number {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex)
  if (!m) return 1
  const n = parseInt(m[1]!, 16)
  const srgb = [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff].map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * srgb[0]! + 0.7152 * srgb[1]! + 0.0722 * srgb[2]!
}

/**
 * WCAG contrast ratio between two #RRGGBB colors, rounded to 2 decimals.
 * Returns null if either color is not a valid hex.
 */
export function contrastRatio(a: string, b: string): number | null {
  if (!isHexColor(a) || !isHexColor(b)) return null
  const L1 = relativeLuminance(a)
  const L2 = relativeLuminance(b)
  const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
  return Math.round(ratio * 100) / 100
}
