// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ["@nuxt/ui", "@vueuse/nuxt", "@nuxt/eslint"],

  icon: {
    fallbackToApi: false,
    serverBundle: {
      collections: ["lucide", "simple-icons"],
    },
  },

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
    pxeHost: "10.10.10.2",
    pxeHttpPort: 8080,
    pxeTftpPort: 69,
    pxeProbeMac: "0a:3f:39:25:2b:c8",
    pxeProbeNode: "worker-1",
    // TFTP-kontrollen kan stängas av om nätverket blockerar UDP 69
    pxeTftpEnabled: "true",
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
