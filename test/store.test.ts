// @vitest-environment nuxt
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePdfDesignerStore, TEMPLATES } from '../app/stores/pdfDesigner'

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('templates', () => {
  it('exposes the four templates', () => {
    expect(Object.keys(TEMPLATES).sort()).toEqual(['blank', 'invoice', 'letter', 'report'])
  })

  it('applies a template into the active config', () => {
    const store = usePdfDesignerStore()
    store.applyTemplate('invoice')
    expect(store.config.title).toBe('Invoice INV-001')
    expect(store.config.body.blocks.some((b) => b.type === 'table')).toBe(true)
  })

  it('blank template still has content so it passes validation', () => {
    const store = usePdfDesignerStore()
    store.applyTemplate('blank')
    expect(store.config.body.blocks.length).toBeGreaterThan(0)
  })
})

describe('block operations', () => {
  it('inserts, duplicates and removes blocks', () => {
    const store = usePdfDesignerStore()
    store.applyTemplate('blank')
    const start = store.config.body.blocks.length

    store.insertBlock('body', 0, { id: 'x', type: 'paragraph', spans: [{ text: 'new' }] })
    expect(store.config.body.blocks[0]!.id).toBe('x')
    expect(store.config.body.blocks.length).toBe(start + 1)

    store.duplicateBlock('body', 'x')
    expect(store.config.body.blocks.length).toBe(start + 2)
    // the duplicate gets a fresh id
    expect(store.config.body.blocks.filter((b) => b.id === 'x')).toHaveLength(1)

    store.removeBlock('body', 'x')
    expect(store.config.body.blocks.some((b) => b.id === 'x')).toBe(false)
  })
})

describe('multi-document management', () => {
  it('creates, switches, duplicates and deletes documents', () => {
    const store = usePdfDesignerStore()
    const firstId = store.currentDocId
    expect(store.documentList).toHaveLength(1)

    const invoiceId = store.newDocument('invoice')
    expect(store.currentDocId).toBe(invoiceId)
    expect(store.documentList).toHaveLength(2)
    expect(store.config.title).toBe('Invoice INV-001')

    store.switchDocument(firstId)
    expect(store.currentDocId).toBe(firstId)

    const copyId = store.duplicateDocument()
    expect(store.documentList).toHaveLength(3)
    expect(store.config.title).toContain('(copy)')

    store.deleteDocument(copyId)
    expect(store.documentList).toHaveLength(2)
    expect(store.documentList.some((d) => d.id === copyId)).toBe(false)
  })

  it('always keeps at least one document', () => {
    const store = usePdfDesignerStore()
    store.deleteDocument(store.currentDocId)
    expect(store.documentList.length).toBeGreaterThanOrEqual(1)
  })
})

describe('undo / redo', () => {
  it('restores the previous state after an edit', async () => {
    const store = usePdfDesignerStore()
    store.applyTemplate('blank')
    await delay(500) // let the debounced history snapshot commit

    const original = store.config.title
    store.config.title = 'Edited title'
    await delay(500)

    expect(store.canUndo).toBe(true)
    store.undo()
    expect(store.config.title).toBe(original)

    store.redo()
    expect(store.config.title).toBe('Edited title')
  })
})
