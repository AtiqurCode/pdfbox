import { defineStore } from 'pinia'
import type { PdfDocumentConfig, PdfSection, PdfBlock, PdfDesign, PdfLayout, TableBlock } from '~/types/pdf'
import { newId } from '~/utils/id'

const DOCS_KEY = 'pdfbox:docs'
const CURRENT_KEY = 'pdfbox:currentDocId'
const LEGACY_KEY = 'pdfbox:config'

export type StoredDoc = { id: string; updatedAt: number; config: PdfDocumentConfig }

function defaultSection(): PdfSection {
  return {
    blocks: [
      {
        id: newId('h'),
        type: 'heading',
        level: 2,
        text: 'Section title'
      },
      {
        id: newId('p'),
        type: 'paragraph',
        spans: [{ text: 'Write something here. Use the inline editor to add bold/italic + colors.' }]
      }
    ]
  }
}

function defaultTable(): TableBlock {
  return {
    id: newId('t'),
    type: 'table',
    columns: 3,
    rows: 3,
    cells: [
      [
        { text: 'Header 1', header: true },
        { text: 'Header 2', header: true },
        { text: 'Header 3', header: true }
      ],
      [{ text: 'Row 1 Col 1' }, { text: 'Row 1 Col 2' }, { text: 'Row 1 Col 3' }],
      [{ text: 'Row 2 Col 1' }, { text: 'Row 2 Col 2' }, { text: 'Row 2 Col 3' }]
    ]
  }
}

function defaultDesign(): PdfDesign {
  return {
    font: 'Helvetica',
    textColor: '#111827',
    backgroundColor: '#ffffff',
    accentColor: '#2563eb',
    headingColor: '#111827'
  }
}

function defaultLayout(): PdfLayout {
  return {
    pageSize: 'A4',
    orientation: 'portrait',
    marginPt: 54
  }
}

function defaultConfig(): PdfDocumentConfig {
  return {
    title: 'My Document',
    header: {
      blocks: [
        {
          id: newId('p'),
          type: 'paragraph',
          align: 'center',
          spans: [{ text: 'Company Name', bold: true }]
        }
      ]
    },
    body: defaultSection(),
    footer: {
      blocks: [
        {
          id: newId('p'),
          type: 'paragraph',
          align: 'center',
          spans: [{ text: 'Confidential · Generated with PDFBox', color: '#6b7280' }]
        }
      ]
    },
    design: defaultDesign(),
    layout: defaultLayout()
  }
}

function makeDoc(config: PdfDocumentConfig): StoredDoc {
  return { id: newId('doc'), updatedAt: Date.now(), config }
}

/** Load the document list, migrating a legacy single-config save if present. */
function loadDocs(): { docs: StoredDoc[]; currentId: string } {
  if (import.meta.server) {
    const d = makeDoc(defaultConfig())
    return { docs: [d], currentId: d.id }
  }
  try {
    const raw = localStorage.getItem(DOCS_KEY)
    if (raw) {
      const docs = JSON.parse(raw) as StoredDoc[]
      if (Array.isArray(docs) && docs.length > 0) {
        const stored = localStorage.getItem(CURRENT_KEY)
        const currentId = stored && docs.some((d) => d.id === stored) ? stored : docs[0]!.id
        return { docs, currentId }
      }
    }
    // Migrate legacy single-document save (pdfbox:config) into the new list.
    const legacy = localStorage.getItem(LEGACY_KEY)
    const cfg = legacy ? (JSON.parse(legacy) as PdfDocumentConfig) : defaultConfig()
    const d = makeDoc(cfg)
    return { docs: [d], currentId: d.id }
  } catch {
    const d = makeDoc(defaultConfig())
    return { docs: [d], currentId: d.id }
  }
}

export const TEMPLATES: Record<string, { label: string; build: () => PdfDocumentConfig }> = {
  blank: {
    label: 'Blank',
    build: () => ({
      title: 'Untitled',
      header: { blocks: [] },
      body: {
        blocks: [
          { id: newId('h'), type: 'heading', level: 1, text: 'Untitled document' },
          { id: newId('p'), type: 'paragraph', spans: [{ text: 'Start writing here…' }] }
        ]
      },
      footer: { blocks: [] },
      design: defaultDesign(),
      layout: defaultLayout()
    })
  },
  invoice: {
    label: 'Invoice',
    build: () => ({
      title: 'Invoice #001',
      header: {
        blocks: [
          { id: newId('p'), type: 'paragraph', align: 'left', spans: [{ text: 'Your Company Ltd.', bold: true }] },
          { id: newId('p'), type: 'paragraph', align: 'left', spans: [{ text: '123 Business Ave · City · Country' }] }
        ]
      },
      body: {
        blocks: [
          { id: newId('h'), type: 'heading', level: 1, text: 'Invoice #001' },
          { id: newId('p'), type: 'paragraph', spans: [{ text: 'Bill to: Client Name\nDate: 2026-01-15\nDue: 2026-02-15' }] },
          {
            id: newId('t'), type: 'table', columns: 4, rows: 4,
            cells: [
              [{ text: 'Item', header: true }, { text: 'Qty', header: true }, { text: 'Price', header: true }, { text: 'Total', header: true }],
              [{ text: 'Web Design' }, { text: '1' }, { text: '$2,000' }, { text: '$2,000' }],
              [{ text: 'Development' }, { text: '40 hrs' }, { text: '$100/hr' }, { text: '$4,000' }],
              [{ text: '' }, { text: '' }, { text: 'Total', header: true }, { text: '$6,000', header: true }]
            ]
          },
          { id: newId('p'), type: 'paragraph', spans: [{ text: 'Payment terms: Net 30. Thank you for your business.' }] }
        ]
      },
      footer: {
        blocks: [
          { id: newId('p'), type: 'paragraph', align: 'center', spans: [{ text: 'Your Company Ltd. · hello@company.com', color: '#6b7280' }] }
        ]
      },
      design: { font: 'Helvetica', textColor: '#111827', backgroundColor: '#ffffff', accentColor: '#2563eb', headingColor: '#1e3a5f' },
      layout: defaultLayout()
    })
  },
  report: {
    label: 'Report',
    build: () => ({
      title: 'Quarterly Report',
      header: {
        blocks: [
          { id: newId('p'), type: 'paragraph', align: 'center', spans: [{ text: 'Acme Corp — Quarterly Report', bold: true }] }
        ]
      },
      body: {
        blocks: [
          { id: newId('h'), type: 'heading', level: 1, text: 'Q1 2026 Summary' },
          { id: newId('p'), type: 'paragraph', spans: [{ text: 'This report covers the key metrics and accomplishments for Q1 2026. Overall performance exceeded targets by 12%.' }] },
          { id: newId('h'), type: 'heading', level: 2, text: 'Key Metrics' },
          {
            id: newId('t'), type: 'table', columns: 3, rows: 4,
            cells: [
              [{ text: 'Metric', header: true }, { text: 'Target', header: true }, { text: 'Actual', header: true }],
              [{ text: 'Revenue' }, { text: '$1.2M' }, { text: '$1.35M' }],
              [{ text: 'New Customers' }, { text: '150' }, { text: '168' }],
              [{ text: 'Retention' }, { text: '92%' }, { text: '95%' }]
            ]
          },
          { id: newId('h'), type: 'heading', level: 2, text: 'Next Steps' },
          { id: newId('p'), type: 'paragraph', spans: [{ text: 'Focus areas for Q2 include expanding the sales team, launching the new product line, and improving onboarding NPS scores.' }] }
        ]
      },
      footer: {
        blocks: [
          { id: newId('p'), type: 'paragraph', align: 'center', spans: [{ text: 'Confidential — Acme Corp', color: '#6b7280' }] }
        ]
      },
      design: { font: 'Helvetica', textColor: '#111827', backgroundColor: '#ffffff', accentColor: '#0f766e', headingColor: '#0f766e' },
      layout: defaultLayout()
    })
  },
  letter: {
    label: 'Letter',
    build: () => ({
      title: 'Business Letter',
      header: {
        blocks: [
          { id: newId('p'), type: 'paragraph', align: 'left', spans: [{ text: 'Jane Doe', bold: true }] },
          { id: newId('p'), type: 'paragraph', align: 'left', spans: [{ text: '456 Elm Street · Springfield · IL 62701' }] }
        ]
      },
      body: {
        blocks: [
          { id: newId('p'), type: 'paragraph', spans: [{ text: 'April 14, 2026' }] },
          { id: newId('p'), type: 'paragraph', spans: [{ text: 'Dear Mr. Smith,' }] },
          { id: newId('p'), type: 'paragraph', spans: [{ text: 'I am writing to follow up on our recent conversation regarding the partnership opportunity. We are very excited about the potential collaboration and would like to schedule a meeting to discuss the next steps.' }] },
          { id: newId('p'), type: 'paragraph', spans: [{ text: 'Please let me know your availability for next week. I look forward to hearing from you.' }] },
          { id: newId('p'), type: 'paragraph', spans: [{ text: 'Sincerely,' }] },
          { id: newId('p'), type: 'paragraph', spans: [{ text: 'Jane Doe', bold: true }] }
        ]
      },
      footer: { blocks: [] },
      design: { font: 'TimesRoman', textColor: '#111827', backgroundColor: '#ffffff', accentColor: '#6b7280', headingColor: '#111827' },
      layout: defaultLayout()
    })
  }
}

type SectionName = 'header' | 'body' | 'footer'

const MAX_HISTORY = 50

function cloneConfig(c: PdfDocumentConfig): PdfDocumentConfig {
  return JSON.parse(JSON.stringify(c))
}

export const usePdfDesignerStore = defineStore('pdfDesigner', () => {
  // ── Documents ────────────────────────────────────────────────────────────
  const loaded = loadDocs()
  const docs = ref<StoredDoc[]>(loaded.docs)
  const currentDocId = ref<string>(loaded.currentId)
  const config = ref<PdfDocumentConfig>(
    cloneConfig(docs.value.find((d) => d.id === loaded.currentId)!.config)
  )

  /** Lightweight list for the document switcher UI (newest first). */
  const documentList = computed(() =>
    docs.value
      .map((d) => ({ id: d.id, title: d.config.title || 'Untitled', updatedAt: d.updatedAt }))
      .sort((a, b) => b.updatedAt - a.updatedAt)
  )

  function persistDocs() {
    if (!import.meta.client) return
    try {
      localStorage.setItem(DOCS_KEY, JSON.stringify(docs.value))
      localStorage.setItem(CURRENT_KEY, currentDocId.value)
    } catch {
      /* quota exceeded — ignore */
    }
  }

  /** Copy the working config back into the active document entry. */
  function syncCurrent() {
    const d = docs.value.find((x) => x.id === currentDocId.value)
    if (!d) return
    d.config = cloneConfig(toRaw(config.value))
    d.updatedAt = Date.now()
  }

  // ── Undo / redo ────────────────────────────────────────────────────────────
  // We snapshot the whole config as JSON so every mutation (title, theme,
  // layout, blocks) is covered by one mechanism. A debounced deep watch
  // collapses rapid edits (e.g. typing) into a single history entry.
  const past = ref<string[]>([])
  const future = ref<string[]>([])
  let lastSnapshot = JSON.stringify(config.value)
  let applyingHistory = false

  const canUndo = computed(() => past.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)

  function commitHistory() {
    const snapshot = JSON.stringify(config.value)
    if (snapshot === lastSnapshot) return
    past.value.push(lastSnapshot)
    if (past.value.length > MAX_HISTORY) past.value.shift()
    future.value = []
    lastSnapshot = snapshot
  }

  function applySnapshot(snapshot: string) {
    applyingHistory = true
    config.value = JSON.parse(snapshot)
    lastSnapshot = snapshot
    nextTick(() => {
      applyingHistory = false
    })
  }

  function undo() {
    if (!canUndo.value) return
    future.value.push(lastSnapshot)
    applySnapshot(past.value.pop()!)
  }

  function redo() {
    if (!canRedo.value) return
    past.value.push(lastSnapshot)
    applySnapshot(future.value.pop()!)
  }

  /** Clear history — called when the active document changes. */
  function resetHistory() {
    past.value = []
    future.value = []
    lastSnapshot = JSON.stringify(config.value)
  }

  if (import.meta.client) {
    let persistT: number | null = null
    let historyT: number | null = null
    watch(
      config,
      () => {
        // Persist into the active document (debounced)
        if (persistT) window.clearTimeout(persistT)
        persistT = window.setTimeout(() => {
          syncCurrent()
          persistDocs()
        }, 500)

        // Snapshot into history (debounced so typing doesn't flood the stack)
        if (applyingHistory) return
        if (historyT) window.clearTimeout(historyT)
        historyT = window.setTimeout(commitHistory, 400)
      },
      { deep: true }
    )
  }

  function addBlock(section: SectionName, block: PdfBlock) {
    config.value[section].blocks.push(block)
  }

  function insertBlock(section: SectionName, index: number, block: PdfBlock) {
    const blocks = config.value[section].blocks
    const at = Math.max(0, Math.min(index, blocks.length))
    blocks.splice(at, 0, block)
  }

  function removeBlock(section: SectionName, id: string) {
    const blocks = config.value[section].blocks
    const idx = blocks.findIndex((b) => b.id === id)
    if (idx >= 0) blocks.splice(idx, 1)
  }

  function duplicateBlock(section: SectionName, id: string) {
    const blocks = config.value[section].blocks
    const idx = blocks.findIndex((b) => b.id === id)
    if (idx < 0) return
    const copy = JSON.parse(JSON.stringify(blocks[idx])) as PdfBlock
    copy.id = newId(copy.type[0] ?? 'b')
    blocks.splice(idx + 1, 0, copy)
  }

  function addDefaultTable(section: SectionName) {
    addBlock(section, defaultTable())
  }

  function applyTemplate(key: string) {
    const tpl = TEMPLATES[key]
    if (!tpl) return
    config.value = tpl.build()
  }

  function resetToDefault() {
    config.value = defaultConfig()
  }

  // ── Document actions ──────────────────────────────────────────────────────
  function loadConfigInto(config2: PdfDocumentConfig) {
    config.value = cloneConfig(config2)
    resetHistory()
  }

  function switchDocument(id: string) {
    if (id === currentDocId.value) return
    syncCurrent()
    const target = docs.value.find((d) => d.id === id)
    if (!target) return
    currentDocId.value = id
    loadConfigInto(target.config)
    persistDocs()
  }

  function newDocument(templateKey = 'blank') {
    syncCurrent()
    const cfg = TEMPLATES[templateKey]?.build() ?? defaultConfig()
    const doc = makeDoc(cfg)
    docs.value.push(doc)
    currentDocId.value = doc.id
    loadConfigInto(cfg)
    persistDocs()
    return doc.id
  }

  function duplicateDocument() {
    syncCurrent()
    const cfg = cloneConfig(toRaw(config.value))
    cfg.title = `${cfg.title || 'Untitled'} (copy)`
    const doc = makeDoc(cfg)
    docs.value.push(doc)
    currentDocId.value = doc.id
    loadConfigInto(cfg)
    persistDocs()
    return doc.id
  }

  function deleteDocument(id: string) {
    const idx = docs.value.findIndex((d) => d.id === id)
    if (idx < 0) return
    docs.value.splice(idx, 1)
    if (docs.value.length === 0) docs.value.push(makeDoc(defaultConfig()))
    if (currentDocId.value === id) {
      currentDocId.value = docs.value[0]!.id
      loadConfigInto(docs.value[0]!.config)
    }
    persistDocs()
  }

  return {
    config,
    canUndo,
    canRedo,
    undo,
    redo,
    addBlock,
    insertBlock,
    removeBlock,
    duplicateBlock,
    addDefaultTable,
    applyTemplate,
    resetToDefault,
    // documents
    documentList,
    currentDocId,
    switchDocument,
    newDocument,
    duplicateDocument,
    deleteDocument
  }
})
