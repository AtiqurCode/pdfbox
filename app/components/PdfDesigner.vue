<script setup lang="ts">
import { usePdfDesignerStore, TEMPLATES } from '~/stores/pdfDesigner'
import type { PdfDocumentConfig } from '~/types/pdf'

const store = usePdfDesignerStore()
const toast = useToast()

const isGenerating = ref(false)
const isPreviewing = ref(false)
const activeSection = ref<'header' | 'body' | 'footer'>('body')
const previewUrl = ref<string | null>(null)
const lastBlob = ref<Blob | null>(null)
const validationErrors = ref<string[]>([])
const autoPreview = ref(true)

const isEmptyDoc = computed(() => {
  const c = store.config
  return c.header.blocks.length + c.body.blocks.length + c.footer.blocks.length === 0
})

const mergeRows = ref<{ key: string; value: string }[]>([])
const batchRows = ref<Record<string, unknown>[]>([])
const batchColumns = ref<string[]>([])
const batchSourceName = ref<string>('')
const batchNamePattern = ref<string>('{{title}}-{{index}}.pdf')

// Literal token examples kept in JS so the Vue mustache parser doesn't choke on `}}`.
const tokenExample = '{{field}}'
const dottedExample = 'client.name'
const namePatternPlaceholder = '{{title}}-{{index}}.pdf'
const namePatternHelp = 'Tokens like {{index}} and your column names work here.'

let inFlight: AbortController | null = null
let lastPayloadHash: string | null = null
let lastPayloadBlob: Blob | null = null

const pageSizeItems = [
  { label: 'A4', value: 'A4' },
  { label: 'A5', value: 'A5' },
  { label: 'Custom (pt)', value: 'CUSTOM' }
]

const orientationItems = [
  { label: 'Portrait', value: 'portrait' },
  { label: 'Landscape', value: 'landscape' }
]

const fontItems = [
  { label: 'Helvetica', value: 'Helvetica' },
  { label: 'Times Roman', value: 'TimesRoman' },
  { label: 'Courier', value: 'Courier' }
]

const templateItems = Object.entries(TEMPLATES).map(([key, t]) => ({
  label: t.label,
  value: key
}))

const isHex = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v)

// ── Style presets (font + color theme in one click) ─────────────────────────
const STYLE_PRESETS: {
  name: string
  font: 'Helvetica' | 'TimesRoman' | 'Courier'
  textColor: string
  headingColor: string
  accentColor: string
  backgroundColor: string
}[] = [
  { name: 'Classic', font: 'Helvetica', textColor: '#111827', headingColor: '#111827', accentColor: '#2563eb', backgroundColor: '#ffffff' },
  { name: 'Navy', font: 'TimesRoman', textColor: '#1f2937', headingColor: '#1e3a5f', accentColor: '#1e40af', backgroundColor: '#ffffff' },
  { name: 'Teal', font: 'Helvetica', textColor: '#0f172a', headingColor: '#0f766e', accentColor: '#0d9488', backgroundColor: '#ffffff' },
  { name: 'Warm', font: 'Helvetica', textColor: '#1c1917', headingColor: '#9a3412', accentColor: '#ea580c', backgroundColor: '#fffdf7' },
  { name: 'Mono', font: 'Courier', textColor: '#0f172a', headingColor: '#0f172a', accentColor: '#475569', backgroundColor: '#f8fafc' }
]

function applyStyle(preset: (typeof STYLE_PRESETS)[number]) {
  const d = store.config.design
  d.font = preset.font
  d.textColor = preset.textColor as any
  d.headingColor = preset.headingColor as any
  d.accentColor = preset.accentColor as any
  d.backgroundColor = preset.backgroundColor as any
  toast.add({ title: 'Style applied', description: `“${preset.name}” theme set.`, color: 'success' })
}

// ── Contrast checker (WCAG) between text and background ──────────────────────
function relLuminance(hex: string): number {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex)
  if (!m) return 1
  const n = parseInt(m[1]!, 16)
  const srgb = [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff].map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * srgb[0]! + 0.7152 * srgb[1]! + 0.0722 * srgb[2]!
}

const contrastRatio = computed(() => {
  const t = store.config.design.textColor
  const b = store.config.design.backgroundColor
  if (!isHex(t) || !isHex(b)) return null
  const L1 = relLuminance(t)
  const L2 = relLuminance(b)
  const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
  return Math.round(ratio * 100) / 100
})

function safeHex(v: string, fallback: string): string {
  return isHex(v) ? v : fallback
}

function validate(): string[] {
  const errs: string[] = []
  const c = store.config

  if (!c.title || c.title.trim().length === 0) errs.push('Title is required.')
  if (c.title.length > 200) errs.push('Title must be 200 characters or less.')

  if (!isHex(c.design.textColor)) errs.push('Text color must be a valid hex (#RRGGBB).')
  if (!isHex(c.design.headingColor)) errs.push('Heading color must be a valid hex (#RRGGBB).')
  if (!isHex(c.design.accentColor)) errs.push('Accent color must be a valid hex (#RRGGBB).')
  if (!isHex(c.design.backgroundColor)) errs.push('Background color must be a valid hex (#RRGGBB).')

  const m = c.layout.marginPt
  if (m < 12 || m > 144) errs.push('Margin must be between 12 and 144 pt.')

  if (c.layout.pageSize === 'CUSTOM') {
    if (!c.layout.customWidthPt || c.layout.customWidthPt < 72) errs.push('Custom width must be at least 72 pt.')
    if (!c.layout.customHeightPt || c.layout.customHeightPt < 72) errs.push('Custom height must be at least 72 pt.')
  }

  const totalBlocks = c.header.blocks.length + c.body.blocks.length + c.footer.blocks.length
  if (totalBlocks === 0) errs.push('Add at least one content block.')

  return errs
}

/** Assign a value into a nested object using a dotted key path (e.g. "client.name"). */
function setByPath(target: Record<string, any>, path: string, value: unknown) {
  const keys = path.split('.').map((k) => k.trim()).filter(Boolean)
  if (keys.length === 0) return
  let cur = target
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i]!
    if (typeof cur[k] !== 'object' || cur[k] === null) cur[k] = {}
    cur = cur[k]
  }
  cur[keys[keys.length - 1]!] = value
}

/** Build the merge-data object from the key/value rows (dotted keys allowed). */
function buildMergeData(): Record<string, unknown> | undefined {
  const obj: Record<string, any> = {}
  let any = false
  for (const row of mergeRows.value) {
    const key = row.key.trim()
    if (!key) continue
    setByPath(obj, key, row.value)
    any = true
  }
  return any ? obj : undefined
}

function buildPayload(): PdfDocumentConfig {
  const payload: PdfDocumentConfig = JSON.parse(JSON.stringify(toRaw(store.config)))
  payload.design.textColor = safeHex(payload.design.textColor, '#111827') as any
  payload.design.headingColor = safeHex(payload.design.headingColor, '#111827') as any
  payload.design.accentColor = safeHex(payload.design.accentColor, '#2563eb') as any
  payload.design.backgroundColor = safeHex(payload.design.backgroundColor, '#ffffff') as any

  const data = buildMergeData()
  if (data) payload.data = data
  else delete (payload as any).data
  return payload
}

function addMergeRow() {
  mergeRows.value.push({ key: '', value: '' })
}
function removeMergeRow(index: number) {
  mergeRows.value.splice(index, 1)
}

function stableStringify(v: any): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v)
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`
  const keys = Object.keys(v).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(',')}}`
}

async function fetchPdfBlob(payload: PdfDocumentConfig, signal?: AbortSignal): Promise<Blob> {
  const data = await $fetch<ArrayBuffer>('/api/pdf', {
    method: 'POST',
    body: payload,
    responseType: 'arrayBuffer',
    signal
  })
  return new Blob([data], { type: 'application/pdf' })
}

/** Minimal CSV parser (handles quoted fields, embedded commas/newlines, "" escapes). */
function parseCsv(text: string): { columns: string[]; rows: Record<string, string>[] } {
  const records: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false
  const src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n') { row.push(field); records.push(row); row = []; field = '' }
    else field += c
  }
  if (field.length > 0 || row.length > 0) { row.push(field); records.push(row) }

  const nonEmpty = records.filter((r) => r.some((v) => v.trim().length > 0))
  if (nonEmpty.length === 0) return { columns: [], rows: [] }
  const columns = nonEmpty[0]!.map((h) => h.trim())
  const rows = nonEmpty.slice(1).map((r) => {
    const obj: Record<string, string> = {}
    columns.forEach((col, idx) => { obj[col] = (r[idx] ?? '').trim() })
    return obj
  })
  return { columns, rows }
}

async function onCsvPicked(file: File | null) {
  if (!file) return
  try {
    const text = await file.text()
    const { columns, rows } = parseCsv(text)
    if (columns.length === 0 || rows.length === 0) {
      toast.add({ title: 'Empty file', description: 'No rows found in that CSV.', color: 'error' })
      return
    }
    batchColumns.value = columns
    batchRows.value = rows
    batchSourceName.value = file.name
    toast.add({ title: 'Spreadsheet loaded', description: `${rows.length} rows · columns: ${columns.join(', ')}`, color: 'success' })
  } catch (e: any) {
    toast.add({ title: 'Could not read file', description: e?.message || 'Failed to parse CSV.', color: 'error' })
  }
}

function clearBatch() {
  batchRows.value = []
  batchColumns.value = []
  batchSourceName.value = ''
}

async function previewPdf(opts?: { silent?: boolean }) {
  const silent = opts?.silent === true
  validationErrors.value = validate()
  if (validationErrors.value.length > 0) {
    // In silent (auto) mode we just surface the inline errors and skip rendering.
    if (!silent) toast.add({ title: 'Validation failed', description: validationErrors.value[0], color: 'error' })
    return
  }

  isPreviewing.value = true
  try {
    const payload = buildPayload()
    const hash = stableStringify(payload)
    if (hash === lastPayloadHash && lastPayloadBlob) {
      lastBlob.value = lastPayloadBlob
      if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
      previewUrl.value = URL.createObjectURL(lastPayloadBlob)
      if (!silent) toast.add({ title: 'Preview ready', description: 'Using cached preview.', color: 'success' })
      return
    }

    if (inFlight) inFlight.abort()
    inFlight = new AbortController()
    const blob = await fetchPdfBlob(payload, inFlight.signal)
    lastBlob.value = blob
    lastPayloadHash = hash
    lastPayloadBlob = blob

    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = URL.createObjectURL(blob)

    if (!silent) toast.add({ title: 'Preview ready', description: 'Your document is rendered on the right.', color: 'success' })
  } catch (e: any) {
    if (e?.name === 'AbortError') return
    const msg = e?.data?.message || e?.message || 'Failed to generate PDF'
    if (!silent) toast.add({ title: 'Generation failed', description: msg, color: 'error' })
  } finally {
    isPreviewing.value = false
  }
}

// ── Live (auto) preview ──────────────────────────────────────────────────────
// Debounce config/merge-data changes and silently re-render so the preview
// tracks edits without manual clicks. Caching + abort already de-dupe work.
let autoT: number | null = null
function scheduleAutoPreview() {
  if (!autoPreview.value) return
  if (autoT) window.clearTimeout(autoT)
  autoT = window.setTimeout(() => previewPdf({ silent: true }), 700)
}

watch(
  [() => store.config, mergeRows],
  scheduleAutoPreview,
  { deep: true }
)

watch(autoPreview, (on) => {
  if (on && !previewUrl.value) previewPdf({ silent: true })
})

// ── Undo / redo ──────────────────────────────────────────────────────────────
function onUndo() {
  store.undo()
}
function onRedo() {
  store.redo()
}
function onGlobalKeydown(e: KeyboardEvent) {
  const mod = e.metaKey || e.ctrlKey
  if (!mod) return
  // Don't hijack native text-editing undo while a field is focused.
  const el = document.activeElement
  const editable =
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLElement && el.isContentEditable)
  if (editable) return
  const key = e.key.toLowerCase()
  if (key === 'z' && !e.shiftKey) {
    e.preventDefault()
    onUndo()
  } else if ((key === 'z' && e.shiftKey) || key === 'y') {
    e.preventDefault()
    onRedo()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onGlobalKeydown)
  if (autoPreview.value) previewPdf({ silent: true })
})

function downloadCurrentBlob() {
  if (!lastBlob.value) return
  const url = URL.createObjectURL(lastBlob.value)
  const a = document.createElement('a')
  a.href = url
  a.download = `${(store.config.title || 'document').replaceAll(/[^\w\-]+/g, '_')}.pdf`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  toast.add({ title: 'PDF downloaded', description: `${store.config.title}.pdf saved.`, color: 'success' })
}

async function generateAndDownload() {
  validationErrors.value = validate()
  if (validationErrors.value.length > 0) {
    toast.add({ title: 'Validation failed', description: validationErrors.value[0], color: 'error' })
    return
  }

  isGenerating.value = true
  try {
    const payload = buildPayload()
    const hash = stableStringify(payload)
    let blob: Blob
    if (hash === lastPayloadHash && lastPayloadBlob) blob = lastPayloadBlob
    else {
      if (inFlight) inFlight.abort()
      inFlight = new AbortController()
      blob = await fetchPdfBlob(payload, inFlight.signal)
      lastPayloadHash = hash
      lastPayloadBlob = blob
    }
    lastBlob.value = blob

    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = URL.createObjectURL(blob)

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(payload.title || 'document').replaceAll(/[^\w\-]+/g, '_')}.pdf`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)

    toast.add({ title: 'PDF downloaded', description: `${payload.title}.pdf is ready.`, color: 'success' })
  } catch (e: any) {
    if (e?.name === 'AbortError') return
    const msg = e?.data?.message || e?.message || 'Failed to generate PDF'
    toast.add({ title: 'Generation failed', description: msg, color: 'error' })
  } finally {
    isGenerating.value = false
  }
}

function onTemplateSelect(key: string | number) {
  store.applyTemplate(String(key))
  toast.add({ title: 'Template applied', description: `Loaded "${TEMPLATES[String(key)]?.label}" template.`, color: 'info' })
}

// ── Document switcher ────────────────────────────────────────────────────────
const docMenuItems = computed(() => [
  store.documentList.map((d) => ({
    label: d.title,
    icon: d.id === store.currentDocId ? 'i-lucide-check' : 'i-lucide-file-text',
    onSelect: () => store.switchDocument(d.id)
  })),
  [
    { label: 'New document', icon: 'i-lucide-file-plus', onSelect: () => { store.newDocument('blank'); toast.add({ title: 'New document', color: 'success' }) } },
    { label: 'Duplicate this', icon: 'i-lucide-copy', onSelect: () => { store.duplicateDocument(); toast.add({ title: 'Document duplicated', color: 'success' }) } },
    { label: 'Delete this', icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => deleteCurrentDoc() }
  ]
])

function deleteCurrentDoc() {
  const id = store.currentDocId
  const title = store.config.title || 'this document'
  if (!window.confirm(`Delete “${title}”? This can't be undone.`)) return
  store.deleteDocument(id)
  toast.add({ title: 'Document deleted', color: 'info' })
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onerror = () => reject(new Error('Failed to read file'))
    r.onload = () => resolve(String(r.result ?? ''))
    r.readAsDataURL(file)
  })
}

async function onFontPicked(style: 'regular' | 'bold' | 'italic' | 'boldItalic', file: File | null) {
  if (!file) return
  const dataUrl = await fileToDataUrl(file)
  store.config.design.customFonts ??= {}
  ;(store.config.design.customFonts as any)[style] = dataUrl
  toast.add({ title: 'Font uploaded', description: `${style} font set.`, color: 'success' })
  // bust cache
  lastPayloadHash = null
  lastPayloadBlob = null
}

function clearFont(style: 'regular' | 'bold' | 'italic' | 'boldItalic') {
  if (!store.config.design.customFonts) return
  delete (store.config.design.customFonts as any)[style]
  if (Object.keys(store.config.design.customFonts).length === 0) delete (store.config.design as any).customFonts
  toast.add({ title: 'Font cleared', description: `${style} font removed.`, color: 'info' })
  lastPayloadHash = null
  lastPayloadBlob = null
}

async function batchGenerateZip() {
  validationErrors.value = validate()
  if (validationErrors.value.length > 0) {
    toast.add({ title: 'Validation failed', description: validationErrors.value[0], color: 'error' })
    return
  }

  const rows = batchRows.value
  if (rows.length === 0) {
    toast.add({ title: 'No rows', description: 'Upload a CSV/spreadsheet first.', color: 'error' })
    return
  }

  isGenerating.value = true
  try {
    if (inFlight) inFlight.abort()
    inFlight = new AbortController()

    const payload = buildPayload()
    const zipBytes = await $fetch<ArrayBuffer>('/api/pdf/batch', {
      method: 'POST',
      body: {
        template: payload,
        rows,
        namePattern: batchNamePattern.value || '{{title}}-{{index}}.pdf'
      },
      responseType: 'arrayBuffer',
      signal: inFlight.signal
    })

    const blob = new Blob([zipBytes], { type: 'application/zip' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(payload.title || 'batch').replaceAll(/[^\w\-]+/g, '_')}.zip`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)

    toast.add({ title: 'Batch ready', description: `${rows.length} PDFs zipped.`, color: 'success' })
  } catch (e: any) {
    if (e?.name === 'AbortError') return
    const msg = e?.data?.message || e?.message || 'Failed to generate batch zip'
    toast.add({ title: 'Batch failed', description: msg, color: 'error' })
  } finally {
    isGenerating.value = false
  }
}

onUnmounted(() => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  if (inFlight) inFlight.abort()
  if (autoT) window.clearTimeout(autoT)
  window.removeEventListener('keydown', onGlobalKeydown)
})
</script>

<template>
  <div class="grid gap-6 lg:grid-cols-12">
    <section class="lg:col-span-7">
      <div class="space-y-6">
        <UCard class="border-violet-100/60 shadow-sm dark:border-slate-700/60">
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div class="flex items-center gap-3">
                <UDropdownMenu :items="docMenuItems" :content="{ align: 'start' }">
                  <UButton
                    variant="ghost"
                    color="neutral"
                    size="sm"
                    icon="i-lucide-files"
                    trailing-icon="i-lucide-chevron-down"
                    class="font-semibold"
                    :label="store.config.title || 'Untitled'"
                  />
                </UDropdownMenu>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <UButtonGroup size="sm">
                  <UButton
                    variant="ghost"
                    icon="i-lucide-undo-2"
                    :disabled="!store.canUndo"
                    title="Undo (Ctrl/Cmd+Z)"
                    @click="onUndo"
                  />
                  <UButton
                    variant="ghost"
                    icon="i-lucide-redo-2"
                    :disabled="!store.canRedo"
                    title="Redo (Ctrl/Cmd+Shift+Z)"
                    @click="onRedo"
                  />
                </UButtonGroup>
                <USelect
                  placeholder="Load template…"
                  :items="templateItems"
                  size="sm"
                  class="w-40"
                  @update:model-value="onTemplateSelect"
                />
                <UButton
                  :loading="isPreviewing"
                  :disabled="isGenerating"
                  label="Preview"
                  icon="i-lucide-eye"
                  @click="previewPdf()"
                />
                <UButton
                  :loading="isGenerating"
                  :disabled="isPreviewing"
                  label="Download"
                  variant="soft"
                  icon="i-lucide-download"
                  @click="generateAndDownload"
                />
              </div>
            </div>
          </template>

          <div class="grid gap-4 md:grid-cols-12">
            <div class="md:col-span-8">
              <UFormField label="Title" size="sm" :error="validationErrors.find(e => e.startsWith('Title'))">
                <UInput v-model="store.config.title" placeholder="e.g. Invoice · Proposal · Report" />
              </UFormField>
            </div>
            <div class="md:col-span-4">
              <UFormField label="Base font" size="sm">
                <USelect v-model="store.config.design.font" :items="fontItems" />
              </UFormField>
            </div>
          </div>

          <div
            v-if="validationErrors.length > 0"
            class="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-950/50 dark:text-red-400"
          >
            <ul class="list-inside list-disc space-y-0.5">
              <li v-for="err in validationErrors" :key="err">{{ err }}</li>
            </ul>
          </div>
        </UCard>

        <UCard class="border-violet-100/60 shadow-sm dark:border-slate-700/60">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <div class="text-sm font-semibold text-slate-800 dark:text-slate-200">Content</div>
            </div>
          </template>

          <UTabs
            v-model="activeSection"
            :items="[
              { label: 'Header', value: 'header' },
              { label: 'Body', value: 'body' },
              { label: 'Footer', value: 'footer' }
            ]"
          />

          <div class="mt-4">
            <BlockEditor v-if="activeSection === 'header'" v-model="store.config.header" title="Header" />
            <BlockEditor
              v-else-if="activeSection === 'body'"
              v-model="store.config.body"
              title="Main body"
              :allow-tables="true"
            />
            <BlockEditor v-else v-model="store.config.footer" title="Footer" />
          </div>
        </UCard>

        <UCard class="border-violet-100/60 shadow-sm dark:border-slate-700/60">
          <template #header>
            <div class="text-sm font-semibold text-slate-800 dark:text-slate-200">Design</div>
          </template>

          <div class="space-y-5">
            <div class="grid grid-cols-2 gap-3">
              <UFormField label="Page size" size="sm">
                <USelect v-model="store.config.layout.pageSize" :items="pageSizeItems" />
              </UFormField>
              <UFormField label="Orientation" size="sm">
                <USelect v-model="store.config.layout.orientation" :items="orientationItems" />
              </UFormField>
            </div>

            <div v-if="store.config.layout.pageSize === 'CUSTOM'" class="grid grid-cols-2 gap-2">
              <UFormField label="Width (pt)" size="sm" :error="validationErrors.find(e => e.startsWith('Custom width'))">
                <UInput v-model.number="store.config.layout.customWidthPt" type="number" placeholder="595" />
              </UFormField>
              <UFormField label="Height (pt)" size="sm" :error="validationErrors.find(e => e.startsWith('Custom height'))">
                <UInput v-model.number="store.config.layout.customHeightPt" type="number" placeholder="842" />
              </UFormField>
            </div>

            <UFormField label="Margin (pt)" size="sm" help="54pt ≈ 0.75in" :error="validationErrors.find(e => e.startsWith('Margin'))">
              <UInput v-model.number="store.config.layout.marginPt" type="number" />
            </UFormField>

            <USeparator />

            <div>
              <div class="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Style presets</div>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="preset in STYLE_PRESETS"
                  :key="preset.name"
                  type="button"
                  class="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 transition hover:border-violet-300 hover:bg-violet-50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-violet-700 dark:hover:bg-violet-950/40"
                  :title="`Apply ${preset.name} theme`"
                  @click="applyStyle(preset)"
                >
                  <span class="flex">
                    <span class="size-3 rounded-l-full border border-slate-200 dark:border-slate-600" :style="{ backgroundColor: preset.headingColor }" />
                    <span class="size-3 border-y border-slate-200 dark:border-slate-600" :style="{ backgroundColor: preset.accentColor }" />
                    <span class="size-3 rounded-r-full border border-slate-200 dark:border-slate-600" :style="{ backgroundColor: preset.backgroundColor }" />
                  </span>
                  {{ preset.name }}
                </button>
              </div>
            </div>

            <div>
              <div class="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Colors</div>
              <div class="grid grid-cols-2 gap-3">
                <UFormField label="Text" size="sm" :error="validationErrors.find(e => e.startsWith('Text color'))">
                  <ColorPicker v-model="store.config.design.textColor" />
                </UFormField>
                <UFormField label="Heading" size="sm" :error="validationErrors.find(e => e.startsWith('Heading color'))">
                  <ColorPicker v-model="store.config.design.headingColor" />
                </UFormField>
                <UFormField label="Accent" size="sm" :error="validationErrors.find(e => e.startsWith('Accent color'))">
                  <ColorPicker v-model="store.config.design.accentColor" />
                </UFormField>
                <UFormField label="Background" size="sm" :error="validationErrors.find(e => e.startsWith('Background color'))">
                  <ColorPicker v-model="store.config.design.backgroundColor" />
                </UFormField>
              </div>

              <div
                v-if="contrastRatio !== null && contrastRatio < 4.5"
                class="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-400"
              >
                <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-3.5 shrink-0" />
                <span>Low text/background contrast ({{ contrastRatio }}:1). Aim for 4.5:1 or higher for readability.</span>
              </div>
            </div>
          </div>
        </UCard>

        <UCard class="border-violet-100/60 shadow-sm dark:border-slate-700/60">
          <template #header>
            <div class="text-sm font-semibold text-slate-800 dark:text-slate-200">Advanced</div>
          </template>

          <details class="group">
            <summary class="flex cursor-pointer list-none items-center justify-between rounded-lg px-1 py-1 text-sm text-slate-600 transition hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60">
              <span>Custom fonts, merge fields & batch from CSV</span>
              <span class="text-xs text-slate-400 group-open:hidden">Show</span>
              <span class="text-xs text-slate-400 hidden group-open:inline">Hide</span>
            </summary>

            <div class="mt-3 space-y-5">
              <div>
                <div class="mb-2 text-xs font-medium text-slate-600 dark:text-slate-300">Custom fonts (TTF/OTF)</div>
                <div class="space-y-2">
                  <div class="flex items-center gap-2">
                    <input
                      type="file"
                      accept=".ttf,.otf,font/ttf,font/otf"
                      class="block w-full text-xs text-slate-700 dark:text-slate-300"
                      @change="onFontPicked('regular', (($event.target as HTMLInputElement).files?.[0] ?? null))"
                    />
                    <UButton size="xs" variant="ghost" label="Clear" @click="clearFont('regular')" />
                  </div>
                  <div class="flex items-center gap-2">
                    <input
                      type="file"
                      accept=".ttf,.otf,font/ttf,font/otf"
                      class="block w-full text-xs text-slate-700 dark:text-slate-300"
                      @change="onFontPicked('bold', (($event.target as HTMLInputElement).files?.[0] ?? null))"
                    />
                    <UButton size="xs" variant="ghost" label="Clear" @click="clearFont('bold')" />
                  </div>
                  <div class="flex items-center gap-2">
                    <input
                      type="file"
                      accept=".ttf,.otf,font/ttf,font/otf"
                      class="block w-full text-xs text-slate-700 dark:text-slate-300"
                      @change="onFontPicked('italic', (($event.target as HTMLInputElement).files?.[0] ?? null))"
                    />
                    <UButton size="xs" variant="ghost" label="Clear" @click="clearFont('italic')" />
                  </div>
                  <div class="flex items-center gap-2">
                    <input
                      type="file"
                      accept=".ttf,.otf,font/ttf,font/otf"
                      class="block w-full text-xs text-slate-700 dark:text-slate-300"
                      @change="onFontPicked('boldItalic', (($event.target as HTMLInputElement).files?.[0] ?? null))"
                    />
                    <UButton size="xs" variant="ghost" label="Clear" @click="clearFont('boldItalic')" />
                  </div>
                </div>
              </div>

              <div>
                <div class="mb-1 text-xs font-medium text-slate-600 dark:text-slate-300">Merge fields</div>
                <p class="mb-2 text-xs text-slate-500 dark:text-slate-400">
                  Add a field, then use <span class="font-mono">{{ tokenExample }}</span> anywhere in your text. Use dots for groups, e.g. <span class="font-mono">{{ dottedExample }}</span>.
                </p>
                <div class="space-y-2">
                  <div v-for="(row, i) in mergeRows" :key="i" class="flex items-center gap-2">
                    <UInput v-model="row.key" size="sm" placeholder="field (e.g. client.name)" class="flex-1 font-mono" />
                    <UInput v-model="row.value" size="sm" placeholder="value" class="flex-1" />
                    <UButton size="xs" color="error" variant="ghost" icon="i-lucide-x" title="Remove field" @click="removeMergeRow(i)" />
                  </div>
                </div>
                <UButton class="mt-2" size="xs" variant="soft" icon="i-lucide-plus" label="Add field" @click="addMergeRow" />
              </div>

              <div>
                <div class="mb-1 text-xs font-medium text-slate-600 dark:text-slate-300">Batch from spreadsheet</div>
                <p class="mb-2 text-xs text-slate-500 dark:text-slate-400">
                  Upload a CSV — each row becomes a PDF, with column names as merge fields. Export from Excel/Sheets as “.csv”.
                </p>

                <div class="flex items-center gap-2">
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    class="block w-full text-xs text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-violet-700 hover:file:bg-violet-100 dark:text-slate-300 dark:file:bg-violet-950 dark:file:text-violet-300"
                    @change="onCsvPicked((($event.target as HTMLInputElement).files?.[0] ?? null))"
                  />
                  <UButton v-if="batchRows.length" size="xs" variant="ghost" label="Clear" @click="clearBatch" />
                </div>

                <div v-if="batchRows.length" class="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  <div class="font-medium text-slate-700 dark:text-slate-200">{{ batchSourceName }} · {{ batchRows.length }} rows</div>
                  <div class="mt-0.5 flex flex-wrap gap-1">
                    <UBadge v-for="col in batchColumns" :key="col" size="xs" variant="soft" class="font-mono">{{ col }}</UBadge>
                  </div>
                </div>

                <UFormField label="File name pattern" size="sm" class="mt-3" :help="namePatternHelp">
                  <UInput v-model="batchNamePattern" :placeholder="namePatternPlaceholder" />
                </UFormField>

                <UButton
                  class="mt-3 w-full"
                  :loading="isGenerating"
                  :disabled="isPreviewing || !batchRows.length"
                  label="Generate ZIP"
                  icon="i-lucide-package"
                  @click="batchGenerateZip"
                />
              </div>
            </div>
          </details>
        </UCard>
      </div>
    </section>

    <section class="lg:col-span-5">
      <div class="lg:sticky lg:top-6">
        <UCard class="border-violet-200/60 shadow-sm dark:border-slate-700/60">
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <div class="text-sm font-semibold text-slate-800 dark:text-slate-200">Preview</div>
                <UBadge v-if="isPreviewing" variant="soft" size="xs" color="warning">Rendering…</UBadge>
                <UBadge v-else-if="autoPreview" variant="soft" size="xs" color="success">Live</UBadge>
              </div>
              <div class="flex items-center gap-2">
                <USwitch v-model="autoPreview" size="sm" label="Auto" />
                <UButton
                  size="xs"
                  variant="soft"
                  icon="i-lucide-refresh-cw"
                  label="Refresh"
                  :loading="isPreviewing"
                  @click="previewPdf()"
                />
                <UButton
                  size="xs"
                  variant="soft"
                  icon="i-lucide-download"
                  label="Download"
                  :disabled="!lastBlob"
                  @click="downloadCurrentBlob"
                />
              </div>
            </div>
          </template>

          <iframe
            v-if="previewUrl"
            :src="previewUrl"
            class="h-[80vh] w-full rounded-lg border border-slate-200 bg-white dark:border-slate-700"
          />
          <!-- Onboarding: empty document → offer a starting template -->
          <div
            v-else-if="isEmptyDoc"
            class="grid h-[80vh] place-items-center rounded-lg border border-dashed border-slate-300 px-6 text-center dark:border-slate-600"
          >
            <div class="w-full max-w-sm space-y-4">
              <div class="space-y-1">
                <UIcon name="i-lucide-sparkles" class="mx-auto size-8 text-violet-500" />
                <div class="text-base font-semibold text-slate-700 dark:text-slate-200">Start with a template</div>
                <p class="text-sm text-slate-500 dark:text-slate-400">Pick one to get going — you can change everything after.</p>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <UButton
                  v-for="t in templateItems"
                  :key="t.value"
                  block
                  variant="soft"
                  :label="t.label"
                  @click="onTemplateSelect(t.value)"
                />
              </div>
            </div>
          </div>
          <div
            v-else
            class="grid h-[80vh] place-items-center rounded-lg border border-dashed border-slate-300 text-center text-sm text-slate-400 dark:border-slate-600 dark:text-slate-500"
          >
            <div class="space-y-1">
              <UIcon name="i-lucide-file-text" class="mx-auto size-8 opacity-60" />
              <div>Your live preview will appear here.</div>
              <div v-if="validationErrors.length" class="text-red-500 dark:text-red-400">
                Fix the highlighted errors to render.
              </div>
            </div>
          </div>
        </UCard>
      </div>
    </section>
  </div>
</template>
