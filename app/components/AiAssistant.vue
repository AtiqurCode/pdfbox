<script setup lang="ts">
import { usePdfDesignerStore } from '~/stores/pdfDesigner'
import type { PdfDocumentConfig } from '~/types/pdf'

const props = defineProps<{
  batchColumns?: string[]
  batchSampleRow?: Record<string, unknown>
}>()

const emit = defineEmits<{
  (e: 'merge-suggested', fields: { key: string; value: string }[]): void
}>()

const store = usePdfDesignerStore()
const toast = useToast()
const runtimeConfig = useRuntimeConfig()

const prompt = ref('')
const mode = ref<'replace' | 'merge-body' | 'improve'>('replace')
const isGenerating = ref(false)
const isSuggestingMerge = ref(false)
const promptFocused = ref(false)

const modes = [
  {
    value: 'replace' as const,
    label: 'New doc',
    description: 'Replace everything',
    icon: 'i-lucide-file-plus'
  },
  {
    value: 'merge-body' as const,
    label: 'Add body',
    description: 'Keep header & footer',
    icon: 'i-lucide-text'
  },
  {
    value: 'improve' as const,
    label: 'Improve',
    description: 'Polish current doc',
    icon: 'i-lucide-wand-sparkles'
  }
]

const examples = [
  {
    label: 'Invoice',
    prompt: 'Professional invoice for a freelance web developer with line items table',
    icon: 'i-lucide-receipt',
    tint: 'from-emerald-500/15 to-teal-500/5 text-emerald-700 dark:text-emerald-300'
  },
  {
    label: 'Report',
    prompt: 'Quarterly business report with executive summary and data table',
    icon: 'i-lucide-bar-chart-3',
    tint: 'from-blue-500/15 to-cyan-500/5 text-blue-700 dark:text-blue-300'
  },
  {
    label: 'Letter',
    prompt: 'Formal cover letter for a senior software engineer role',
    icon: 'i-lucide-mail',
    tint: 'from-violet-500/15 to-purple-500/5 text-violet-700 dark:text-violet-300'
  },
  {
    label: 'One-pager',
    prompt: 'Product one-pager with features list and pricing table',
    icon: 'i-lucide-layout-grid',
    tint: 'from-amber-500/15 to-orange-500/5 text-amber-700 dark:text-amber-300'
  }
]

const tokenExample = '{{field}}'
const aiReady = computed(() => runtimeConfig.public.aiEnabled)

async function generate() {
  if (!prompt.value.trim()) {
    toast.add({ title: 'Describe your PDF first', color: 'warning' })
    return
  }
  isGenerating.value = true
  try {
    const current = JSON.parse(JSON.stringify(toRaw(store.config))) as PdfDocumentConfig
    const result = await $fetch<PdfDocumentConfig>('/api/ai/generate', {
      method: 'POST',
      body: {
        prompt: prompt.value.trim(),
        mode: mode.value,
        currentConfig: mode.value === 'replace' ? undefined : current
      }
    })
    store.applyAiConfig(result, { mergeBody: mode.value === 'merge-body' })
    toast.add({
      title: 'Document generated',
      description: mode.value === 'merge-body' ? 'Body content updated.' : 'AI layout applied.',
      color: 'success'
    })
  } catch (e: any) {
    const msg = e?.data?.message || e?.message || 'AI generation failed'
    toast.add({ title: 'AI failed', description: msg, color: 'error' })
  } finally {
    isGenerating.value = false
  }
}

async function suggestMergeFields() {
  isSuggestingMerge.value = true
  try {
    const result = await $fetch<{ fields: { key: string; value: string }[]; templateHint?: string }>(
      '/api/ai/suggest-merge',
      {
        method: 'POST',
        body: {
          documentTitle: store.config.title,
          columns: props.batchColumns,
          sampleRow: props.batchSampleRow,
          prompt: props.batchColumns?.length
            ? 'Map CSV columns to merge fields for this document.'
            : 'Suggest merge fields based on the current document content.'
        }
      }
    )
    emit('merge-suggested', result.fields)
    toast.add({
      title: 'Merge fields suggested',
      description: result.templateHint || `${result.fields.length} fields added.`,
      color: 'success'
    })
  } catch (e: any) {
    const msg = e?.data?.message || e?.message || 'Could not suggest merge fields'
    toast.add({ title: 'AI failed', description: msg, color: 'error' })
  } finally {
    isSuggestingMerge.value = false
  }
}

function useExample(text: string) {
  prompt.value = text
}
</script>

<template>
  <div class="ai-panel relative -mx-1 overflow-hidden rounded-xl">
    <!-- Ambient background -->
    <div
      class="pointer-events-none absolute inset-0 bg-linear-to-br from-violet-100/70 via-white to-indigo-50/60 dark:from-violet-950/40 dark:via-slate-900/30 dark:to-indigo-950/30"
      aria-hidden="true"
    />
    <div
      class="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-violet-400/20 blur-3xl dark:bg-violet-600/10"
      aria-hidden="true"
    />
    <div
      class="pointer-events-none absolute -bottom-20 -left-10 size-40 rounded-full bg-indigo-400/15 blur-3xl dark:bg-indigo-600/10"
      aria-hidden="true"
    />

    <div class="relative space-y-5 p-4 sm:p-5">
      <!-- Header -->
      <div class="flex items-start gap-3.5">
        <div
          class="grid size-11 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/30"
        >
          <UIcon name="i-lucide-sparkles" class="size-5" />
        </div>
        <div class="min-w-0 pt-0.5">
          <h3 class="text-base font-semibold tracking-tight text-slate-900 dark:text-white">
            AI Document Generator
          </h3>
          <p class="mt-0.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            Describe what you need — layout, tables, merge fields included.
          </p>
        </div>
      </div>

      <!-- API key warning -->
      <div
        v-if="!aiReady"
        class="flex items-center gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/90 px-3.5 py-2.5 text-xs text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-200"
      >
        <UIcon name="i-lucide-key" class="size-4 shrink-0" />
        <span>Add <code class="font-mono font-medium">GROQ_API_KEY</code> to <code class="font-mono">.env</code> and restart.</span>
      </div>

      <!-- Mode selector -->
      <div class="grid grid-cols-3 gap-2">
        <button
          v-for="m in modes"
          :key="m.value"
          type="button"
          class="group relative rounded-xl border px-2.5 py-2.5 text-left transition-all duration-200"
          :class="
            mode === m.value
              ? 'border-violet-300 bg-white shadow-md shadow-violet-500/10 ring-2 ring-violet-500/20 dark:border-violet-600 dark:bg-slate-800 dark:ring-violet-500/30'
              : 'border-transparent bg-white/60 hover:border-slate-200 hover:bg-white dark:bg-slate-800/40 dark:hover:border-slate-600 dark:hover:bg-slate-800/80'
          "
          :disabled="isGenerating"
          @click="mode = m.value"
        >
          <UIcon
            :name="m.icon"
            class="mb-1.5 size-4 transition-colors"
            :class="mode === m.value ? 'text-violet-600 dark:text-violet-400' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'"
          />
          <div class="text-xs font-semibold text-slate-800 dark:text-slate-100">{{ m.label }}</div>
          <div class="mt-0.5 text-[10px] leading-tight text-slate-500 dark:text-slate-400">{{ m.description }}</div>
        </button>
      </div>

      <!-- Prompt -->
      <div
        class="rounded-xl border bg-white/90 p-1 shadow-sm backdrop-blur transition-all duration-200 dark:bg-slate-900/70"
        :class="
          promptFocused
            ? 'border-violet-300 shadow-md shadow-violet-500/10 ring-2 ring-violet-500/15 dark:border-violet-600'
            : 'border-slate-200/80 dark:border-slate-700/80'
        "
      >
        <label class="sr-only" for="ai-prompt">Describe your PDF</label>
        <textarea
          id="ai-prompt"
          v-model="prompt"
          rows="4"
          :disabled="isGenerating"
          placeholder="e.g. A polished invoice for a design agency with client details, line items table, subtotal/tax/total, and 30-day payment terms…"
          class="w-full resize-none rounded-lg bg-transparent px-3 py-2.5 text-sm leading-relaxed text-slate-800 placeholder:text-slate-400 focus:outline-none disabled:opacity-60 dark:text-slate-100 dark:placeholder:text-slate-500"
          @focus="promptFocused = true"
          @blur="promptFocused = false"
        />
      </div>

      <!-- Generate CTA -->
      <button
        type="button"
        class="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
        :class="
          aiReady && !isGenerating
            ? 'bg-linear-to-r from-violet-600 to-indigo-600 shadow-violet-500/25 hover:from-violet-500 hover:to-indigo-500 hover:shadow-violet-500/35 active:scale-[0.99]'
            : 'bg-linear-to-r from-slate-400 to-slate-500 shadow-none'
        "
        :disabled="!aiReady || isGenerating"
        @click="generate"
      >
        <span
          v-if="isGenerating"
          class="absolute inset-0 animate-pulse bg-linear-to-r from-violet-400/30 to-indigo-400/30"
        />
        <UIcon
          :name="isGenerating ? 'i-lucide-loader-circle' : 'i-lucide-sparkles'"
          class="relative size-4"
          :class="isGenerating ? 'animate-spin' : ''"
        />
        <span class="relative">{{ isGenerating ? 'Generating your PDF…' : 'Generate document' }}</span>
      </button>

      <!-- Quick start -->
      <div>
        <p class="mb-2.5 text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
          Quick start
        </p>
        <div class="grid grid-cols-2 gap-2">
          <button
            v-for="ex in examples"
            :key="ex.label"
            type="button"
            class="group flex items-center gap-2.5 rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2.5 text-left transition-all hover:border-violet-200 hover:bg-white hover:shadow-sm dark:border-slate-700/60 dark:bg-slate-800/50 dark:hover:border-violet-800 dark:hover:bg-slate-800"
            :disabled="isGenerating"
            @click="useExample(ex.prompt)"
          >
            <div
              class="grid size-8 shrink-0 place-items-center rounded-lg bg-linear-to-br"
              :class="ex.tint"
            >
              <UIcon :name="ex.icon" class="size-4" />
            </div>
            <span class="text-xs font-medium text-slate-700 group-hover:text-violet-700 dark:text-slate-200 dark:group-hover:text-violet-300">
              {{ ex.label }}
            </span>
          </button>
        </div>
      </div>

      <!-- Footer actions -->
      <div class="flex items-center justify-between gap-3 border-t border-slate-200/60 pt-4 dark:border-slate-700/60">
        <p class="text-xs text-slate-400 dark:text-slate-500">
          Supports <code class="rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">{{ tokenExample }}</code> merge tokens
        </p>
        <button
          type="button"
          class="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-violet-600 transition hover:bg-violet-50 disabled:opacity-50 dark:text-violet-400 dark:hover:bg-violet-950/50"
          :disabled="!aiReady || isSuggestingMerge || isGenerating"
          @click="suggestMergeFields"
        >
          <UIcon
            :name="isSuggestingMerge ? 'i-lucide-loader-circle' : 'i-lucide-braces'"
            class="size-3.5"
            :class="isSuggestingMerge ? 'animate-spin' : ''"
          />
          Suggest merge fields
        </button>
      </div>
    </div>
  </div>
</template>
