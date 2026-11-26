<template>
  <UCard class="bg-muted/50">
    <div class="flex items-start gap-3">
      <UIcon name="i-lucide-info" class="w-5 h-5 text-muted-foreground mt-0.5" />
      <div class="text-sm text-muted-foreground">
        <p class="font-medium text-foreground mb-1">Metodik</p>
        <p>
          Rankingen är benchmark-specifik. Välj en källa i taget - poäng från ett benchmark delas aldrig in i
          kostnader från ett annat.
        </p>
        <p class="mt-2">
          <strong class="text-foreground">DeepSWE v1.1 och Terminal-Bench</strong> visar andelen lösade uppgifter
          och kostnaden per försök. Kostnaden per lyckad uppgift är
          <code>kostnad_per_försök / andel_lösade</code>, och rankingen sorterar den kostnaden från lägst till
          högst. Andelen lösade uppgifter delas inte in i kostnaden en andra gång.
        </p>
        <p class="mt-2">
          <strong class="text-foreground">AA Coding Agent Index</strong> använder poängen och kostnaden per
          försök från samma index. Dess värdevärde är <code>indexpoäng / kostnad_per_försök</code>.
        </p>
        <p class="mt-2">
          <strong class="text-foreground">BenchLM</strong> är en kvalitetsvy eftersom det saknas en matchad
          BenchLM-kostnad. Exakta och Supported-matchar ingår från början. Familjmatchar och uppskattat
          underlag är opt-in och får inte något påhittat pris.
        </p>
        <p class="mt-2">
          Pareto-frontier jämför poäng och kostnad bara inom det valda benchmarket. En noll kostnad är gratis;
          saknad poäng eller kostnad förblir otillgänglig i stället för att bli noll. Tokenpriser och prestanda
          från AA:s allmänna modelllista ersätter aldrig benchmarkens uppgiftskostnader.
        </p>
        <p class="mt-2">
          <strong class="text-foreground">Kvoter</strong> räknas bara om till dollar när underlaget publiceras i
          dollar - annars visas de som anropskvoter eller som mjuka gränser som inte är omräknade.
        </p>
        <p class="mt-2 text-xs">
          <NuxtLink
            to="/models/methodology"
            class="text-primary hover:underline"
          >
            Läs hela metodik och begränsningar
          </NuxtLink>.
        </p>
        <p class="mt-2 text-xs">
          Källor:
          <a
            href="https://artificialanalysis.ai/"
            target="_blank"
            rel="noopener noreferrer"
            class="text-primary hover:underline"
          >
            Artificial Analysis
          </a>,
          <a
            href="https://benchlm.ai/"
            target="_blank"
            rel="noopener noreferrer"
            class="text-primary hover:underline"
          >
            BenchLM
          </a>, och
          <a
            href="https://deepswe.datacurve.ai/blog/deepswe-v1-1"
            target="_blank"
            rel="noopener noreferrer"
            class="text-primary hover:underline"
          >
            Data-Curve DeepSWE v1.1
          </a>.
          BenchLM-data är CC BY-NC 4.0. Uppdatera modelldata för att hämta aktuella värden.
        </p>
      </div>
    </div>
  </UCard>
</template>
