# Instruktioner till agenter

## Tech Stack

- Frontend
  - Nuxt
    - Pakethanterare - nub
      - I Nuxt använder det här projektet alltid `nub` och inte `npm`, `pnpm`,
        `bun`, `yarn` eller någon annan pakethanterare.
      - Kör scripts med `nub run <script>` eller `nub exec <binary>`

## Mappstruktur

```
dashboard/
├── AGENTS.md          # Information till agenter
├── README.md          # Information till utvecklare
├── environments/      # Miljökonfiguration (dev, prod, etc.)
├── src/
│   └── nuxt/         # All källkod för Nuxt-applikationen
│       ├── nuxt.config.ts
│       ├── package.json
│       ├── nub.lock
│       ├── .env.example
│       ├── .nuxt/    # Genererade filer (gitignored)
│       ├── node_modules/
│       ├── app.vue
│       ├── app.config.ts
│       ├── layouts/
│       ├── pages/
│       ├── components/
│       ├── composables/
│       └── utils/
```

## Viktigt

- Alla Nuxt-relaterade filer finns i `src/nuxt/`
- Kör `nub run dev` för att starta utvecklingsserver
- Kör `nub install` för att installera dependencies
