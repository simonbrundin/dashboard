// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ["@nuxt/ui", "@vueuse/nuxt"],

  devtools: {
    enabled: false,
  },

  css: ["~/assets/css/main.css"],

  runtimeConfig: {
    // Server-only keys
    minimaxApiKey: "",
    uptimeKumaUrl: "",
    uptimeKumaApiKey: "",
    githubUsername: "",
    githubToken: "",
    artificialAnalysisApiKey: "",
  },

  routeRules: {
    "/api/**": {
      cors: true,
    },
  },

  compatibilityDate: "2026-06-30",

  // Generate .nuxt directory inside app/
  buildDir: 'app/.nuxt',
})
