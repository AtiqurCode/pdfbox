<script setup lang="ts">
import type { ImageBlock, PdfBlock, PdfSection, RichTextSpan, TableBlock } from '~/types/pdf'
import { newId } from '~/utils/id'

const props = defineProps<{
  modelValue: PdfSection
  title: string
  allowTables?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: PdfSection): void
}>()

const toast = useToast()
const rewritingId = ref<string | null>(null)

const section = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

const pendingDeleteId = ref<string | null>(null)

function updateBlock(id: string, updater: (b: PdfBlock) => PdfBlock) {
  const next = clone(section.value)
  const idx = next.blocks.findIndex((b) => b.id === id)
  if (idx === -1) return
  next.blocks[idx] = updater(next.blocks[idx]!)
  section.value = next
}

function confirmDelete(id: string) {
  pendingDeleteId.value = id
}

function cancelDelete() {
  pendingDeleteId.value = null
}

function executeDelete() {
  if (!pendingDeleteId.value) return
  const next = clone(section.value)
  next.blocks = next.blocks.filter((b) => b.id !== pendingDeleteId.value)
  section.value = next
  pendingDeleteId.value = null
}

function moveBlock(id: string, direction: -1 | 1) {
  const next = clone(section.value)
  const idx = next.blocks.findIndex((b) => b.id === id)
  if (idx === -1) return
  const target = idx + direction
  if (target < 0 || target >= next.blocks.length) return
  const tmp = next.blocks[idx]!
  next.blocks[idx] = next.blocks[target]!
  next.blocks[target] = tmp
  section.value = next
}

type BlockKind = 'heading' | 'paragraph' | 'image' | 'table'

function makeBlock(kind: BlockKind): PdfBlock {
  if (kind === 'heading') return { id: newId('h'), type: 'heading', level: 2, text: 'Heading' }
  if (kind === 'image') {
    const b: ImageBlock = {
      id: newId('img'),
      type: 'image',
      dataUrl: 'data:image/png;base64,' as any,
      align: 'left',
      opacity: 1
    }
    return b
  }
  if (kind === 'table') {
    const t: TableBlock = {
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
    return t
  }
  return { id: newId('p'), type: 'paragraph', spans: [{ text: 'Paragraph text' }] }
}

/** Insert a new block at a given index (defaults to the end). */
function insertAt(kind: BlockKind, index?: number) {
  const next = clone(section.value)
  const at = index == null ? next.blocks.length : Math.max(0, Math.min(index, next.blocks.length))
  next.blocks.splice(at, 0, makeBlock(kind))
  section.value = next
}

/** Items for the single "+ Add" dropdown menu (optionally at a specific index). */
function addItems(index?: number) {
  const items = [
    { label: 'Heading', icon: 'i-lucide-heading', onSelect: () => insertAt('heading', index) },
    { label: 'Paragraph', icon: 'i-lucide-text', onSelect: () => insertAt('paragraph', index) },
    { label: 'Image', icon: 'i-lucide-image', onSelect: () => insertAt('image', index) }
  ]
  if (props.allowTables) {
    items.push({ label: 'Table', icon: 'i-lucide-table', onSelect: () => insertAt('table', index) })
  }
  return items
}

function duplicateBlock(id: string) {
  const next = clone(section.value)
  const idx = next.blocks.findIndex((b) => b.id === id)
  if (idx === -1) return
  const copy = clone(next.blocks[idx]!)
  copy.id = newId(copy.type[0] ?? 'b')
  next.blocks.splice(idx + 1, 0, copy)
  section.value = next
}

// ── Drag to reorder ──────────────────────────────────────────────────────────
const dragIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)

function onDragStart(index: number, e: DragEvent) {
  dragIndex.value = index
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    // Firefox requires data to be set for dragging to start
    e.dataTransfer.setData('text/plain', String(index))
  }
}

function onDragOver(index: number, e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  dragOverIndex.value = index
}

function onDrop(index: number) {
  const from = dragIndex.value
  dragIndex.value = null
  dragOverIndex.value = null
  if (from == null || from === index) return
  const next = clone(section.value)
  const [moved] = next.blocks.splice(from, 1)
  if (!moved) return
  next.blocks.splice(index, 0, moved)
  section.value = next
}

function onDragEnd() {
  dragIndex.value = null
  dragOverIndex.value = null
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

function setParagraphSpans(id: string, spans: RichTextSpan[]) {
  updateBlock(id, (b) => (b.type === 'paragraph' ? { ...b, spans } : b))
}

function setParagraphAlign(id: string, align: 'left' | 'center' | 'right') {
  updateBlock(id, (b) => (b.type === 'paragraph' ? { ...b, align } : b))
}

const REWRITE_ACTIONS = [
  { label: 'Make formal', instruction: 'Rewrite in a formal, professional tone' },
  { label: 'Make casual', instruction: 'Rewrite in a friendly, casual tone' },
  { label: 'Shorten', instruction: 'Make shorter while keeping key information' },
  { label: 'Expand', instruction: 'Expand with more detail and clarity' },
  { label: 'Fix grammar', instruction: 'Fix grammar and spelling, keep meaning' }
]

function rewriteItems(block: PdfBlock) {
  return REWRITE_ACTIONS.map((a) => ({
    label: a.label,
    icon: 'i-lucide-sparkles',
    onSelect: () => rewriteBlock(block, a.instruction)
  }))
}

async function rewriteBlock(block: PdfBlock, instruction: string) {
  if (block.type === 'image') return
  rewritingId.value = block.id
  try {
    const next = await $fetch<PdfBlock>('/api/ai/rewrite', {
      method: 'POST',
      body: { block, instruction }
    })
    updateBlock(block.id, () => next)
    toast.add({ title: 'Block rewritten', color: 'success' })
  } catch (e: any) {
    const msg = e?.data?.message || e?.message || 'Rewrite failed'
    toast.add({ title: 'AI failed', description: msg, color: 'error' })
  } finally {
    rewritingId.value = null
  }
}

async function onImageFilePicked(blockId: string, file: File | null) {
  if (!file) return
  const dataUrl = await fileToDataUrl(file)
  updateBlock(blockId, (b) => (b.type === 'image' ? { ...b, dataUrl: dataUrl as any } : b))
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onerror = () => reject(new Error('Failed to read file'))
    r.onload = () => resolve(String(r.result ?? ''))
    r.readAsDataURL(file)
  })
}
</script>

<template>
  <div>
    <div class="mb-3 flex items-center justify-between gap-1">
      <span class="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">{{ title }}</span>
      <UDropdownMenu :items="addItems()">
        <UButton size="xs" color="primary" variant="soft" icon="i-lucide-plus" label="Add" trailing-icon="i-lucide-chevron-down" />
      </UDropdownMenu>
    </div>

    <div class="space-y-1">
      <div v-if="section.blocks.length === 0" class="rounded-lg border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-400 dark:border-slate-600 dark:text-slate-500">
        Nothing here yet — add a heading, paragraph, image{{ allowTables ? ', or table' : '' }} above.
      </div>

      <div v-for="(block, blockIndex) in section.blocks" :key="block.id">
        <!-- Insert-between divider -->
        <div class="group/insert relative flex h-3 items-center justify-center">
          <div class="absolute inset-x-0 top-1/2 hidden -translate-y-1/2 items-center justify-center gap-2 group-hover/insert:flex">
            <span class="h-px flex-1 bg-violet-200 dark:bg-violet-900/60" />
            <UDropdownMenu :items="addItems(blockIndex)">
              <UButton size="xs" color="primary" variant="soft" icon="i-lucide-plus" title="Insert block here" />
            </UDropdownMenu>
            <span class="h-px flex-1 bg-violet-200 dark:bg-violet-900/60" />
          </div>
        </div>

        <div
          class="rounded-lg border bg-white transition-colors dark:bg-slate-800/60"
          :class="[
            dragOverIndex === blockIndex && dragIndex !== null && dragIndex !== blockIndex
              ? 'border-violet-400 ring-2 ring-violet-200 dark:ring-violet-900/50'
              : 'border-slate-200 dark:border-slate-700',
            dragIndex === blockIndex ? 'opacity-50' : ''
          ]"
          @dragover="onDragOver(blockIndex, $event)"
          @drop="onDrop(blockIndex)"
        >
          <div class="flex items-center justify-between border-b border-slate-100 px-4 py-2 dark:border-slate-700/60">
            <div class="flex items-center gap-2">
              <button
                type="button"
                draggable="true"
                class="cursor-grab text-slate-400 hover:text-slate-600 active:cursor-grabbing dark:text-slate-500 dark:hover:text-slate-300"
                title="Drag to reorder"
                @dragstart="onDragStart(blockIndex, $event)"
                @dragend="onDragEnd"
              >
                <UIcon name="i-lucide-grip-vertical" class="size-4" />
              </button>
              <UBadge variant="soft" size="xs">
                <span v-if="block.type === 'heading'">Heading</span>
                <span v-else-if="block.type === 'paragraph'">Paragraph</span>
                <span v-else-if="block.type === 'image'">Image</span>
                <span v-else>Table</span>
              </UBadge>
            </div>
            <div class="flex items-center gap-1 opacity-70 hover:opacity-100">
              <UDropdownMenu
                v-if="block.type !== 'image'"
                :items="rewriteItems(block)"
                :content="{ align: 'end' }"
              >
                <UButton
                  size="xs"
                  variant="ghost"
                  icon="i-lucide-sparkles"
                  title="Rewrite with AI"
                  :loading="rewritingId === block.id"
                  :disabled="rewritingId !== null && rewritingId !== block.id"
                />
              </UDropdownMenu>
              <UButton
                size="xs"
                variant="ghost"
                icon="i-lucide-chevron-up"
                :disabled="blockIndex === 0"
                title="Move up"
                @click="moveBlock(block.id, -1)"
              />
              <UButton
                size="xs"
                variant="ghost"
                icon="i-lucide-chevron-down"
                :disabled="blockIndex === section.blocks.length - 1"
                title="Move down"
                @click="moveBlock(block.id, 1)"
              />
              <UButton
                size="xs"
                variant="ghost"
                icon="i-lucide-copy"
                title="Duplicate"
                @click="duplicateBlock(block.id)"
              />
              <UButton
                size="xs"
                color="error"
                variant="ghost"
                icon="i-lucide-trash-2"
                title="Delete"
                @click="confirmDelete(block.id)"
              />
            </div>
          </div>

          <div
            v-if="pendingDeleteId === block.id"
            class="flex items-center justify-between border-b border-red-100 bg-red-50 px-4 py-2 dark:border-red-900/40 dark:bg-red-950/40"
          >
            <span class="text-sm text-red-700 dark:text-red-400">Delete this block?</span>
            <div class="flex items-center gap-2">
              <UButton size="xs" variant="soft" label="Cancel" @click="cancelDelete" />
              <UButton size="xs" color="error" label="Delete" @click="executeDelete" />
            </div>
          </div>

          <div class="p-4">
            <!-- HEADING -->
            <div v-if="block.type === 'heading'" class="space-y-3">
              <UFormField label="Level" size="sm">
                <USelect
                  :model-value="block.level"
                  :items="[
                    { label: 'H1 — Large title', value: 1 },
                    { label: 'H2 — Section', value: 2 },
                    { label: 'H3 — Subsection', value: 3 }
                  ]"
                  @update:model-value="
                    (v) => updateBlock(block.id, (b) => (b.type === 'heading' ? { ...b, level: v as 1 | 2 | 3 } : b))
                  "
                />
              </UFormField>
              <UFormField label="Text" size="sm">
                <UInput
                  :model-value="block.text"
                  placeholder="Heading text"
                  size="lg"
                  @update:model-value="
                    (v) => updateBlock(block.id, (b) => (b.type === 'heading' ? { ...b, text: String(v) } : b))
                  "
                />
              </UFormField>
            </div>

            <!-- PARAGRAPH -->
            <div v-else-if="block.type === 'paragraph'">
              <RichTextEditor
                :model-value="block.spans"
                :align="block.align"
                @update:model-value="(spans) => setParagraphSpans(block.id, spans)"
                @update:align="(a) => setParagraphAlign(block.id, a)"
              />
            </div>

            <!-- IMAGE -->
            <div v-else-if="block.type === 'image'" class="space-y-3">
              <UFormField label="Image" size="sm" help="PNG/JPG recommended.">
                <input
                  type="file"
                  accept="image/*"
                  class="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-violet-700 hover:file:bg-violet-100 dark:text-slate-300 dark:file:bg-violet-950 dark:file:text-violet-300 dark:hover:file:bg-violet-900/60"
                  @change="onImageFilePicked(block.id, (($event.target as HTMLInputElement).files?.[0] ?? null))"
                />
              </UFormField>

              <div class="grid grid-cols-2 gap-2">
                <UFormField label="Width (pt)" size="sm" help="Optional">
                  <input
                    type="number"
                    class="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-violet-500 dark:focus:ring-violet-900/40"
                    :value="block.widthPt ?? ''"
                    placeholder="auto"
                    @input="
                      (e) =>
                        updateBlock(block.id, (b) => {
                          if (b.type !== 'image') return b
                          const v = (e.target as HTMLInputElement).value
                          return { ...b, widthPt: v === '' ? undefined : Number(v) || undefined }
                        })
                    "
                  />
                </UFormField>
                <UFormField label="Height (pt)" size="sm" help="Optional">
                  <input
                    type="number"
                    class="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-violet-500 dark:focus:ring-violet-900/40"
                    :value="block.heightPt ?? ''"
                    placeholder="auto"
                    @input="
                      (e) =>
                        updateBlock(block.id, (b) => {
                          if (b.type !== 'image') return b
                          const v = (e.target as HTMLInputElement).value
                          return { ...b, heightPt: v === '' ? undefined : Number(v) || undefined }
                        })
                    "
                  />
                </UFormField>
              </div>

              <div class="grid grid-cols-2 gap-2">
                <UFormField label="Align" size="sm">
                  <USelect
                    :model-value="block.align ?? 'left'"
                    :items="[
                      { label: 'Left', value: 'left' },
                      { label: 'Center', value: 'center' },
                      { label: 'Right', value: 'right' }
                    ]"
                    @update:model-value="(v) => updateBlock(block.id, (b) => (b.type === 'image' ? { ...b, align: v as any } : b))"
                  />
                </UFormField>
                <UFormField label="Opacity" size="sm" help="0..1">
                  <UInput
                    type="number"
                    :model-value="block.opacity ?? 1"
                    step="0.05"
                    min="0"
                    max="1"
                    @update:model-value="
                      (v) =>
                        updateBlock(block.id, (b) =>
                          b.type === 'image'
                            ? { ...b, opacity: Math.min(1, Math.max(0, Number(v) || 0)) }
                            : b
                        )
                    "
                  />
                </UFormField>
              </div>

              <div v-if="block.dataUrl && String(block.dataUrl).startsWith('data:image')"
                   class="rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-900">
                <img :src="block.dataUrl" alt="" class="max-h-40 w-auto rounded" />
              </div>
            </div>

            <!-- TABLE -->
            <div v-else class="space-y-3">
              <div class="flex items-center gap-3">
                <UFormField label="Rows" size="sm" class="w-24">
                  <UInput
                    type="number"
                    :model-value="block.rows"
                    @update:model-value="
                      (v) =>
                        updateBlock(block.id, (b) => {
                          if (b.type !== 'table') return b
                          const rows = Math.max(1, Number(v) || 1)
                          const cells = b.cells.slice(0, rows)
                          while (cells.length < rows) {
                            cells.push(Array.from({ length: b.columns }, () => ({ text: '' })))
                          }
                          return { ...b, rows, cells }
                        })
                    "
                  />
                </UFormField>
                <UFormField label="Columns" size="sm" class="w-24">
                  <UInput
                    type="number"
                    :model-value="block.columns"
                    @update:model-value="
                      (v) =>
                        updateBlock(block.id, (b) => {
                          if (b.type !== 'table') return b
                          const columns = Math.max(1, Number(v) || 1)
                          const cells = b.cells.map((row) => {
                            const next = row.slice(0, columns)
                            while (next.length < columns) next.push({ text: '' })
                            return next
                          })
                          return { ...b, columns, cells }
                        })
                    "
                  />
                </UFormField>
              </div>

              <div class="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <table class="min-w-full border-collapse">
                  <tbody>
                    <tr v-for="r in block.rows" :key="r" class="border-b border-slate-100 last:border-b-0 dark:border-slate-700">
                      <td
                        v-for="c in block.columns"
                        :key="c"
                        class="border-r border-slate-100 p-1 last:border-r-0 dark:border-slate-700"
                      >
                        <UInput
                          size="xs"
                          :model-value="block.cells[r - 1]?.[c - 1]?.text ?? ''"
                          @update:model-value="
                            (v) =>
                              updateBlock(block.id, (b) => {
                                if (b.type !== 'table') return b
                                const cells = clone(b.cells)
                                cells[r - 1] ??= []
                                cells[r - 1]![c - 1] ??= { text: '' }
                                cells[r - 1]![c - 1]!.text = String(v)
                                return { ...b, cells }
                              })
                          "
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
