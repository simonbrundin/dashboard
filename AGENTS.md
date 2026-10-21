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

<!-- wiki:start -->
## Kunskaps-wiki

Det här repot delar en gemensam kunskaps-wiki med alla andra repor.
Wikin ligger i `~/wiki`.

**Två regler:**

1. **Läs wikin innan du frågar användaren.** Svaret finns ofta redan
   dokumenterat - leta först.
2. **Skriv en not i wikin inbox när något stort händer.** Incident, beslut,
   ny feature eller en icke-obvious bugg.

```bash
wikictl search "bigram"                  # sök i hela wikin
wikictl search "fel" --project <repo>    # sök inom ett projekt
wikictl note --title "Rubrik" --tags "bug" --body "Vad som hände och varför."
wikictl ingest                          # flytta inboxen in i grafen
```

Anteckningar taggas automatiskt med `projekt:<repo>`.
Schemat för wikin står i `~/wiki/AGENTS.md`.
<!-- wiki:end -->
