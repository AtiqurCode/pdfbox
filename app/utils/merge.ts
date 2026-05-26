/** Assign a value into a nested object using a dotted key path (e.g. "client.name"). */
export function setByPath(target: Record<string, any>, path: string, value: unknown): void {
  const keys = path
    .split('.')
    .map((k) => k.trim())
    .filter(Boolean)
  if (keys.length === 0) return
  let cur = target
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i]!
    if (typeof cur[k] !== 'object' || cur[k] === null) cur[k] = {}
    cur = cur[k]
  }
  cur[keys[keys.length - 1]!] = value
}

/** Build a (possibly nested) merge-data object from key/value rows. Dotted keys allowed. */
export function buildMergeData(
  rows: { key: string; value: string }[]
): Record<string, unknown> | undefined {
  const obj: Record<string, any> = {}
  let any = false
  for (const row of rows) {
    const key = row.key.trim()
    if (!key) continue
    setByPath(obj, key, row.value)
    any = true
  }
  return any ? obj : undefined
}
