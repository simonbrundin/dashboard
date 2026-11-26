<script setup lang="ts">
useHead({
  title: 'Model Evaluation Methodology | Dashboard',
  meta: [
    {
      name: 'description',
      content: 'How benchmark-specific coding scores, task costs and value rankings are calculated.'
    }
  ]
})

useSeoMeta({
  title: 'Model Evaluation Methodology',
  description: 'Learn how benchmark-specific coding scores and task costs are compared.'
})
</script>

<template>
  <UDashboardPanel id="models-methodology">
    <template #header>
      <UDashboardNavbar title="Model Evaluation Methodology">
        <template #leading>
          <UButton
            to="/models"
            variant="ghost"
            icon="i-lucide-arrow-left"
            aria-label="Back to models"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="p-6 space-y-6 max-w-5xl">
        <UCard>
          <template #header>
            <div>
              <h1 class="text-xl font-semibold">How model value is calculated</h1>
              <p class="text-sm text-muted-foreground mt-1">
                Each ranking uses a score and cost from the same benchmark. The dashboard does not combine unrelated
                scores or task costs into a single points-per-dollar number.
              </p>
            </div>
          </template>

          <div class="space-y-6 text-sm leading-6">
            <section>
              <h2 class="font-semibold text-base">1. Choose a benchmark</h2>
              <p class="text-muted-foreground mt-2">
                DeepSWE v1.1, Terminal-Bench 4.1, Terminal-Bench 4.0, the Artificial Analysis Coding Agent
                Index, and BenchLM are shown as separate views. A score from one source is never paired with a
                cost from another. This matters because the task sets, harnesses, model configurations and score
                definitions differ.
              </p>
              <p class="text-muted-foreground mt-2">
                A model row only matches a measurement when both the release and the reasoning effort match, so a
                Low-effort variant never inherits the cost of the Max-effort run.
              </p>
            </section>

            <section>
              <h2 class="font-semibold text-base">2. DeepSWE v1.1 and Terminal-Bench</h2>
              <p class="text-muted-foreground mt-2">
                These views show each benchmark's own score/pass rate and cost per attempt. Cost per successful task
                is calculated as:
              </p>
              <div class="mt-3 rounded-lg bg-muted p-4 font-mono text-sm">
                Cost per successful task = cost per attempt / pass rate
              </div>
              <p class="text-muted-foreground mt-2">
                The ranking orders models by cost per successful task, lowest first. The pass rate is not divided into
                this cost again; doing so would count success twice. The score remains visible so a low-cost model
                with a weak pass rate is easy to identify. The frontier shows non-dominated score/cost trade-offs
                within the selected benchmark only.
              </p>
              <p class="text-muted-foreground mt-2">
                Terminal-Bench task costs are estimated from Artificial Analysis' public evaluation token counts,
                current token prices and its 66 tasks. Terminal-Bench 4.1 uses the same tasks as 4.0 with updated
                verifiers, and both versions are available as separate views. DeepSWE v1.1 publishes mean task cost
                and pass rate for its long-horizon software-engineering tasks. The two benchmark costs are never
                averaged.
              </p>
            </section>

            <section>
              <h2 class="font-semibold text-base">3. Artificial Analysis Coding Agent Index</h2>
              <p class="text-muted-foreground mt-2">
                This view uses the Coding Agent Index score and the task cost published for that same index:
              </p>
              <div class="mt-3 rounded-lg bg-muted p-4 font-mono text-sm">
                Coding Agent value = Coding Agent Index score / cost per task
              </div>
              <p class="text-muted-foreground mt-2">
                If either value is missing, the model is not ranked in this view. The dashboard does not substitute
                Terminal-Bench, DeepSWE, BenchLM or general Intelligence Index data.
              </p>
            </section>

            <section>
              <h2 class="font-semibold text-base">4. BenchLM</h2>
              <p class="text-muted-foreground mt-2">
                BenchLM is a quality-only view. There is no matched BenchLM task cost, so it is not presented as a
                price/value ranking. Exact-variant matches marked Supported are included by default. Family matches,
                Estimated evidence and other non-exact matches can be included with the opt-in filter and are labeled
                as such; they do not inherit an implied cost.
              </p>
            </section>

            <section>
              <h2 class="font-semibold text-base">5. Matching and missing data</h2>
              <ul class="list-disc list-inside mt-3 space-y-2 text-muted-foreground">
                <li>Each benchmark keeps its raw score, cost per attempt, and cost per successful task separate.</li>
                <li>Cost/value rankings require score/cost data from the same benchmark; BenchLM is explicitly score-only.</li>
                <li>Missing costs and scores remain unavailable; they are never replaced with zero.</li>
                <li>A zero cost is treated as free where that benchmark publishes a complete score/cost pair.</li>
                <li>Family-level BenchLM scores are not treated as exact results for effort-specific model variants by default.</li>
                <li>Each benchmark column is replaced on every import, so a fresh score is never shown next to a stale cost.</li>
              </ul>
            </section>

            <section>
              <h2 class="font-semibold text-base">6. Estimated cost view</h2>
              <p class="text-muted-foreground mt-2">
                The measured benchmarks only cover the models that their publishers have run, so the estimated view
                covers the whole list. It combines each model's own token prices with the median token profile of
                measured models at the same reasoning effort:
              </p>
              <div class="mt-3 rounded-lg bg-muted p-4 font-mono text-sm">
                Estimated cost per attempt = profile tokens × the model's token prices
                <br>
                Estimated value = Intelligence Index / estimated cost per attempt
              </div>
              <p class="text-muted-foreground mt-2">
                This is an approximation and the quality signal is the general Intelligence Index, not a coding
                benchmark. Values are marked with ≈ and the view is kept separate from the measured rankings.
              </p>
            </section>

            <section>
              <h2 class="font-semibold text-base">7. Important interpretation</h2>
              <p class="text-muted-foreground mt-2">
                Published benchmark costs are estimates, not a guarantee of the bill for a specific repository task.
                Actual costs depend on the prompt, context length, reasoning effort, harness, retries, cache behavior,
                provider pricing and task mix. For a production decision, evaluate the same task set with the intended
                harness and report solve rate, cost per attempt and cost per successful task.
              </p>
            </section>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <h2 class="font-semibold">Sources and attribution</h2>
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
              and
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
              Terminal-Bench 4.0:
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
                Data-Curve report
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
                machine-readable dataset and licensing
              </a>.
              BenchLM data is used with attribution under CC BY-NC 4.0; commercial redistribution requires
              permission from BenchLM.
            </p>
            <p>Refresh or import model data from the models page to update the stored source values.</p>
          </div>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
