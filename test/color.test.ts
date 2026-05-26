import { describe, it, expect } from 'vitest'
import { contrastRatio, isHexColor, relativeLuminance } from '../app/utils/color'

describe('isHexColor', () => {
  it('accepts #RRGGBB and rejects everything else', () => {
    expect(isHexColor('#ffffff')).toBe(true)
    expect(isHexColor('#1e3a5f')).toBe(true)
    expect(isHexColor('#fff')).toBe(false)
    expect(isHexColor('red')).toBe(false)
    expect(isHexColor('#ggffff')).toBe(false)
  })
})

describe('relativeLuminance', () => {
  it('is 0 for black and 1 for white', () => {
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5)
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5)
  })
})

describe('contrastRatio', () => {
  it('is 21 for black on white', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBe(21)
  })

  it('is 1 for identical colors', () => {
    expect(contrastRatio('#123456', '#123456')).toBe(1)
  })

  it('is symmetric regardless of order', () => {
    expect(contrastRatio('#111827', '#ffffff')).toBe(contrastRatio('#ffffff', '#111827'))
  })

  it('flags a low-contrast pair as below 4.5', () => {
    const ratio = contrastRatio('#cccccc', '#ffffff')
    expect(ratio).not.toBeNull()
    expect(ratio!).toBeLessThan(4.5)
  })

  it('returns null for invalid colors', () => {
    expect(contrastRatio('nope', '#ffffff')).toBeNull()
  })
})
