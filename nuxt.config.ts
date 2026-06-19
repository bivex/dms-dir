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
    '@vueuse/nuxt'
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  routeRules: {
    '/dashboard': { prerender: false, ssr: false },
    '/login': { prerender: false, ssr: false },
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

  // Статична збірка для packaged-app (FastAPI віддає .output/public).
  // nuxt dev ігнорує preset (завжди dev-server), тому proxy /api/eusign/** нижче
  // лишається робочим у dev. Для static-export proxy не діє — там шлях /api/eusign
  // обслуговується mount FastAPI (див. PLAN_macos_app.md Етап 2).
  nitro: {
    preset: process.env.NITRO_PRESET || 'static'
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
