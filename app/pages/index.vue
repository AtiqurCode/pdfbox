<script setup lang="ts">
const url = useRequestURL()
const siteUrl = useRuntimeConfig().public.siteUrl || url.origin
const canonical = siteUrl.replace(/\/$/, '') + '/'
const ogImage = siteUrl.replace(/\/$/, '') + '/og.svg'

const description =
  'PDFora is a free online PDF Designer — design and generate polished, customized PDFs in seconds. Add headings, rich text, tables and images, apply themes, merge data, and batch-generate from CSV.'

useSeoMeta({
  title: 'PDF Designer',
  description,
  ogTitle: 'PDFora — PDF Designer',
  ogDescription: description,
  ogType: 'website',
  ogUrl: canonical,
  ogImage,
  ogSiteName: 'PDFora',
  twitterCard: 'summary_large_image',
  twitterTitle: 'PDFora — PDF Designer',
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
        '@type': 'WebApplication',
        name: 'PDFora',
        alternateName: 'PDFora PDF Designer',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        url: canonical,
        description,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
      })
    }
  ]
})
</script>

<template>
  <UContainer class="py-4 sm:py-6">
    <PdfDesigner />
  </UContainer>
</template>
