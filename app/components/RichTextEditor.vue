<script setup lang="ts">
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { StarterKit } from '@tiptap/starter-kit'
import { TextStyle, Color } from '@tiptap/extension-text-style'
import { Placeholder } from '@tiptap/extension-placeholder'
import type { RichTextSpan } from '~/types/pdf'

const props = defineProps<{
  modelValue: RichTextSpan[]
  align?: 'left' | 'center' | 'right'
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: RichTextSpan[]): void
  (e: 'update:align', value: 'left' | 'center' | 'right'): void
}>()

const COLOR_SWATCHES = ['#111827', '#dc2626', '#ea580c', '#16a34a', '#2563eb', '#7c3aed', '#6b7280']

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** Render our span model into the HTML Tiptap will load. */
function spansToHtml(spans: RichTextSpan[]): string {
  if (!spans?.length) return '<p></p>'
  const inner = spans
    .map((s) => {
      let html = escapeHtml(s.text ?? '')
      if (html.length === 0) return ''
      if (s.color) html = `<span style="color:${escapeHtml(s.color)}">${html}</span>`
      if (s.italic) html = `<em>${html}</em>`
      if (s.bold) html = `<strong>${html}</strong>`
      return html
    })
    .join('')
  return `<p>${inner || ''}</p>`
}

/** Walk the editor doc and flatten it back into our span model. */
function editorToSpans(json: any): RichTextSpan[] {
  const spans: RichTextSpan[] = []
  const blocks: any[] = Array.isArray(json?.content) ? json.content : []
  blocks.forEach((block, blockIdx) => {
    const inline: any[] = Array.isArray(block?.content) ? block.content : []
    for (const node of inline) {
      if (node?.type !== 'text' || typeof node.text !== 'string' || node.text.length === 0) continue
      const marks: any[] = Array.isArray(node.marks) ? node.marks : []
      const bold = marks.some((m) => m.type === 'bold')
      const italic = marks.some((m) => m.type === 'italic')
      const color = marks.find((m) => m.type === 'textStyle')?.attrs?.color as string | undefined
      const span: RichTextSpan = { text: node.text }
      if (bold) span.bold = true
      if (italic) span.italic = true
      if (color) span.color = color as `#${string}`
      spans.push(span)
    }
    // Preserve word separation between paragraphs (the renderer flattens newlines).
    if (blockIdx < blocks.length - 1 && spans.length > 0) spans.push({ text: ' ' })
  })
  return spans
}

let isInternalUpdate = false

const editor = useEditor({
  content: spansToHtml(props.modelValue),
  immediatelyRender: false,
  extensions: [
    StarterKit.configure({
      heading: false,
      bulletList: false,
      orderedList: false,
      listItem: false,
      blockquote: false,
      codeBlock: false,
      code: false,
      horizontalRule: false,
      strike: false,
      link: false
    }),
    TextStyle,
    Color,
    Placeholder.configure({ placeholder: 'Write your content here…' })
  ],
  editorProps: {
    attributes: {
      class:
        'tiptap prose-sm min-h-[7rem] w-full rounded-b-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-900 outline-none focus:bg-white dark:bg-slate-900 dark:text-slate-100 dark:focus:bg-slate-800'
    }
  },
  onUpdate({ editor }) {
    isInternalUpdate = true
    emit('update:modelValue', editorToSpans(editor.getJSON()))
  }
})

// Reflect external changes (undo/redo, template load) without clobbering typing.
watch(
  () => props.modelValue,
  (next) => {
    if (isInternalUpdate) {
      isInternalUpdate = false
      return
    }
    const ed = editor.value
    if (!ed) return
    const current = editorToSpans(ed.getJSON())
    if (JSON.stringify(current) === JSON.stringify(next)) return
    ed.commands.setContent(spansToHtml(next), { emitUpdate: false })
  },
  { deep: true }
)

const activeColor = computed(() => {
  const c = editor.value?.getAttributes('textStyle')?.color
  return typeof c === 'string' ? c : '#111827'
})

function setColor(color: string) {
  editor.value?.chain().focus().setColor(color).run()
}
function clearColor() {
  editor.value?.chain().focus().unsetColor().run()
}

onBeforeUnmount(() => {
  editor.value?.destroy()
})
</script>

<template>
  <div class="overflow-hidden rounded-lg border border-slate-200 focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-100 dark:border-slate-600 dark:focus-within:border-violet-500 dark:focus-within:ring-violet-900/40">
    <div
      v-if="editor"
      class="flex items-center gap-0.5 border-b border-slate-200 bg-white px-1.5 py-1 dark:border-slate-700 dark:bg-slate-800"
    >
      <UButton
        size="xs"
        :variant="editor.isActive('bold') ? 'solid' : 'ghost'"
        :color="editor.isActive('bold') ? 'primary' : 'neutral'"
        icon="i-lucide-bold"
        title="Bold (Ctrl/Cmd+B)"
        @click="editor.chain().focus().toggleBold().run()"
      />
      <UButton
        size="xs"
        :variant="editor.isActive('italic') ? 'solid' : 'ghost'"
        :color="editor.isActive('italic') ? 'primary' : 'neutral'"
        icon="i-lucide-italic"
        title="Italic (Ctrl/Cmd+I)"
        @click="editor.chain().focus().toggleItalic().run()"
      />

      <USeparator orientation="vertical" class="mx-0.5 h-5" />

      <!-- Text color (collapsed into a popover to keep the toolbar on one line) -->
      <UPopover :content="{ align: 'start' }">
        <UButton size="xs" variant="ghost" color="neutral" title="Text color">
          <span class="flex items-center gap-0.5">
            <span class="text-sm font-semibold leading-none">A</span>
            <span class="block h-1 w-3.5 rounded-full" :style="{ backgroundColor: activeColor }" />
          </span>
        </UButton>
        <template #content>
          <div class="w-44 p-2">
            <div class="grid grid-cols-7 gap-1.5">
              <button
                v-for="c in COLOR_SWATCHES"
                :key="c"
                type="button"
                class="size-5 rounded-full border border-slate-200 transition hover:scale-110 dark:border-slate-600"
                :style="{ backgroundColor: c }"
                :title="`Set text color ${c}`"
                @click="setColor(c)"
              />
            </div>
            <div class="mt-2 flex items-center justify-between gap-2 border-t border-slate-100 pt-2 dark:border-slate-700">
              <label class="flex cursor-pointer items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                <span class="relative block size-5 overflow-hidden rounded-full border border-slate-200 dark:border-slate-600" :style="{ backgroundColor: activeColor }">
                  <input
                    type="color"
                    :value="activeColor"
                    class="absolute inset-0 size-full cursor-pointer opacity-0"
                    @input="setColor(($event.target as HTMLInputElement).value)"
                  />
                </span>
                Custom
              </label>
              <UButton size="xs" variant="ghost" icon="i-lucide-eraser" label="Reset" @click="clearColor" />
            </div>
          </div>
        </template>
      </UPopover>

      <USeparator orientation="vertical" class="mx-0.5 h-5" />

      <span class="flex-1" />

      <!-- Paragraph alignment (per-block in our model) -->
      <UButton
        size="xs"
        :variant="(align ?? 'left') === 'left' ? 'solid' : 'ghost'"
        :color="(align ?? 'left') === 'left' ? 'primary' : 'neutral'"
        icon="i-lucide-align-left"
        title="Align left"
        @click="emit('update:align', 'left')"
      />
      <UButton
        size="xs"
        :variant="align === 'center' ? 'solid' : 'ghost'"
        :color="align === 'center' ? 'primary' : 'neutral'"
        icon="i-lucide-align-center"
        title="Align center"
        @click="emit('update:align', 'center')"
      />
      <UButton
        size="xs"
        :variant="align === 'right' ? 'solid' : 'ghost'"
        :color="align === 'right' ? 'primary' : 'neutral'"
        icon="i-lucide-align-right"
        title="Align right"
        @click="emit('update:align', 'right')"
      />
    </div>

    <EditorContent :editor="editor" />
  </div>
</template>
