// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/ui', '@pinia/nuxt', '@nuxtjs/robots', '@nuxtjs/sitemap'],
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }]
    }
  },
  runtimeConfig: {
    public: {
      // Set this in production: NUXT_PUBLIC_SITE_URL=https://your-domain.com
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    }
  },
  sitemap: {
    siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000',
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
