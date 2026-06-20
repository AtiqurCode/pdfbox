<script setup lang="ts">
import { usePdfDesignerStore, TEMPLATES } from '~/stores/pdfDesigner'
import type { PdfDocumentConfig } from '~/types/pdf'

const store = usePdfDesignerStore()
const toast = useToast()

const isGenerating = ref(false)
const isPreviewing = ref(false)
const activeSection = ref<'header' | 'body' | 'footer'>('body')
const activePanel = ref<'content' | 'style' | 'ai' | 'data'>('content')
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

const panelItems = [
  { label: 'Content', value: 'content', icon: 'i-lucide-align-left' },
  { label: 'Style', value: 'style', icon: 'i-lucide-palette' },
  { label: 'AI', value: 'ai', icon: 'i-lucide-sparkles' },
  { label: 'Data', value: 'data', icon: 'i-lucide-braces' }
]

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
const contrast = computed(() =>
  contrastRatio(store.config.design.textColor, store.config.design.backgroundColor)
)

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
function buildPayload(): PdfDocumentConfig {
  const payload: PdfDocumentConfig = JSON.parse(JSON.stringify(toRaw(store.config)))
  payload.design.textColor = safeHex(payload.design.textColor, '#111827') as any
  payload.design.headingColor = safeHex(payload.design.headingColor, '#111827') as any
  payload.design.accentColor = safeHex(payload.design.accentColor, '#2563eb') as any
  payload.design.backgroundColor = safeHex(payload.design.backgroundColor, '#ffffff') as any

  const data = buildMergeData(mergeRows.value)
  if (data) payload.data = data
  else delete (payload as any).data
  return payload
}

function onMergeSuggested(fields: { key: string; value: string }[]) {
  for (const f of fields) {
    if (!f.key?.trim()) continue
    const exists = mergeRows.value.some((r) => r.key === f.key)
    if (!exists) mergeRows.value.push({ key: f.key, value: f.value || '' })
  }
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
  autoT = window.setTimeout(() => previewPdf({ silent: true }), 350)
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
  <div class="grid gap-5 lg:grid-cols-12 lg:gap-6">
    <!-- Editor -->
    <section class="min-w-0 space-y-4 lg:col-span-7">
      <!-- Compact toolbar -->
      <div
        class="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3 py-2 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/60"
      >
        <UDropdownMenu :items="docMenuItems" :content="{ align: 'start' }">
          <UButton
            variant="ghost"
            color="neutral"
            size="sm"
            icon="i-lucide-files"
            trailing-icon="i-lucide-chevron-down"
            class="max-w-[10rem] truncate font-medium"
            :label="store.config.title || 'Untitled'"
          />
        </UDropdownMenu>

        <div class="hidden h-5 w-px bg-slate-200 dark:bg-slate-700 sm:block" />

        <UFieldGroup size="sm">
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
        </UFieldGroup>

        <USelect
          placeholder="Template…"
          :items="templateItems"
          size="sm"
          class="w-32"
          @update:model-value="onTemplateSelect"
        />

        <div class="flex-1" />

        <UButton
          :loading="isGenerating"
          :disabled="isPreviewing"
          label="Download"
          icon="i-lucide-download"
          size="sm"
          @click="generateAndDownload"
        />
      </div>

      <!-- Validation -->
      <div
        v-if="validationErrors.length > 0"
        class="rounded-lg border border-red-200/80 bg-red-50/80 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400"
      >
        {{ validationErrors[0] }}
        <span v-if="validationErrors.length > 1" class="text-red-500/80">
          · +{{ validationErrors.length - 1 }} more
        </span>
      </div>

      <!-- Tabbed editor panel -->
      <div class="rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700/60 dark:bg-slate-900/40">
        <div class="border-b border-slate-100 px-3 pt-3 dark:border-slate-800">
          <UTabs v-model="activePanel" :items="panelItems" size="sm" />
        </div>

        <div :class="activePanel === 'ai' || activePanel === 'data' ? '' : 'p-4 sm:p-5'">
          <!-- Content -->
          <div v-show="activePanel === 'content'" class="space-y-4">
            <div class="grid gap-3 sm:grid-cols-3">
              <UFormField label="Title" size="sm" class="sm:col-span-2" :error="validationErrors.find(e => e.startsWith('Title'))">
                <UInput v-model="store.config.title" placeholder="Invoice, Report, Letter…" />
              </UFormField>
              <UFormField label="Font" size="sm">
                <USelect v-model="store.config.design.font" :items="fontItems" />
              </UFormField>
            </div>

            <UTabs
              v-model="activeSection"
              :items="[
                { label: 'Header', value: 'header' },
                { label: 'Body', value: 'body' },
                { label: 'Footer', value: 'footer' }
              ]"
              size="sm"
            />

            <BlockEditor v-if="activeSection === 'header'" v-model="store.config.header" title="Header" />
            <BlockEditor
              v-else-if="activeSection === 'body'"
              v-model="store.config.body"
              title="Main body"
              :allow-tables="true"
            />
            <BlockEditor v-else v-model="store.config.footer" title="Footer" />
          </div>

          <!-- Style -->
          <div v-show="activePanel === 'style'" class="space-y-5">
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <UFormField label="Page size" size="sm">
                <USelect v-model="store.config.layout.pageSize" :items="pageSizeItems" />
              </UFormField>
              <UFormField label="Orientation" size="sm">
                <USelect v-model="store.config.layout.orientation" :items="orientationItems" />
              </UFormField>
              <UFormField label="Margin (pt)" size="sm" help="54 ≈ 0.75in" :error="validationErrors.find(e => e.startsWith('Margin'))">
                <UInput v-model.number="store.config.layout.marginPt" type="number" />
              </UFormField>
            </div>

            <div v-if="store.config.layout.pageSize === 'CUSTOM'" class="grid grid-cols-2 gap-3">
              <UFormField label="Width (pt)" size="sm" :error="validationErrors.find(e => e.startsWith('Custom width'))">
                <UInput v-model.number="store.config.layout.customWidthPt" type="number" placeholder="595" />
              </UFormField>
              <UFormField label="Height (pt)" size="sm" :error="validationErrors.find(e => e.startsWith('Custom height'))">
                <UInput v-model.number="store.config.layout.customHeightPt" type="number" placeholder="842" />
              </UFormField>
            </div>

            <div>
              <p class="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">Themes</p>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="preset in STYLE_PRESETS"
                  :key="preset.name"
                  type="button"
                  class="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 transition hover:border-violet-300 hover:bg-violet-50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-violet-700 dark:hover:bg-violet-950/40"
                  :title="`Apply ${preset.name}`"
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
              <p class="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">Colors</p>
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
                v-if="contrast !== null && contrast < 4.5"
                class="mt-3 flex items-start gap-2 rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-400"
              >
                <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-3.5 shrink-0" />
                <span>Low contrast ({{ contrast }}:1). Aim for 4.5:1+.</span>
              </div>
            </div>
          </div>

          <!-- AI -->
          <div v-show="activePanel === 'ai'">
            <AiAssistant
              :batch-columns="batchColumns"
              :batch-sample-row="batchRows[0]"
              @merge-suggested="onMergeSuggested"
            />
          </div>

          <!-- Data -->
          <div v-show="activePanel === 'data'">
            <DataPanel
              v-model:merge-rows="mergeRows"
              v-model:batch-name-pattern="batchNamePattern"
              :batch-rows="batchRows"
              :batch-columns="batchColumns"
              :batch-source-name="batchSourceName"
              :is-generating="isGenerating"
              :is-previewing="isPreviewing"
              :token-example="tokenExample"
              :dotted-example="dottedExample"
              :name-pattern-placeholder="namePatternPlaceholder"
              :name-pattern-help="namePatternHelp"
              @csv-picked="onCsvPicked"
              @clear-batch="clearBatch"
              @batch-generate="batchGenerateZip"
              @font-picked="onFontPicked"
              @clear-font="clearFont"
              @merge-suggested="onMergeSuggested"
            />
          </div>
        </div>
      </div>
    </section>

    <!-- Preview -->
    <section class="min-w-0 lg:col-span-5">
      <div class="lg:sticky lg:top-[4.5rem]">
        <div class="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700/60 dark:bg-slate-900/40">
          <div class="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 dark:border-slate-800">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-slate-700 dark:text-slate-200">Preview</span>
              <UBadge v-if="isPreviewing" variant="soft" size="xs" color="warning">Rendering</UBadge>
              <UBadge v-else-if="autoPreview" variant="soft" size="xs" color="success">Live</UBadge>
            </div>
            <div class="flex items-center gap-1">
              <USwitch v-model="autoPreview" size="sm" />
              <UButton
                size="xs"
                variant="ghost"
                icon="i-lucide-refresh-cw"
                title="Refresh"
                :loading="isPreviewing"
                @click="previewPdf()"
              />
              <UButton
                size="xs"
                variant="ghost"
                icon="i-lucide-download"
                title="Download"
                :disabled="!lastBlob"
                @click="downloadCurrentBlob"
              />
            </div>
          </div>

          <div class="bg-slate-100 p-2 dark:bg-slate-950/50">
            <iframe
              v-if="previewUrl"
              :src="previewUrl"
              class="h-[58vh] w-full rounded-lg border border-slate-200 bg-white shadow-inner sm:h-[70vh] lg:h-[calc(100vh-8rem)] dark:border-slate-700"
            />
            <div
              v-else-if="isEmptyDoc"
              class="grid h-[58vh] place-items-center rounded-lg border border-dashed border-slate-300 bg-white px-6 text-center dark:border-slate-600 dark:bg-slate-900 sm:h-[70vh] lg:h-[calc(100vh-8rem)]"
            >
              <div class="max-w-xs space-y-4">
                <UIcon name="i-lucide-layout-template" class="mx-auto size-8 text-violet-400" />
                <div>
                  <p class="font-medium text-slate-700 dark:text-slate-200">Start from a template</p>
                  <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Or use the AI tab to generate one.</p>
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <UButton
                    v-for="t in templateItems"
                    :key="t.value"
                    block
                    size="sm"
                    variant="soft"
                    :label="t.label"
                    @click="onTemplateSelect(t.value)"
                  />
                </div>
              </div>
            </div>
            <div
              v-else
              class="grid h-[58vh] place-items-center rounded-lg border border-dashed border-slate-300 bg-white text-center text-sm text-slate-400 dark:border-slate-600 dark:bg-slate-900 sm:h-[70vh] lg:h-[calc(100vh-8rem)]"
            >
              <div class="space-y-1">
                <UIcon name="i-lucide-file-text" class="mx-auto size-7 opacity-50" />
                <p>Preview will appear here</p>
                <p v-if="validationErrors.length" class="text-xs text-red-500">Fix errors to render</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
