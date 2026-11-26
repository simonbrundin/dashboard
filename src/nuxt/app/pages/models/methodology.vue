<script setup lang="ts">
useHead({
  title: 'Metodik för modellutvärdering | Dashboard',
  meta: [
    {
      name: 'description',
      content: 'Hur benchmark-specifika kodpoäng, uppgiftskostnader och värderingsrankingar beräknas.'
    }
  ]
})

useSeoMeta({
  title: 'Metodik för modellutvärdering',
  description: 'Läs hur benchmark-specifika kodpoäng och uppgiftskostnader jämförs.'
})
</script>

<template>
  <UDashboardPanel id="models-methodology">
    <template #header>
      <UDashboardNavbar title="Metodik för modellutvärdering">
        <template #leading>
          <UButton
            to="/models"
            variant="ghost"
            icon="i-lucide-arrow-left"
            aria-label="Tillbaka till modeller"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="p-6 space-y-6 max-w-5xl">
        <UCard>
          <template #header>
            <div>
              <h1 class="text-xl font-semibold">Så beräknas modellernas värde</h1>
              <p class="text-sm text-muted-foreground mt-1">
                Varje ranking använder en poäng och en kostnad från samma benchmark. Dashboarden kombinerar aldrig
                orelaterade poäng eller uppgiftskostnader till ett enda poäng-per-dollar-värde.
              </p>
            </div>
          </template>

          <div class="space-y-6 text-sm leading-6">
            <section>
              <h2 class="font-semibold text-base">1. Välj ett benchmark</h2>
              <p class="text-muted-foreground mt-2">
                DeepSWE v1.1, Terminal-Bench 4.1, Terminal-Bench 4.0, Artificial Analysis Coding Agent Index och
                BenchLM visas som separata vyer. En poäng från en källa paras aldrig ihop med en kostnad från en
                annan. Det spelar roll: uppgiftsmängder, agent-harnessar, modellkonfigurationer och
                poängdefinitioner skiljer sig åt.
              </p>
              <p class="text-muted-foreground mt-2">
                En modellrad matchar en mätning endast när både release och reasoning-effort stämmer, så en
                Low-variant arv aldrig kostnaden för en Max-körning.
              </p>
            </section>

            <section>
              <h2 class="font-semibold text-base">2. Kostnad per lyckad uppgift</h2>
              <p class="text-muted-foreground mt-2">
                DeepSWE v1.1 och Terminal-Bench visar benchmarkets egen andel lösade uppgifter och kostnad per
                försök. När benchmarket publicerar kostnaden per lyckad uppgift används den direkt. Annars härleds
                den från samma körning:
              </p>
              <div class="mt-3 rounded-lg bg-muted p-4 font-mono text-sm">
                Kostnad per lyckad uppgift = kostnad per försök ÷ andel lösade uppgifter
              </div>
              <p class="text-muted-foreground mt-2">
                Rankingen sorterar på kostnad per lyckad uppgift, lägst först. Andelen lösade uppgifter delas inte
                in i kostnaden en andra gång - det vore att räkna framgången två gånger. Poängen står kvar synlig så
                att en billig modell med svag andel lösade uppgifter är lätt att upptäcka.
              </p>
              <p class="text-muted-foreground mt-2">
                När ett benchmark inte har någon andel lösade uppgifter - till exempel AA Coding Agent Index - redovisas
                bara kostnaden per försök och den märks som just det. En modell som ofta missar får annars se
                billigare ut än den är.
              </p>
            </section>

            <section>
              <h2 class="font-semibold text-base">3. Benchmarkisolering</h2>
              <p class="text-muted-foreground mt-2">
                Varje poäng, kostnad, agent och andel lösade uppgifter läses ur samma benchmark och samma körning.
                Terminal-Bench 4.0 och 4.1 har olika verifierare och blandas aldrig ihop. DeepSWE och Terminal-Bench
                har olika uppgiftsmängder och egna kostnader, och de jämförs aldrig med varandra i en ranking.
              </p>
              <p class="text-muted-foreground mt-2">
                Recommendationen följer samma regel: bara modeller med en uppmätt kvalitetsnivå i det valda
                benchmarket kan vinna. Tokenpriser kan visa att en modell är billig, men de bevisar inte att den
                klarar koduppgifter - därför kan en uppskattad kostnad aldrig ge en rekommendation.
              </p>
            </section>

            <section>
              <h2 class="font-semibold text-base">4. Agent, harness och konfidensintervall</h2>
              <p class="text-muted-foreground mt-2">
                Varje agentkörning görs i en viss harness, och harnessen påverkar både poängen och kostnaden.
                Därför visas agenten i rekommendationen och i jämförelsetabellen: Terminal-Bench körs med
                <code>mini-swe-agent</code>, DeepSWE sparar sin egen harness per rad, och AA Coding Agent Index
                anger agenten (Codex, Claude Code med flera) per rad.
              </p>
              <p class="text-muted-foreground mt-2">
                Där källan publicerar ett statistiskt intervall visas det som 95 % CI i stället för att dölja
                variationen bakom en punktvärde. DeepSWE publicerar ett sådant intervall; Terminal-Bench-sidan
                gör det inte, så där visas inget.
              </p>
            </section>

            <section>
              <h2 class="font-semibold text-base">5. Reasoning-effort</h2>
              <p class="text-muted-foreground mt-2">
                En Max-körning och en Low-körning är inte samma mätning. Effort är därför en egen dimension i
                filtren, och modellraderna matchar sina mätningar på exakt effort - inte på modellnamn.
              </p>
            </section>

            <section>
              <h2 class="font-semibold text-base">6. Artificial Analysis Coding Agent Index</h2>
              <p class="text-muted-foreground mt-2">
                Den vyn använder Coding Agent Index-poängen och den uppmätta kostnaden för samma index:
              </p>
              <div class="mt-3 rounded-lg bg-muted p-4 font-mono text-sm">
                Coding Agent-värde = Coding Agent Index-poäng ÷ kostnad per försök
              </div>
              <p class="text-muted-foreground mt-2">
                Saknas något värde rankas modellen inte i den vyn. Dashboarden ersätter ingenting med
                Terminal-Bench-, DeepSWE-, BenchLM- eller Intelligence Index-data.
              </p>
            </section>

            <section>
              <h2 class="font-semibold text-base">7. BenchLM</h2>
              <p class="text-muted-foreground mt-2">
                BenchLM är en kvalitetsvy. Det finns ingen matchad BenchLM-kostnad, så den presenteras inte som en
                pris- eller värderingsranking. Exaktvariant som markerats Supported ingår från början. Familjmatcher
                och uppskattat underlag är opt-in och märks som sådana - de ärverar inte ett påhittat pris.
              </p>
            </section>

            <section>
              <h2 class="font-semibold text-base">8. Saknad data och uppskattningar</h2>
              <ul class="list-disc list-inside mt-3 space-y-2 text-muted-foreground">
                <li>Varje benchmark håller sin råa poäng, kostnad per försök och kostnad per lyckad uppgift åtskilda.</li>
                <li>Pris- och värderingsrankingar kräver poäng och kostnad från samma benchmark; BenchLM är uttryckligen bara kvalitet.</li>
                <li>Saknade kostnader och poäng förblir otillgängliga - de ersätts aldrig med noll.</li>
                <li>En noll kostnad behandlas som gratis där benchmarket publicerar ett komplett poäng-/kostnadpar.</li>
                <li>Familjnivå-BenchLM-poäng räknas inte som exakta resultat för effort-specifika varianter som standard.</li>
                <li>Varje benchmarkkolumn ersätts vid varje import, så en färsk poäng visas aldrig bredvid en gammal kostnad.</li>
                <li>Uppskattningar (tokenpriser, profiler) märks med ≈ och används aldrig för att ge en rekommendation.</li>
              </ul>
            </section>

            <section>
              <h2 class="font-semibold text-base">9. Uppskattad kostnadsyta</h2>
              <p class="text-muted-foreground mt-2">
                De mätta benchmarken täcker bara de modeller som deras utgivare har kört, så den uppskattade vyn
                täcker hela listan. Den kombinerar varje modells egna tokenpriser med medianprofilen för uppmätta
                modeller vid samma reasoning-effort:
              </p>
              <div class="mt-3 rounded-lg bg-muted p-4 font-mono text-sm">
                Uppskattad kostnad per försök = profiltokens × modellens tokenpriser
                <br>
                Uppskattat värde = Intelligence Index ÷ uppskattad kostnad per försök
              </div>
              <p class="text-muted-foreground mt-2">
                Det är en approximation, och kvalitetssignalen är det generella Intelligence Index, inte ett
                kodbenchmark. Värdena märks med ≈ och vyn hålls åtskild från de mätta rankingarna.
              </p>
            </section>

            <section>
              <h2 class="font-semibold text-base">10. Budgetvyn</h2>
              <p class="text-muted-foreground mt-2">
                Budgetvyn svarar på "vilken är billigast och ändå tillräckligt smart". Välj en källa (AA Coding
                Agent Index, Terminal-Bench 4.1/4.0, DeepSWE eller den uppskattade Intelligence-vyn) och en
                referensmodell; listan visar modeller som når minst referensens poäng på samma källa, billigast först.
              </p>
              <p class="text-muted-foreground mt-2">
                Mätta källkostnader och tokenprisuppskattningar (≈) visas i separata grupper och jämförs aldrig
                över den gränsen. Sparande i procent beräknas bara inom samma kostnadstyp.
              </p>
            </section>

            <section>
              <h2 class="font-semibold text-base">11. Prenumerationer och kvoter</h2>
              <p class="text-muted-foreground mt-2">
                Kvoter är inte alltid publicerade i dollar, och därför räknas de inte om till ett dollarvärde om
                underlaget saknas. Tre typer hanteras var för sig:
              </p>
              <ul class="list-disc list-inside mt-3 space-y-2 text-muted-foreground">
                <li>
                  <strong class="text-foreground">Credits i dollar</strong> - GitHub Copilot publicerar
                  1 AI-credit = $0,01 och en creditskort. Då kan både inkluderad kvot och överkostnad beräknas,
                  där överkostnaden tas till listpris.
                </li>
                <li>
                  <strong class="text-foreground">Anrops- eller enhetskvoter</strong> - MiniMax Token Starter
                  anger 1 500 anrop per 5-timmarsfönster. Det är inte dollar-denominerat, så antalet uppgifter
                  går inte att räkna ut och visas bara som kvoten.
                </li>
                <li>
                  <strong class="text-foreground">Mjuka gränser</strong> - Claude, ChatGPT och Google visar
                  5-timmarsfönster eller relativa gränser utan publicerat dollarvärde. De markeras som ej
                  omräknade till dollar och kan bara visas som en undre gräns.
                </li>
              </ul>
              <p class="text-muted-foreground mt-2">
                Planpriset som sprids över användningen gäller bara om kvoten räcker - därför markeras den
                sifffran med ≤. Anthropics API-credits är separata från agentkvoten i apparna: de gäller bara
                API-anrop.
              </p>
            </section>

            <section>
              <h2 class="font-semibold text-base">12. Enhetspris per miljon token</h2>
              <p class="text-muted-foreground mt-2">
                API-priser och prenumerationspriser jämförs i samma mått: en miljon inputtokens plus en miljon
                outputtokens. Mixen är deklarerad, inte dold.
              </p>
              <div class="mt-3 rounded-lg bg-muted p-4 font-mono text-sm">
                Basket = 1M input + 1M output
                <br>
                Med cache = 10 % av inputtokens läses från cache (dokumenterat standardantagande)
              </div>
              <p class="text-muted-foreground mt-2">
                Modeller som själva har en uppmätt cacheandel använder den i stället för standardantagandet.
                Cachevyn visar listpris, cachepris och mätt cacheandel sida vid sida, så antagandet syns.
                Planer utan publicerat dollarvärde visas som — i stället för ett påhittat effektivt pris.
              </p>
            </section>

            <section>
              <h2 class="font-semibold text-base">13. Användningsgränser per modell</h2>
              <p class="text-muted-foreground mt-2">
                Gränsvyn visar vad leverantören själv publicerar per modell, uppdelat i timgräns,
                dagsgräns och månadsgräns för spend. De tre är olika saker och blandas aldrig ihop.
              </p>
              <ul class="list-disc list-inside mt-3 space-y-2 text-muted-foreground">
                <li>
                  <strong class="text-foreground">Timgräns</strong> - anrop per minut, anrop per sekund,
                  token per minut och antal samtidiga förfrågningar.
                </li>
                <li>
                  <strong class="text-foreground">Dagsgräns</strong> - token per dygn. När leverantören anger
                  obegränsat på en högre nivå skrivs det ut, aldrig som noll.
                </li>
                <li>
                  <strong class="text-foreground">Månadsgräns</strong> - en cap för organisationens månatliga
                  spend. Det är en gräns för vad du får betala, inte en inkluderad kvot.
                </li>
                <li>
                  <strong class="text-foreground">Ej publicerade gränser</strong> - Google och Mistral visar
                  gränserna i sin egen konsol i stället för som siffror. Då står det
                  <em>ej publicerade</em>, aldrig 0.
                </li>
              </ul>
              <p class="text-muted-foreground mt-2">
                Gränserna är tier-bundna: exempelvis gäller Kimis värden på Tier 0 och blir obegränsade på
                högre nivå. Prenumerationens kvot är en helt annan sak och visas i egen kolumn - den gäller
                agentanvändningen i apparna, medan API-gränserna gäller API-nivån. En prenumeration täcker
                modellen i alla reasoning-effort-nivåer.
              </p>
            </section>

            <section>
              <h2 class="font-semibold text-base">14. Viktigt om tolkningen</h2>
              <p class="text-muted-foreground mt-2">
                Publicerade benchmarkkostnader är uppskattningar, inte en garanti för fakturan för ett visst
                repository-uppgift. De verkliga kostnaderna beror på prompten, kontextlängden, reasoning-effort, harness,
                retries, cachebeteende, leverantörspriser och uppgiftsmix. För ett produktionsbeslut: utvärdera
                samma uppgiftsmängd med den tänkta harnessen och redovisa andel lösade uppgifter, kostnad per
                försök och kostnad per lyckad uppgift.
              </p>
            </section>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <h2 class="font-semibold">Källor och attribuering</h2>
          </template>
          <div class="space-y-3 text-sm text-muted-foreground">
            <p>
              Artificial Analysis:
              <a
                href="https://artificialanalysis.ai/methodology/intelligence-benchmarking"
                target="_blank"
                rel="noopener noreferrer"
                class="text-primary hover:underline"
              >
                Intelligence Benchmarking Methodology
              </a>
              och
              <a
                href="https://artificialanalysis.ai/methodology/coding-agents-benchmarking"
                target="_blank"
                rel="noopener noreferrer"
                class="text-primary hover:underline"
              >
                Coding Agent Index Methodology
              </a>.
            </p>
            <p>
              Terminal-Bench 4.1 och 4.0:
              <a
                href="https://artificialanalysis.ai/evaluations/terminalbench-v4-0"
                target="_blank"
                rel="noopener noreferrer"
                class="text-primary hover:underline"
              >
                Artificial Analysis leaderboard
              </a>.
              DeepSWE v1.1:
              <a
                href="https://deepswe.datacurve.ai/blog/deepswe-v1-1"
                target="_blank"
                rel="noopener noreferrer"
                class="text-primary hover:underline"
              >
                Data-Curve-rapporten
              </a>.
            </p>
            <p>
              BenchLM:
              <a
                href="https://benchlm.ai/data"
                target="_blank"
                rel="noopener noreferrer"
                class="text-primary hover:underline"
              >
                maskinläsbar data och licens
              </a>.
              BenchLM-data används med attribuering under CC BY-NC 4.0; kommersiell vidaredistribution kräver
              tillstånd från BenchLM.
            </p>
            <p>
              Prenumerationspriser och kvoter kommer från leverantörernas egna prissidor och dokumentation:
              GitHub Docs om Copilot-credits och gränser, MiniMax M Plan och Token Starter, Anthropics Claude
              Max/Ultra, OpenAI ChatGPT Plus/Pro och Google AI Pro/Ultra.
            </p>
            <p>Uppdatera modelldata via refresh/import på modellsidan för att hämta aktuella värden.</p>
          </div>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
