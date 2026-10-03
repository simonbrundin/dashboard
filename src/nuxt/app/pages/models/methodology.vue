<script setup lang="ts">
useHead({
  title: 'Model Evaluation Methodology | Dashboard',
  meta: [
    {
      name: 'description',
      content: 'How the dashboard combines coding scores and calculates coding value per task dollar.'
    }
  ]
})

useSeoMeta({
  title: 'Model Evaluation Methodology',
  description: 'Learn how combined coding scores, task costs and coding value are calculated.'
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
                The goal is to find coding capability per dollar without hiding the underlying evidence or mixing unlike cost measurements.
              </p>
            </div>
          </template>

          <div class="space-y-6 text-sm leading-6">
            <section>
              <h2 class="font-semibold text-base">1. Combined Coding Score</h2>
              <p class="text-muted-foreground mt-2">
                The displayed cross-source quality score is a transparent 50/50 average of two separately published coding signals:
              </p>
              <div class="mt-3 rounded-lg bg-muted p-4 font-mono text-sm">
                Combined Coding Score = (Terminal-Bench Score + BenchLM Score) / 2
              </div>
              <p class="text-muted-foreground mt-2">
                A model appears in the table if <em>either</em> source value is present. The raw Terminal-Bench
                and BenchLM values remain visible in the model table. Because both sources are composites and may
                overlap in their benchmark evidence, this is not treated as an average of statistically independent
                measurements.
              </p>
            </section>

            <section>
              <h2 class="font-semibold text-base">2. Which cost is used?</h2>
              <p class="text-muted-foreground mt-2">
                The Coding Value ranking uses measured coding-agent benchmark costs:
              </p>
              <ol class="list-decimal list-inside mt-3 space-y-2 text-muted-foreground">
                <li>Average of measured Terminal-Bench 4.0 and DeepSWE v1.1 costs when both exist.</li>
                <li>The one available coding benchmark cost when only one exists.</li>
              </ol>
              <p class="text-muted-foreground mt-2">
                Terminal-Bench 4.0 costs are calculated from the public Artificial Analysis evaluation token
                counts and pricing for its 66 tasks. DeepSWE v1.1 publishes its average cost per task and pass
                rate for 113 long-horizon software-engineering tasks. The dashboard calculates cost per
                successful task as <code>cost_per_attempt / success_rate</code>. Missing benchmark costs remain
                missing and are never replaced with zero. The current average gives Terminal-Bench and DeepSWE
                equal benchmark weight; it is not a task-count-weighted pooled cost.
              </p>
              <p class="text-muted-foreground mt-2">
                A zero cost is treated as free. A missing cost is treated as unavailable; those states are not
                conflated.
              </p>
            </section>

            <section>
              <h2 class="font-semibold text-base">3. Coding Value</h2>
              <div class="mt-3 rounded-lg bg-muted p-4 font-mono text-sm">
                Coding Value = Combined Coding Score / cost per successful task
                <br>
                Cost per Successful Task = cost per attempt / success rate
              </div>
              <p class="text-muted-foreground mt-2">
                The result is displayed as coding points per dollar per successful task. A free scored model is
                shown as Free. Speed and latency do not affect value.
              </p>
            </section>

            <section>
              <h2 class="font-semibold text-base">4. Why benchmark-specific costs are useful</h2>
              <p class="text-muted-foreground mt-2">
                Terminal-Bench and DeepSWE exercise different agentic software-engineering workflows. The
                dashboard currently gives the two available benchmark costs equal weight when both exist. This
                is a deliberate neutral mixture, not a claim that the benchmarks represent identical tasks. The
                individual costs remain visible for auditability. Artificial Analysis also publishes a
                same-suite Coding Agent Index with pooled efficiency metrics; integrating that score/cost pair is
                a future same-suite comparison path.
              </p>
            </section>

            <section>
              <h2 class="font-semibold text-base">5. Ranking safeguards</h2>
              <ul class="list-disc list-inside mt-3 space-y-2 text-muted-foreground">
                <li>A model appears in the table if it has a coding score (Terminal-Bench or BenchLM) or a cost per successful task.</li>
                <li>The Coding Value ranking requires both a coding score and a measured cost per successful task.</li>
                <li>BenchLM exact-variant versus base-family matching is shown next to the score.</li>
                <li>BenchLM Supported/Estimated evidence status is shown; the default ranking excludes Estimated rows, with an explicit opt-in filter.</li>
                <li>General Intelligence is shown as a secondary comparison signal.</li>
              </ul>
            </section>

            <section>
              <h2 class="font-semibold text-base">6. Important interpretation</h2>
              <p class="text-muted-foreground mt-2">
                Coding Value is a comparison metric, not a guarantee of the cost or success rate for a specific
                repository task. Agent trajectories are stochastic and depend on the harness, prompt, context,
                reasoning effort, retries and cache behaviour. Public benchmark costs are provider-token-cost
                estimates rather than consumer-plan or infrastructure bills. For an important production
                decision, measure the same task set with the intended harness and report solve rate, cost per
                attempt and cost per successful task.
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
              </a>
              . DeepSWE v1.1:
              <a
                href="https://deepswe.datacurve.ai/blog/deepswe-v1-1"
                target="_blank"
                rel="noopener noreferrer"
                class="text-primary hover:underline"
              >
                Data-Curve report
              </a>
              .
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
              </a>
              . BenchLM data is used with attribution under CC BY-NC 4.0; commercial redistribution requires
              permission from BenchLM.
            </p>
            <p>
              Refresh or import model data from the models page to update the stored source values.
            </p>
          </div>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
