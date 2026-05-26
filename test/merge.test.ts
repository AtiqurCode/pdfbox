import { describe, it, expect } from 'vitest'
import { setByPath, buildMergeData } from '../app/utils/merge'

describe('setByPath', () => {
  it('sets a top-level key', () => {
    const o: Record<string, any> = {}
    setByPath(o, 'name', 'Ann')
    expect(o).toEqual({ name: 'Ann' })
  })

  it('builds nested objects from a dotted path', () => {
    const o: Record<string, any> = {}
    setByPath(o, 'client.contact.email', 'a@b.com')
    expect(o).toEqual({ client: { contact: { email: 'a@b.com' } } })
  })

  it('merges into existing branches', () => {
    const o: Record<string, any> = { client: { name: 'Ann' } }
    setByPath(o, 'client.city', 'NYC')
    expect(o).toEqual({ client: { name: 'Ann', city: 'NYC' } })
  })

  it('ignores empty paths', () => {
    const o: Record<string, any> = {}
    setByPath(o, '   ', 'x')
    expect(o).toEqual({})
  })
})

describe('buildMergeData', () => {
  it('returns undefined when there are no usable rows', () => {
    expect(buildMergeData([])).toBeUndefined()
    expect(buildMergeData([{ key: '', value: 'x' }])).toBeUndefined()
  })

  it('builds a nested object and skips blank keys', () => {
    const data = buildMergeData([
      { key: 'client.name', value: 'Acme' },
      { key: '', value: 'ignored' },
      { key: 'total', value: '99' }
    ])
    expect(data).toEqual({ client: { name: 'Acme' }, total: '99' })
  })
})
