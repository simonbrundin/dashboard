<template>
  <UCard class="bg-muted/50">
    <div class="flex items-start gap-3">
      <UIcon name="i-lucide-info" class="w-5 h-5 text-muted-foreground mt-0.5" />
      <div class="text-sm text-muted-foreground">
        <p class="font-medium text-foreground mb-1">Methodology</p>
        <p>
          <strong class="text-foreground">Combined Coding Score</strong> is the 50/50 average of
          Terminal-Bench 4.0 and BenchLM's Coding score. A model appears in the table if either source
          value is present. The raw Terminal-Bench and BenchLM values remain visible so the result stays
          auditable.
        </p>
        <p class="mt-2">
          <strong class="text-foreground">Cost per Successful Task</strong> is calculated as
          <code>cost_per_attempt / success_rate</code>. Terminal-Bench costs come from AA's evaluation token
          counts; DeepSWE costs come from Data-Curve's published figures. When both are available they are
          averaged with equal benchmark weight.
        </p>
        <p class="mt-2">
          <strong class="text-foreground">Coding Value</strong> is the combined score divided by cost per
          successful task. Speed and latency are operational context only and do not affect value.
        </p>
        <p class="mt-2">
          BenchLM scores are matched to an exact configuration when possible. A base-family fallback is
          labelled separately because an effort-specific BenchLM score may not exist. Supported and Estimated
          evidence statuses are shown; the default ranking excludes Estimated rows, but they can be included
          explicitly with the filter.
        </p>
        <p class="mt-2 text-xs">
          <NuxtLink
            to="/models/methodology"
            class="text-primary hover:underline"
          >
            Läs fullständig metodik och beräkningar
          </NuxtLink>.
        </p>
        <p class="mt-2 text-xs">
          Scores are sourced from
          <a
            href="https://artificialanalysis.ai/"
            target="_blank"
            rel="noopener noreferrer"
            class="text-primary hover:underline"
          >
            Artificial Analysis
          </a>
          (including
          <a
            href="https://artificialanalysis.ai/evaluations/terminalbench-v4-0"
            target="_blank"
            rel="noopener noreferrer"
            class="text-primary hover:underline"
          >
            Terminal-Bench 4.0
          </a>
          ) and
          <a
            href="https://benchlm.ai/"
            target="_blank"
            rel="noopener noreferrer"
            class="text-primary hover:underline"
          >
            BenchLM.ai
          </a>
          (BenchLM data is CC BY-NC 4.0). DeepSWE v1.1 cost data comes from
          <a
            href="https://deepswe.datacurve.ai/blog/deepswe-v1-1"
            target="_blank"
            rel="noopener noreferrer"
            class="text-primary hover:underline"
          >
            Data-Curve's report
          </a>.
          Refresh/import model data to retrieve the latest values.
        </p>
      </div>
    </div>
  </UCard>
</template>
