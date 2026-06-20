<script setup lang="ts">
const url = useRequestURL()
const siteUrl = useRuntimeConfig().public.siteUrl || url.origin
const canonical = siteUrl.replace(/\/$/, '') + '/docs'
const ogImage = siteUrl.replace(/\/$/, '') + '/og.svg'

const description =
  'How to use PDFora — the free online PDF Designer. AI generation, merge fields, CSV batch export, live preview, and more.'

useSeoMeta({
  title: 'Documentation',
  description,
  ogTitle: 'PDFora Documentation — PDF Designer guide',
  ogDescription: description,
  ogType: 'article',
  ogUrl: canonical,
  ogImage,
  ogSiteName: 'PDFora',
  twitterCard: 'summary_large_image',
  twitterTitle: 'PDFora Documentation',
  twitterDescription: description,
  twitterImage: ogImage
})

useHead({
  link: [{ rel: 'canonical', href: canonical }],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        name: 'How to use PDFora — PDF Designer',
        description,
        step: [
          { '@type': 'HowToStep', name: 'Open the Designer', text: 'Start from a template or use AI to generate a document.' },
          { '@type': 'HowToStep', name: 'Edit content', text: 'Add headings, paragraphs, tables and images in the Content tab.' },
          { '@type': 'HowToStep', name: 'Style your PDF', text: 'Pick themes, colors, fonts and page layout in the Style tab.' },
          { '@type': 'HowToStep', name: 'Add data', text: 'Set merge fields and optionally batch-generate from a CSV in the Data tab.' },
          { '@type': 'HowToStep', name: 'Preview and download', text: 'Watch the live preview and download your finished PDF or ZIP.' }
        ]
      })
    }
  ]
})

// Literal token examples — embedding `{{ }}` directly in the template confuses Vue's parser.
const tk = {
  field: '{{field}}',
  client: '{{client.name}}',
  page: '{{page}}',
  pages: '{{pages}}',
  batchName: '{{title}}-{{index}}.pdf'
}

const workspaceTabs = [
  { icon: 'i-lucide-align-left', title: 'Content', text: 'Edit your document title, font, and Header / Body / Footer blocks. Add headings, rich text, tables and images. Reorder blocks by dragging or use the sparkle icon on any text block to rewrite it with AI.' },
  { icon: 'i-lucide-palette', title: 'Style', text: 'Set page size, orientation and margins. Apply a one-click theme preset or fine-tune text, heading, accent and background colors.' },
  { icon: 'i-lucide-sparkles', title: 'AI', text: 'Describe the PDF you want and generate a full layout in seconds. Choose New doc, Add body, or Improve mode. Quick-start cards help you begin with invoices, reports, letters and one-pagers.' },
  { icon: 'i-lucide-braces', title: 'Data', text: 'Add merge fields, auto-suggest placeholders with AI, upload a CSV for batch export, and optionally upload custom TTF/OTF fonts.' }
]

const features = [
  { icon: 'i-lucide-eye', title: 'Live preview', text: 'Your PDF re-renders automatically as you edit — toggle Auto on or off in the preview panel.' },
  { icon: 'i-lucide-sparkles', title: 'AI document generator', text: 'Describe any PDF and AI builds the layout — headings, tables, merge tokens and all. Rewrite individual blocks with one click.' },
  { icon: 'i-lucide-layout-template', title: 'Starter templates', text: 'Begin with Invoice, Report, Letter, or a blank canvas — then customize everything.' },
  { icon: 'i-lucide-type', title: 'Rich content blocks', text: 'Headings, rich-text paragraphs (bold, italic, color), tables and images in any order.' },
  { icon: 'i-lucide-palette', title: 'Themes & fonts', text: 'Style presets, custom colors, Helvetica / Times / Courier, plus optional custom font uploads.' },
  { icon: 'i-lucide-braces', title: 'Merge fields', text: 'Use tokens like client.name in your text and fill them with sample data or a CSV.' },
  { icon: 'i-lucide-sheet', title: 'Batch from CSV', text: 'Upload a spreadsheet — each row becomes its own PDF, downloaded together as a ZIP.' },
  { icon: 'i-lucide-history', title: 'Documents & undo', text: 'Multiple documents, full undo/redo, and autosave in your browser.' }
]

const steps = [
  { title: 'Open the Designer', text: 'Go to the Designer page. Use the toolbar to switch documents, undo/redo, pick a template, or download. The editor is organized into four tabs: Content, Style, AI, and Data.' },
  { title: 'Start with a template or AI', text: 'Pick Invoice, Report, Letter, or Blank from the template menu — or open the AI tab, describe what you need, and click Generate document. AI can create a full layout including tables and merge-field placeholders.' },
  { title: 'Edit your content', text: 'In the Content tab, switch between Header, Body and Footer. Add blocks with the + Add menu, drag to reorder, and edit text inline. Click the sparkle icon on a heading or paragraph to rewrite it — formal, casual, shorter, longer, or fix grammar.' },
  { title: 'Style the document', text: 'Open the Style tab to set page size, orientation and margins. Apply a theme preset (Classic, Navy, Teal, Warm, Mono) or adjust individual colors.' },
  { title: 'Personalize with data', text: 'In the Data tab, add merge fields (field name → preview value) and reference them in your text. Use Auto-suggest to let AI propose fields, or upload a CSV to batch-generate one PDF per row.' },
  { title: 'Preview & download', text: 'The live preview updates as you edit. When it looks right, click Download in the toolbar — or Generate ZIP in the Data tab for a CSV batch.' }
]

const aiModes = [
  { label: 'New doc', desc: 'Replace the entire document with a fresh AI-generated layout.' },
  { label: 'Add body', desc: 'Keep your header, footer and design — only regenerate the body content.' },
  { label: 'Improve', desc: 'Polish and refine the document you already have.' }
]

const rewriteActions = ['Make formal', 'Make casual', 'Shorten', 'Expand', 'Fix grammar']
</script>

<template>
  <UContainer class="py-8 sm:py-12">
    <article class="mx-auto max-w-3xl">
      <!-- Hero -->
      <header class="text-center">
        <UBadge variant="soft" color="primary" class="mb-3">Documentation</UBadge>
        <h1 class="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
          Everything you can do with PDFora
        </h1>
        <p class="mx-auto mt-3 max-w-2xl text-base text-slate-600 dark:text-slate-300">
          PDFora is a free, browser-based <strong>PDF Designer</strong>. Design polished PDFs
          with a live preview, AI-assisted generation, merge fields, and CSV batch export — no install required.
        </p>
        <div class="mt-6 flex flex-wrap items-center justify-center gap-3">
          <UButton to="/" icon="i-lucide-layout-template" label="Open the Designer" size="lg" />
          <UButton to="#how-to-use" icon="i-lucide-list-checks" label="How to use" variant="soft" size="lg" />
        </div>
      </header>

      <!-- Workspace tabs -->
      <section class="mt-12 sm:mt-16">
        <h2 class="text-xl font-semibold text-slate-900 dark:text-white">The editor</h2>
        <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">
          The left panel has four tabs. The right side shows a live PDF preview.
        </p>
        <div class="mt-4 grid gap-3 sm:grid-cols-2">
          <UCard
            v-for="tab in workspaceTabs"
            :key="tab.title"
            class="border-violet-100/60 shadow-sm dark:border-slate-700/60"
          >
            <div class="flex items-start gap-3">
              <div class="grid size-9 shrink-0 place-items-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300">
                <UIcon :name="tab.icon" class="size-5" />
              </div>
              <div>
                <h3 class="font-semibold text-slate-800 dark:text-slate-100">{{ tab.title }}</h3>
                <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">{{ tab.text }}</p>
              </div>
            </div>
          </UCard>
        </div>
      </section>

      <!-- Features -->
      <section class="mt-12 sm:mt-16">
        <h2 class="text-xl font-semibold text-slate-900 dark:text-white">Features</h2>
        <div class="mt-4 grid gap-4 sm:grid-cols-2">
          <UCard
            v-for="f in features"
            :key="f.title"
            class="border-violet-100/60 shadow-sm dark:border-slate-700/60"
          >
            <div class="flex items-start gap-3">
              <div class="grid size-9 shrink-0 place-items-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300">
                <UIcon :name="f.icon" class="size-5" />
              </div>
              <div>
                <h3 class="font-semibold text-slate-800 dark:text-slate-100">{{ f.title }}</h3>
                <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">{{ f.text }}</p>
              </div>
            </div>
          </UCard>
        </div>
      </section>

      <!-- AI -->
      <section id="ai" class="mt-12 scroll-mt-20 sm:mt-16">
        <h2 class="text-xl font-semibold text-slate-900 dark:text-white">Using AI</h2>
        <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">
          PDFora can draft and refine your PDFs for you — describe what you need, pick a mode, and generate.
          You can also rewrite individual blocks or let AI suggest merge fields.
        </p>

        <div class="mt-5 space-y-4">
          <UCard class="border-violet-100/60 shadow-sm dark:border-slate-700/60">
            <h3 class="font-semibold text-slate-800 dark:text-slate-100">Generate a full document</h3>
            <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Open the <strong>AI</strong> tab, type what you want (e.g. “invoice for a freelance designer with a line-items table”),
              pick a mode, and click <strong>Generate document</strong>. You’ll get a ready-to-edit layout with headings,
              paragraphs, tables, and placeholder tokens you can customize.
            </p>
            <div class="mt-3 grid gap-2 sm:grid-cols-3">
              <div
                v-for="m in aiModes"
                :key="m.label"
                class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50"
              >
                <div class="text-xs font-semibold text-slate-800 dark:text-slate-100">{{ m.label }}</div>
                <div class="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{{ m.desc }}</div>
              </div>
            </div>
          </UCard>

          <UCard class="border-violet-100/60 shadow-sm dark:border-slate-700/60">
            <h3 class="font-semibold text-slate-800 dark:text-slate-100">Rewrite a block</h3>
            <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">
              On any heading or paragraph in the Content tab, click the sparkle icon and choose an action:
            </p>
            <div class="mt-2 flex flex-wrap gap-1.5">
              <UBadge v-for="action in rewriteActions" :key="action" variant="soft" size="xs">{{ action }}</UBadge>
            </div>
          </UCard>

          <UCard class="border-violet-100/60 shadow-sm dark:border-slate-700/60">
            <h3 class="font-semibold text-slate-800 dark:text-slate-100">Suggest merge fields</h3>
            <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">
              In the AI or Data tab, click <strong>Suggest merge fields</strong> (or <strong>Auto-suggest</strong>)
              to have AI propose field names and sample values based on your document — or map them from CSV column headers.
            </p>
          </UCard>
        </div>
      </section>

      <!-- How to use -->
      <section id="how-to-use" class="mt-12 scroll-mt-20 sm:mt-16">
        <h2 class="text-xl font-semibold text-slate-900 dark:text-white">How to use PDFora</h2>
        <ol class="mt-4 space-y-4">
          <li
            v-for="(s, i) in steps"
            :key="s.title"
            class="flex gap-4 rounded-xl border border-violet-100/60 bg-white/60 p-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/40"
          >
            <div class="grid size-8 shrink-0 place-items-center rounded-full bg-linear-to-br from-violet-600 to-indigo-600 text-sm font-bold text-white">
              {{ i + 1 }}
            </div>
            <div>
              <h3 class="font-semibold text-slate-800 dark:text-slate-100">{{ s.title }}</h3>
              <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">{{ s.text }}</p>
            </div>
          </li>
        </ol>
      </section>

      <!-- Data & merge fields -->
      <section class="mt-12 sm:mt-16">
        <h2 class="text-xl font-semibold text-slate-900 dark:text-white">Data tab — merge fields &amp; batch</h2>
        <p class="mt-3 text-sm text-slate-600 dark:text-slate-400">
          The Data tab walks you through personalization in three steps:
        </p>
        <ol class="mt-3 list-inside list-decimal space-y-1 text-sm text-slate-600 dark:text-slate-400">
          <li><strong>Add fields</strong> — name each placeholder and set a preview value.</li>
          <li><strong>Use in text</strong> — type tokens in headings or paragraphs.</li>
          <li><strong>Export</strong> — download one PDF or batch-generate from a CSV.</li>
        </ol>

        <h3 class="mt-6 text-base font-semibold text-slate-800 dark:text-slate-100">Tokens</h3>
        <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Anywhere you can type, use:
        </p>
        <ul class="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-400">
          <li>
            <code class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-violet-700 dark:bg-slate-800 dark:text-violet-300">{{ tk.field }}</code>
            — a simple placeholder replaced by your data.
          </li>
          <li>
            <code class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-violet-700 dark:bg-slate-800 dark:text-violet-300">{{ tk.client }}</code>
            — dotted keys for groups (client.name, invoice.number, etc.).
          </li>
          <li>
            <code class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-violet-700 dark:bg-slate-800 dark:text-violet-300">{{ tk.page }}</code>
            /
            <code class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-violet-700 dark:bg-slate-800 dark:text-violet-300">{{ tk.pages }}</code>
            — current and total page numbers (great for footers).
          </li>
        </ul>

        <h3 class="mt-6 text-base font-semibold text-slate-800 dark:text-slate-100">Batch from CSV</h3>
        <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Upload a <code class="font-mono text-xs">.csv</code> exported from Excel or Google Sheets.
          Each row becomes its own PDF. Column headers should match your merge field names.
          Name output files with a pattern like
          <code class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-violet-700 dark:bg-slate-800 dark:text-violet-300">{{ tk.batchName }}</code>.
        </p>
      </section>

      <!-- CTA -->
      <section class="mt-12 rounded-2xl bg-linear-to-br from-violet-600 to-indigo-600 px-6 py-8 text-center text-white sm:mt-16">
        <h2 class="text-2xl font-bold">Ready to design your PDF?</h2>
        <p class="mx-auto mt-2 max-w-md text-sm text-violet-100">
          Jump into the editor — no sign-up, no install. Your work autosaves in your browser.
        </p>
        <UButton to="/" color="neutral" variant="solid" size="lg" icon="i-lucide-arrow-right" trailing label="Open the Designer" class="mt-5" />
      </section>
    </article>
  </UContainer>
</template>
