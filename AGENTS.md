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
Wikin ligger i `~/wiki` och är en persistent kunskapsgraf som
agenterna underhåller - kunskapen härleds inte om vid varje fråga.

**Fem regler:**

1. **Läs wikin innan du frågar användaren.** Svaret finns ofta redan
   dokumenterat - leta först.
2. **Skriv en not i wikin inbox när något stort händer.** Incident, beslut,
   ny feature eller en icke-obvious bugg.
3. **Lägg in råkällor** du lär dig av med `wikictl source add`.
   De är immutabla och ger spårbarhet.
4. **Håll wikin aktuell.** Ett påstående som en ny källa motsäger ska
   ändras, inte ligga kvar. `wikictl lint` hittar trasiga länkar,
   ödelappar och föråldrad info.
5. **Fila tillbaka värdefulla svar** som sidor, så att de inte försvinner
   i chatthistoriken.

```bash
wikictl search "bigram"                  # sök i hela wikin
wikictl search "fel" --project <repo>    # sök inom ett projekt
wikictl note --title "Rubrik" --tags "bug" --body "Vad som hände och varför."
wikictl page --type concept --title "Rubrik" --body "..."   # skriv en sida
wikictl link --from concepts/a --to concepts/b               # korslänka
wikictl source add --file kalla.md --title "Rubrik"         # råkälla
wikictl ingest                          # flytta inboxen in i grafen
wikictl lint                            # hälsa
```

Anteckningar taggas automatiskt med `projekt:<repo>`.
Schemat för wikin står i `~/wiki/AGENTS.md`.
<!-- wiki:end -->
