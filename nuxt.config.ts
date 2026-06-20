import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

// Nuxt 4.4 ships `useAppConfig` as a server auto-import from BOTH nitropack core
// and @nuxt/nitro-server at equal priority, so unimport logs a noisy
// "Duplicated imports" warning on every build. Re-register the one Nuxt already
// keeps (@nuxt/nitro-server) at a higher priority so the duplicate is resolved
// silently. Same implementation — only the priority changes.
const nitroServerAppConfig = join(
  dirname(createRequire(import.meta.url).resolve('@nuxt/nitro-server')),
  'runtime/utils/app-config'
)

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/ui', '@pinia/nuxt', '@nuxtjs/robots', '@nuxtjs/sitemap'],
  nitro: {
    imports: {
      imports: [{ name: 'useAppConfig', from: nitroServerAppConfig, priority: 10 }]
    }
  },
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
      meta: [
        { name: 'theme-color', content: '#7c3aed' },
        { name: 'author', content: 'mdatiqur.me' },
        { name: 'application-name', content: 'PDFora' }
      ]
    }
  },
  // Used by @nuxtjs/sitemap and @nuxtjs/robots (nuxt-site-config).
  site: {
    url: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    name: 'PDFora'
  },
  runtimeConfig: {
    groqApiKey: process.env.GROQ_API_KEY || '',
    public: {
      // Set this in production: NUXT_PUBLIC_SITE_URL=https://your-domain.com
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000',
      aiEnabled: Boolean(process.env.GROQ_API_KEY)
    }
  },
  sitemap: {
    autoLastmod: true
  },
  robots: {
    // In production you can override via NUXT_PUBLIC_SITE_URL + deploy env
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: `${process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/sitemap.xml`
  },
  vite: {
    optimizeDeps: {
      include: ['@vue/devtools-core', '@vue/devtools-kit']
    }
  }
})
