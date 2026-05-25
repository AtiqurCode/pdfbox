<script setup lang="ts">
const colorMode = useColorMode()
const url = useRequestURL()

function toggleDark() {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}

useSeoMeta({
  title: 'PDFBox — PDF designer & generator',
  description: 'Design and generate customized PDFs in seconds. Add headings, rich text, tables, images, and export as PDF.',
  ogTitle: 'PDFBox — PDF designer & generator',
  ogDescription: 'Design and generate customized PDFs in seconds.',
  ogType: 'website',
  ogUrl: url.origin + url.pathname,
  ogImage: url.origin + '/og.svg',
  twitterCard: 'summary_large_image',
  twitterImage: url.origin + '/og.svg'
})

useHead({
  link: [{ rel: 'canonical', href: url.origin + url.pathname }]
})
</script>

<template>
  <div class="min-h-screen bg-linear-to-b from-violet-50/40 to-slate-50 text-slate-900 dark:from-slate-950 dark:to-slate-900 dark:text-slate-100">
    <div class="border-b border-violet-100 bg-white/70 backdrop-blur-lg dark:border-slate-800 dark:bg-slate-900/70">
      <UContainer class="py-5">
        <div class="flex items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <div class="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/20">
              <span class="text-sm font-bold tracking-tight">PB</span>
            </div>
            <div class="leading-tight">
              <div class="text-base font-bold tracking-tight text-slate-900 dark:text-white">PDFBox</div>
              <div class="text-[11px] text-slate-500 dark:text-slate-400">Document designer</div>
            </div>
          </div>

          <UButton
            :icon="colorMode.value === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon'"
            variant="ghost"
            size="sm"
            :title="colorMode.value === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
            @click="toggleDark"
          />
        </div>
      </UContainer>
    </div>

    <UContainer class="py-6">
      <PdfDesigner />
    </UContainer>
  </div>
</template>
