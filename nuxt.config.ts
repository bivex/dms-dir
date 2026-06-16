// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  runtimeConfig: {
    public: {
      // Portal API URL — override via NUXT_PUBLIC_API_BASE env var
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:8000'
    }
  },

  modules: [
    '@nuxt/eslint',
    '@nuxt/image',
    '@nuxt/ui',
    '@nuxt/content',
    '@vueuse/nuxt',
    'nuxt-og-image'
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  content: {
    experimental: {
      sqliteConnector: 'native'
    }
  },

  routeRules: {
    '/docs': { redirect: '/docs/getting-started', prerender: false },
    '/dashboard': { prerender: false, ssr: false },
    '/login': { prerender: false, ssr: false },
    '/signup': { prerender: false, ssr: false },
    // проксуємо EUSign WASM з portal щоб dynamic import не блокувався CORS
    '/api/eusign/**': {
      proxy: `${process.env.NUXT_API_BASE_INTERNAL || process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:8000'}/eusign/**`
    },
    // CAs.json та інші signdata ресурси для euscpfactory
    '/signdata/**': {
      proxy: `${process.env.NUXT_API_BASE_INTERNAL || process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:8000'}/signdata/**`
    }
  },

  compatibilityDate: '2024-07-11',

  nitro: {
    prerender: {
      routes: [
        '/'
      ],
      crawlLinks: true
    }
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  ogImage: {
    zeroRuntime: true
  }
})
