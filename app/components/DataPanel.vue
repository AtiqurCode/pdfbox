<script setup lang="ts">
const mergeRows = defineModel<{ key: string; value: string }[]>('mergeRows', { required: true })
const batchNamePattern = defineModel<string>('batchNamePattern', { required: true })

const props = defineProps<{
  batchRows: Record<string, unknown>[]
  batchColumns: string[]
  batchSourceName: string
  isGenerating: boolean
  isPreviewing: boolean
  tokenExample: string
  dottedExample: string
  namePatternPlaceholder: string
  namePatternHelp: string
}>()

const emit = defineEmits<{
  (e: 'csv-picked', file: File | null): void
  (e: 'clear-batch'): void
  (e: 'batch-generate'): void
  (e: 'font-picked', style: 'regular' | 'bold' | 'italic' | 'boldItalic', file: File | null): void
  (e: 'clear-font', style: 'regular' | 'bold' | 'italic' | 'boldItalic'): void
  (e: 'merge-suggested', fields: { key: string; value: string }[]): void
}>()

const toast = useToast()
const runtimeConfig = useRuntimeConfig()
const fontsOpen = ref(false)
const isSuggestingMerge = ref(false)
const csvInput = ref<HTMLInputElement | null>(null)

// Avoid nested `{{ }}` in template
const dottedTokenExample = computed(() => `{{${props.dottedExample}}}`)

const fontStyles = [
  { key: 'regular' as const, label: 'Regular' },
  { key: 'bold' as const, label: 'Bold' },
  { key: 'italic' as const, label: 'Italic' },
  { key: 'boldItalic' as const, label: 'Bold italic' }
]

const steps = [
  { num: 1, title: 'Add fields', desc: 'Name each placeholder and a sample value' },
  { num: 2, title: 'Use in text', desc: 'Type tokens like {{client.name}} in headings or paragraphs' },
  { num: 3, title: 'Export', desc: 'Download one PDF, or batch-generate from a CSV' }
]

const hasMergeFields = computed(() => mergeRows.value.some((r) => r.key.trim()))

function addField() {
  mergeRows.value.push({ key: '', value: '' })
}

function removeField(index: number) {
  mergeRows.value.splice(index, 1)
}

function onCsvChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0] ?? null
  emit('csv-picked', file)
}

function openCsvPicker() {
  csvInput.value?.click()
}

async function suggestMergeFields() {
  if (!runtimeConfig.public.aiEnabled) {
    toast.add({ title: 'AI not configured', color: 'warning' })
    return
  }
  isSuggestingMerge.value = true
  try {
    const result = await $fetch<{ fields: { key: string; value: string }[] }>('/api/ai/suggest-merge', {
      method: 'POST',
      body: {
        columns: props.batchColumns.length ? props.batchColumns : undefined,
        sampleRow: props.batchRows[0],
        prompt: props.batchColumns.length
          ? 'Map CSV columns to merge fields.'
          : 'Suggest merge fields for this document.'
      }
    })
    emit('merge-suggested', result.fields)
    toast.add({ title: 'Fields suggested', description: `${result.fields.length} fields added.`, color: 'success' })
  } catch (e: any) {
    toast.add({ title: 'Could not suggest fields', description: e?.message, color: 'error' })
  } finally {
    isSuggestingMerge.value = false
  }
}
</script>

<template>
  <div class="data-panel relative -mx-1 overflow-hidden rounded-xl">
    <div
      class="pointer-events-none absolute inset-0 bg-linear-to-br from-sky-50/80 via-white to-violet-50/50 dark:from-sky-950/25 dark:via-slate-900/30 dark:to-violet-950/20"
      aria-hidden="true"
    />

    <div class="relative space-y-5 p-4 sm:p-5">
      <!-- Header -->
      <div class="flex items-start gap-3.5">
        <div class="grid size-11 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-sky-500 to-violet-600 text-white shadow-lg shadow-sky-500/20">
          <UIcon name="i-lucide-database" class="size-5" />
        </div>
        <div>
          <h3 class="text-base font-semibold tracking-tight text-slate-900 dark:text-white">
            Data & personalization
          </h3>
          <p class="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Fill placeholders in your PDF — one document or hundreds from a spreadsheet.
          </p>
        </div>
      </div>

      <!-- How it works -->
      <div class="grid gap-2 sm:grid-cols-3">
        <div
          v-for="step in steps"
          :key="step.num"
          class="rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2.5 dark:border-slate-700/60 dark:bg-slate-800/40"
        >
          <div class="mb-1 flex items-center gap-2">
            <span class="grid size-5 place-items-center rounded-full bg-sky-100 text-[10px] font-bold text-sky-700 dark:bg-sky-950 dark:text-sky-300">
              {{ step.num }}
            </span>
            <span class="text-xs font-semibold text-slate-800 dark:text-slate-100">{{ step.title }}</span>
          </div>
          <p class="text-[11px] leading-snug text-slate-500 dark:text-slate-400">{{ step.desc }}</p>
        </div>
      </div>

      <!-- Merge fields -->
      <section class="rounded-xl border border-slate-200/80 bg-white/90 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/60">
        <div class="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-braces" class="size-4 text-violet-500" />
            <span class="text-sm font-semibold text-slate-800 dark:text-slate-100">Merge fields</span>
          </div>
          <button
            v-if="runtimeConfig.public.aiEnabled"
            type="button"
            class="inline-flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-700 disabled:opacity-50 dark:text-violet-400"
            :disabled="isSuggestingMerge"
            @click="suggestMergeFields"
          >
            <UIcon
              :name="isSuggestingMerge ? 'i-lucide-loader-circle' : 'i-lucide-sparkles'"
              class="size-3.5"
              :class="isSuggestingMerge ? 'animate-spin' : ''"
            />
            Auto-suggest
          </button>
        </div>

        <div class="p-4">
          <!-- Example callout -->
          <div class="mb-4 rounded-lg bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-600 dark:bg-slate-800/80 dark:text-slate-300">
            In your document text, write
            <code class="mx-1 rounded bg-white px-1.5 py-0.5 font-mono text-violet-600 shadow-sm dark:bg-slate-900 dark:text-violet-400">{{ tokenExample }}</code>
            or
            <code class="mx-1 rounded bg-white px-1.5 py-0.5 font-mono text-violet-600 shadow-sm dark:bg-slate-900 dark:text-violet-400">{{ dottedTokenExample }}</code>
            — we'll swap in the values below.
          </div>

          <!-- Empty state -->
          <div
            v-if="!hasMergeFields"
            class="mb-3 rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center dark:border-slate-700"
          >
            <UIcon name="i-lucide-tags" class="mx-auto mb-2 size-6 text-slate-300 dark:text-slate-600" />
            <p class="text-sm text-slate-500 dark:text-slate-400">No fields yet</p>
            <p class="mt-0.5 text-xs text-slate-400">Add a field like <span class="font-mono">client.name</span> → <span class="font-mono">Acme Corp</span></p>
          </div>

          <!-- Field table -->
          <div v-else class="mb-3 space-y-2">
            <div class="grid grid-cols-[1fr_1fr_2rem] gap-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              <span>Field name</span>
              <span>Preview value</span>
              <span />
            </div>
            <div
              v-for="(row, i) in mergeRows"
              :key="i"
              class="grid grid-cols-[1fr_1fr_2rem] items-center gap-2"
            >
              <UInput v-model="row.key" size="sm" placeholder="client.name" class="font-mono" />
              <UInput v-model="row.value" size="sm" placeholder="Acme Corp" />
              <UButton size="xs" color="error" variant="ghost" icon="i-lucide-x" @click="removeField(i)" />
            </div>
          </div>

          <UButton size="sm" variant="soft" icon="i-lucide-plus" label="Add field" @click="addField" />
        </div>
      </section>

      <!-- Batch CSV -->
      <section class="rounded-xl border border-slate-200/80 bg-white/90 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/60">
        <div class="flex items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <UIcon name="i-lucide-sheet" class="size-4 text-emerald-500" />
          <span class="text-sm font-semibold text-slate-800 dark:text-slate-100">Batch from spreadsheet</span>
        </div>

        <div class="space-y-4 p-4">
          <p class="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Upload a CSV from Excel or Google Sheets. Each row becomes its own PDF — column headers should match your field names.
          </p>

          <input
            ref="csvInput"
            type="file"
            accept=".csv,text/csv"
            class="hidden"
            @change="onCsvChange"
          />

          <!-- Upload zone -->
          <button
            v-if="!batchRows.length"
            type="button"
            class="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 transition hover:border-emerald-300 hover:bg-emerald-50/50 dark:border-slate-700 dark:bg-slate-800/30 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/20"
            @click="openCsvPicker"
          >
            <div class="grid size-10 place-items-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
              <UIcon name="i-lucide-upload" class="size-5" />
            </div>
            <span class="text-sm font-medium text-slate-700 dark:text-slate-200">Choose a CSV file</span>
            <span class="text-xs text-slate-400">or drag & drop (click to browse)</span>
          </button>

          <!-- Loaded state -->
          <div v-else class="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-start gap-3">
                <div class="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-900/60 dark:text-emerald-400">
                  <UIcon name="i-lucide-file-spreadsheet" class="size-4" />
                </div>
                <div>
                  <p class="text-sm font-medium text-slate-800 dark:text-slate-100">{{ batchSourceName }}</p>
                  <p class="text-xs text-emerald-700 dark:text-emerald-400">{{ batchRows.length }} rows ready to generate</p>
                </div>
              </div>
              <div class="flex gap-1">
                <UButton size="xs" variant="ghost" label="Replace" @click="openCsvPicker" />
                <UButton size="xs" variant="ghost" color="error" label="Remove" @click="emit('clear-batch')" />
              </div>
            </div>
            <div class="mt-3 flex flex-wrap gap-1">
              <UBadge v-for="col in batchColumns" :key="col" size="xs" variant="soft" color="success" class="font-mono">
                {{ col }}
              </UBadge>
            </div>
          </div>

          <UFormField label="Output file names" size="sm" :help="namePatternHelp">
            <UInput v-model="batchNamePattern" :placeholder="namePatternPlaceholder" class="font-mono text-sm" />
          </UFormField>

          <button
            type="button"
            class="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
            :class="batchRows.length ? 'bg-linear-to-r from-emerald-600 to-teal-600 shadow-md shadow-emerald-500/20 hover:from-emerald-500 hover:to-teal-500' : 'bg-slate-300 dark:bg-slate-700'"
            :disabled="!batchRows.length || isGenerating || isPreviewing"
            @click="emit('batch-generate')"
          >
            <UIcon :name="isGenerating ? 'i-lucide-loader-circle' : 'i-lucide-package'" class="size-4" :class="isGenerating ? 'animate-spin' : ''" />
            {{ batchRows.length ? `Generate ${batchRows.length} PDFs as ZIP` : 'Upload a CSV to enable batch' }}
          </button>
        </div>
      </section>

      <!-- Custom fonts -->
      <section class="rounded-xl border border-slate-200/80 bg-white/70 dark:border-slate-700/60 dark:bg-slate-900/40">
        <button
          type="button"
          class="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
          @click="fontsOpen = !fontsOpen"
        >
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-type" class="size-4 text-slate-400" />
            <span class="text-sm font-medium text-slate-700 dark:text-slate-200">Custom fonts</span>
            <span class="text-xs text-slate-400">TTF / OTF — optional</span>
          </div>
          <UIcon :name="fontsOpen ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="size-4 text-slate-400" />
        </button>
        <div v-if="fontsOpen" class="space-y-2 border-t border-slate-100 px-4 pb-4 pt-3 dark:border-slate-800">
          <div
            v-for="f in fontStyles"
            :key="f.key"
            class="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/50"
          >
            <span class="w-20 shrink-0 text-xs font-medium text-slate-600 dark:text-slate-300">{{ f.label }}</span>
            <input
              type="file"
              accept=".ttf,.otf,font/ttf,font/otf"
              class="min-w-0 flex-1 text-xs text-slate-600 file:mr-2 file:rounded file:border-0 file:bg-violet-50 file:px-2 file:py-1 file:text-xs file:font-medium file:text-violet-700 dark:text-slate-300 dark:file:bg-violet-950 dark:file:text-violet-300"
              @change="emit('font-picked', f.key, (($event.target as HTMLInputElement).files?.[0] ?? null))"
            />
            <UButton size="xs" variant="ghost" label="Clear" @click="emit('clear-font', f.key)" />
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
