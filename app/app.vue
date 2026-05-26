<script setup lang="ts">
// Global head defaults. Pages set a bare `title` (e.g. "PDF Designer") and the
// brand suffix is appended here so every tab reads "<Page> · PDFora".
useHead({
  titleTemplate: (title?: string) => (title ? `${title} · PDFora` : 'PDFora — PDF Designer'),
  meta: [{ property: 'og:site_name', content: 'PDFora' }]
})
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
