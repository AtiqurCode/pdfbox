/**
 * Minimal CSV parser. Handles quoted fields, embedded commas/newlines, and
 * `""` escapes. The first non-empty row is treated as the header.
 */
export function parseCsv(text: string): { columns: string[]; rows: Record<string, string>[] } {
  const records: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false
  const src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else inQuotes = false
      } else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n') {
      row.push(field)
      records.push(row)
      row = []
      field = ''
    } else field += c
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    records.push(row)
  }

  const nonEmpty = records.filter((r) => r.some((v) => v.trim().length > 0))
  if (nonEmpty.length === 0) return { columns: [], rows: [] }
  const columns = nonEmpty[0]!.map((h) => h.trim())
  const rows = nonEmpty.slice(1).map((r) => {
    const obj: Record<string, string> = {}
    columns.forEach((col, idx) => {
      obj[col] = (r[idx] ?? '').trim()
    })
    return obj
  })
  return { columns, rows }
}
