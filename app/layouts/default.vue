<script setup lang="ts">
const colorMode = useColorMode()

function toggleDark() {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}

const nav = [
  { label: 'Designer', to: '/', icon: 'i-lucide-layout-template' },
  { label: 'Documentation', to: '/docs', icon: 'i-lucide-book-open' }
]
</script>

<template>
  <div class="flex min-h-screen flex-col bg-linear-to-b from-violet-50/40 to-slate-50 text-slate-900 dark:from-slate-950 dark:to-slate-900 dark:text-slate-100">
    <header class="sticky top-0 z-20 border-b border-violet-100 bg-white/70 backdrop-blur-lg dark:border-slate-800 dark:bg-slate-900/70">
      <UContainer class="py-2.5 sm:py-3">
        <div class="flex items-center justify-between gap-4">
          <NuxtLink to="/" class="flex items-center gap-2.5" aria-label="PDFora — PDF Designer home">
            <div class="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/20">
              <UIcon name="i-lucide-file-text" class="size-4.5" />
            </div>
            <div class="leading-tight">
              <div class="text-sm font-bold tracking-tight text-slate-900 dark:text-white sm:text-base">PDFora</div>
              <div class="hidden text-[11px] text-slate-500 dark:text-slate-400 sm:block">PDF Designer</div>
            </div>
          </NuxtLink>

          <div class="flex items-center gap-1 sm:gap-2">
            <UButton
              v-for="item in nav"
              :key="item.to"
              :to="item.to"
              :icon="item.icon"
              :label="item.label"
              variant="ghost"
              color="neutral"
              size="sm"
              :class="$route.path === item.to ? 'text-violet-700 dark:text-violet-300' : ''"
              class="hidden sm:inline-flex"
            />
            <!-- Compact icon-only nav on mobile -->
            <UButton
              v-for="item in nav"
              :key="`m-${item.to}`"
              :to="item.to"
              :icon="item.icon"
              :title="item.label"
              variant="ghost"
              color="neutral"
              size="sm"
              :class="$route.path === item.to ? 'text-violet-700 dark:text-violet-300' : ''"
              class="sm:hidden"
            />
            <UButton
              :icon="colorMode.value === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon'"
              variant="ghost"
              color="neutral"
              size="sm"
              :title="colorMode.value === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
              @click="toggleDark"
            />
          </div>
        </div>
      </UContainer>
    </header>

    <main class="flex-1">
      <slot />
    </main>

    <footer class="border-t border-violet-100 bg-white/50 dark:border-slate-800 dark:bg-slate-900/50">
      <UContainer class="py-4">
        <div class="flex flex-col items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 sm:flex-row">
          <p>© {{ new Date().getFullYear() }} PDFora · PDF Designer</p>
          <div class="flex items-center gap-3">
            <NuxtLink to="/docs" class="transition hover:text-violet-600 dark:hover:text-violet-400">Documentation</NuxtLink>
            <span aria-hidden="true">·</span>
            <p>
              Developed by
              <a
                href="https://mdatiqur.me"
                target="_blank"
                rel="noopener noreferrer"
                class="font-medium text-violet-600 transition hover:underline dark:text-violet-400"
              >mdatiqur.me</a>
            </p>
          </div>
        </div>
      </UContainer>
    </footer>
  </div>
</template>
