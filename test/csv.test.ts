import { describe, it, expect } from 'vitest'
import { parseCsv } from '../app/utils/csv'

describe('parseCsv', () => {
  it('parses a simple table with header row', () => {
    const { columns, rows } = parseCsv('name,city\nAnn,NYC\nBob,LA')
    expect(columns).toEqual(['name', 'city'])
    expect(rows).toEqual([
      { name: 'Ann', city: 'NYC' },
      { name: 'Bob', city: 'LA' }
    ])
  })

  it('handles quoted fields with embedded commas', () => {
    const { rows } = parseCsv('name,note\n"Doe, Jane","hi, there"')
    expect(rows[0]).toEqual({ name: 'Doe, Jane', note: 'hi, there' })
  })

  it('handles escaped double quotes ("")', () => {
    const { rows } = parseCsv('q\n"She said ""hi"""')
    expect(rows[0]!.q).toBe('She said "hi"')
  })

  it('handles newlines inside quoted fields', () => {
    const { rows } = parseCsv('addr\n"line1\nline2"')
    expect(rows[0]!.addr).toBe('line1\nline2')
  })

  it('trims a trailing newline without producing an empty row', () => {
    const { rows } = parseCsv('a\n1\n')
    expect(rows).toHaveLength(1)
  })

  it('returns empty for blank input', () => {
    expect(parseCsv('')).toEqual({ columns: [], rows: [] })
    expect(parseCsv('\n\n')).toEqual({ columns: [], rows: [] })
  })

  it('fills missing trailing cells with empty strings', () => {
    const { rows } = parseCsv('a,b,c\n1,2')
    expect(rows[0]).toEqual({ a: '1', b: '2', c: '' })
  })
})
