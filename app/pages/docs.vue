<script setup lang="ts">
const url = useRequestURL()
const siteUrl = useRuntimeConfig().public.siteUrl || url.origin
const canonical = siteUrl.replace(/\/$/, '') + '/docs'
const ogImage = siteUrl.replace(/\/$/, '') + '/og.svg'

const description =
  'How to use PDFora, the free online PDF Designer — features, a step-by-step guide, merge fields and CSV batch generation.'

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
          { '@type': 'HowToStep', name: 'Start from a template', text: 'Pick Invoice, Report, Letter, or a blank canvas.' },
          { '@type': 'HowToStep', name: 'Add your content', text: 'Edit the Header, Body and Footer with headings, text, tables and images.' },
          { '@type': 'HowToStep', name: 'Style the document', text: 'Choose colors, fonts, a style preset, page size and margins.' },
          { '@type': 'HowToStep', name: 'Merge data & batch', text: 'Use {{tokens}} and generate one PDF per CSV row as a ZIP.' },
          { '@type': 'HowToStep', name: 'Preview and download', text: 'Watch the live preview and download your finished PDF.' }
        ]
      })
    }
  ]
})

const features = [
  { icon: 'i-lucide-eye', title: 'Live preview', text: 'Your PDF re-renders automatically as you type, so what you see is exactly what you download.' },
  { icon: 'i-lucide-layout-template', title: 'Starter templates', text: 'Begin with a polished Invoice, Report or Letter — or a blank canvas — then make it yours.' },
  { icon: 'i-lucide-type', title: 'Rich content blocks', text: 'Headings, rich-text paragraphs (bold, italic, color), tables and images, arranged in any order.' },
  { icon: 'i-lucide-palette', title: 'Themes & fonts', text: 'Set text, heading, accent and background colors, apply presets, and pick a base or custom uploaded font.' },
  { icon: 'i-lucide-file-stack', title: 'Header, body & footer', text: 'Structured sections with automatic page numbers using {{page}} and {{pages}}.' },
  { icon: 'i-lucide-braces', title: 'Merge fields', text: 'Drop {{client.name}}-style tokens into any text and fill them from your own data.' },
  { icon: 'i-lucide-table-2', title: 'Batch from CSV', text: 'Upload a spreadsheet and generate one PDF per row, delivered together as a ZIP.' },
  { icon: 'i-lucide-history', title: 'Documents & undo', text: 'Manage multiple documents, undo/redo every change, and autosave to your browser.' }
]

// Literal token examples kept as data — embedding `{{ }}` directly in the
// template would confuse Vue's interpolation parser.
const tk = {
  client: '{{client.name}}',
  page: '{{page}}',
  pages: '{{pages}}'
}

const steps = [
  { title: 'Start from a template', text: 'Open the Designer and pick a template from the “Load template” menu — Invoice, Report or Letter — or start blank. You can change anything afterwards.' },
  { title: 'Add your content', text: 'Use the Header / Body / Footer tabs. Add blocks (heading, paragraph, table, image), reorder or duplicate them, and edit text inline with bold, italic and color.' },
  { title: 'Style the document', text: 'In the Design panel, choose colors and a style preset, set the base font (or upload a custom TTF/OTF), and adjust page size, orientation and margins.' },
  { title: 'Personalize with merge fields (optional)', text: 'Add fields under Advanced and reference them in text as {{field}} (dots make groups, e.g. {{client.name}}). Great for reusable, data-driven documents.' },
  { title: 'Batch-generate from CSV (optional)', text: 'Upload a CSV where column names match your merge fields. Each row becomes a PDF, and they’re downloaded together as a ZIP — name them with a pattern like {{name}}-{{index}}.pdf.' },
  { title: 'Preview & download', text: 'The live preview shows the real rendered PDF. When it looks right, click Download (or generate the ZIP for batches).' }
]
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
          PDFora is a free, browser-based <strong>PDF Designer</strong>. Design polished,
          customized PDFs in seconds — then download a single file or batch-generate from a spreadsheet.
        </p>
        <div class="mt-6 flex flex-wrap items-center justify-center gap-3">
          <UButton to="/" icon="i-lucide-layout-template" label="Open the Designer" size="lg" />
          <UButton to="#how-to-use" icon="i-lucide-list-checks" label="How to use" variant="soft" size="lg" />
        </div>
      </header>

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

      <!-- How to use -->
      <section id="how-to-use" class="mt-12 scroll-mt-20 sm:mt-16">
        <h2 class="text-xl font-semibold text-slate-900 dark:text-white">How to use PDFora</h2>
        <ol class="mt-4 space-y-4">
          <li
            v-for="(s, i) in steps"
            :key="s.title"
            class="flex gap-4 rounded-xl border border-violet-100/60 bg-white/60 p-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/40"
          >
            <div class="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-sm font-bold text-white">
              {{ i + 1 }}
            </div>
            <div>
              <h3 class="font-semibold text-slate-800 dark:text-slate-100">{{ s.title }}</h3>
              <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">{{ s.text }}</p>
            </div>
          </li>
        </ol>
      </section>

      <!-- Tips -->
      <section class="mt-12 sm:mt-16">
        <h2 class="text-xl font-semibold text-slate-900 dark:text-white">Merge fields &amp; tokens</h2>
        <p class="mt-3 text-sm text-slate-600 dark:text-slate-400">
          Tokens let one design produce many documents. Anywhere you can type, use:
        </p>
        <ul class="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-400">
          <li><code class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-violet-700 dark:bg-slate-800 dark:text-violet-300">{{ tk.client }}</code> — pull a value from your data (dots make groups).</li>
          <li><code class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-violet-700 dark:bg-slate-800 dark:text-violet-300">{{ tk.page }}</code> / <code class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-violet-700 dark:bg-slate-800 dark:text-violet-300">{{ tk.pages }}</code> — current and total page numbers (great for footers).</li>
          <li>In a CSV batch, column headers become the available tokens for every row.</li>
        </ul>
      </section>

      <!-- CTA -->
      <section class="mt-12 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 px-6 py-8 text-center text-white sm:mt-16">
        <h2 class="text-2xl font-bold">Ready to design your PDF?</h2>
        <p class="mx-auto mt-2 max-w-md text-sm text-violet-100">
          Jump into the editor — no sign-up, no install. Your work autosaves in your browser.
        </p>
        <UButton to="/" color="neutral" variant="solid" size="lg" icon="i-lucide-arrow-right" trailing label="Open the Designer" class="mt-5" />
      </section>
    </article>
  </UContainer>
</template>
