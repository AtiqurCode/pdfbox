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
          spans: [{ text: 'Confidential · Generated with PDFora', color: '#6b7280' }]
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
      title: 'Invoice INV-001',
      header: {
        blocks: [
          { id: newId('p'), type: 'paragraph', align: 'left', spans: [{ text: 'Northwind Studio', bold: true }] },
          { id: newId('p'), type: 'paragraph', align: 'left', spans: [{ text: 'hello@northwind.studio  ·  (555) 010-1234', color: '#6b7280' }] }
        ]
      },
      body: {
        blocks: [
          { id: newId('h'), type: 'heading', level: 1, text: 'Invoice INV-001' },
          // Right-aligned dates sit just under the title, like a printed invoice.
          {
            id: newId('p'), type: 'paragraph', align: 'right',
            spans: [
              { text: 'Issued ', color: '#6b7280' }, { text: '03/01/2021' },
              { text: '     Due ', color: '#6b7280' }, { text: '03/16/2021' }
            ]
          },
          // Bill-to block.
          {
            id: newId('p'), type: 'paragraph',
            spans: [
              { text: 'Bill to\n', color: '#6b7280' },
              { text: 'Acme Corporation', bold: true },
              { text: '\n123 Market Street, Suite 400\nSpringfield, IL 62701' }
            ]
          },
          // Items — the table is the one strong visual element.
          {
            id: newId('t'), type: 'table', columns: 4, rows: 4,
            cells: [
              [{ text: 'Description', header: true }, { text: 'Qty', header: true }, { text: 'Unit price', header: true }, { text: 'Amount', header: true }],
              [{ text: 'Brand & identity design' }, { text: '1' }, { text: '$2,000.00' }, { text: '$2,000.00' }],
              [{ text: 'Website development' }, { text: '40 hrs' }, { text: '$100.00' }, { text: '$4,000.00' }],
              [{ text: 'Hosting & support (annual)' }, { text: '1' }, { text: '$600.00' }, { text: '$600.00' }]
            ]
          },
          // Totals, right-aligned beneath the table.
          { id: newId('p'), type: 'paragraph', align: 'right', spans: [{ text: 'Subtotal   ', color: '#6b7280' }, { text: '$6,600.00' }] },
          { id: newId('p'), type: 'paragraph', align: 'right', spans: [{ text: 'Tax (6.25%)   ', color: '#6b7280' }, { text: '$412.50' }] },
          { id: newId('p'), type: 'paragraph', align: 'right', spans: [{ text: 'Total due   ', bold: true }, { text: '$7,012.50', bold: true }] },
          {
            id: newId('p'), type: 'paragraph',
            spans: [{ text: 'Payment terms: ', bold: true }, { text: 'Net 30. Please reference the invoice number with your payment. Thank you for your business!', color: '#6b7280' }]
          }
        ]
      },
      footer: {
        blocks: [
          { id: newId('p'), type: 'paragraph', align: 'center', spans: [{ text: 'Northwind Studio · hello@northwind.studio', color: '#9ca3af' }] }
        ]
      },
      // Neutral, print-like palette: near-black ink, charcoal table header.
      design: { font: 'Helvetica', textColor: '#1f2937', backgroundColor: '#ffffff', accentColor: '#374151', headingColor: '#111827' },
      layout: { pageSize: 'A4', orientation: 'portrait', marginPt: 56 }
    })
  },

  report: {
    label: 'Report',
    build: () => ({
      title: 'Acme Corp — Q1 2026 Report',
      header: {
        blocks: [
          { id: newId('p'), type: 'paragraph', align: 'left', spans: [{ text: 'Acme Corp', bold: true }, { text: '   ·   Q1 2026 Business Review', color: '#64748b' }] }
        ]
      },
      body: {
        blocks: [
          { id: newId('h'), type: 'heading', level: 1, text: 'Q1 2026 Summary' },
          {
            id: newId('p'), type: 'paragraph',
            spans: [{ text: 'This report covers the key metrics and accomplishments for Q1 2026. Overall performance ' }, { text: 'exceeded targets by 12%', bold: true, color: '#15803d' }, { text: ', driven by strong demand and improved retention.' }]
          },
          { id: newId('h'), type: 'heading', level: 2, text: 'Key metrics' },
          {
            id: newId('t'), type: 'table', columns: 4, rows: 4,
            cells: [
              [{ text: 'Metric', header: true }, { text: 'Target', header: true }, { text: 'Actual', header: true }, { text: 'Change', header: true }],
              [{ text: 'Revenue' }, { text: '$1.20M' }, { text: '$1.35M' }, { text: '+12%' }],
              [{ text: 'New customers' }, { text: '150' }, { text: '168' }, { text: '+12%' }],
              [{ text: 'Net retention' }, { text: '92%' }, { text: '95%' }, { text: '+3pt' }]
            ]
          },
          { id: newId('h'), type: 'heading', level: 2, text: 'Highlights' },
          { id: newId('p'), type: 'paragraph', spans: [{ text: '• Launched the new analytics dashboard to all enterprise customers.\n• Reduced average onboarding time from 14 to 9 days.\n• Expanded the partnerships team by three hires.' }] },
          { id: newId('h'), type: 'heading', level: 2, text: 'Next steps' },
          { id: newId('p'), type: 'paragraph', spans: [{ text: 'Focus areas for next quarter: expand the sales team, launch the new product line, and lift onboarding NPS above 60.' }] }
        ]
      },
      footer: {
        blocks: [
          { id: newId('p'), type: 'paragraph', align: 'center', spans: [{ text: 'Confidential — Acme Corp   ·   Page {{page}} of {{pages}}', color: '#94a3b8' }] }
        ]
      },
      design: { font: 'Helvetica', textColor: '#1f2937', backgroundColor: '#ffffff', accentColor: '#0d9488', headingColor: '#0f766e' },
      layout: { pageSize: 'A4', orientation: 'portrait', marginPt: 56 }
    })
  },

  letter: {
    label: 'Letter',
    build: () => ({
      title: 'Business Letter',
      header: {
        blocks: [
          { id: newId('p'), type: 'paragraph', align: 'left', spans: [{ text: 'Jane Doe', bold: true }] },
          { id: newId('p'), type: 'paragraph', align: 'left', spans: [{ text: '456 Elm Street · Springfield · IL 62701', color: '#64748b' }] }
        ]
      },
      body: {
        blocks: [
          { id: newId('p'), type: 'paragraph', align: 'right', spans: [{ text: 'May 25, 2026', color: '#64748b' }] },
          { id: newId('p'), type: 'paragraph', spans: [{ text: 'Dear Mr. Smith,' }] },
          { id: newId('p'), type: 'paragraph', spans: [{ text: 'I am writing to follow up on our recent conversation regarding the partnership opportunity. We are genuinely excited about the potential collaboration and would welcome the chance to discuss the next steps in person.' }] },
          { id: newId('p'), type: 'paragraph', spans: [{ text: 'Please let me know your availability over the coming week. I look forward to hearing from you.' }] },
          { id: newId('p'), type: 'paragraph', spans: [{ text: 'Warm regards,', color: '#64748b' }] },
          { id: newId('p'), type: 'paragraph', spans: [{ text: 'Jane Doe', bold: true }] }
        ]
      },
      footer: { blocks: [] },
      design: { font: 'TimesRoman', textColor: '#1f2937', backgroundColor: '#fffdf9', accentColor: '#92400e', headingColor: '#1f2937' },
      layout: { pageSize: 'A4', orientation: 'portrait', marginPt: 64 }
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

  function applyAiConfig(next: PdfDocumentConfig, opts?: { mergeBody?: boolean }) {
    if (opts?.mergeBody) {
      config.value = {
        ...cloneConfig(config.value),
        title: next.title || config.value.title,
        body: next.body
      }
    } else {
      config.value = cloneConfig(next)
    }
    resetHistory()
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
    applyAiConfig,
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
