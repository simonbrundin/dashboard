<template>
  <UCard class="bg-muted/50">
    <div class="flex items-start gap-3">
      <UIcon name="i-lucide-info" class="w-5 h-5 text-muted-foreground mt-0.5" />
      <div class="text-sm text-muted-foreground">
        <p class="font-medium text-foreground mb-1">Methodology</p>
        <p>
          The ranking is benchmark-specific. Select one source at a time; scores from one benchmark are never
          divided by costs from another.
        </p>
        <p class="mt-2">
          <strong class="text-foreground">DeepSWE v1.1 and Terminal-Bench 4.0</strong> show the measured
          pass rate and cost per attempt. Cost per successful task is
          <code>cost_per_attempt / pass_rate</code>, and the ranking orders this cost from lowest to highest.
          The pass rate is not divided into the cost a second time.
        </p>
        <p class="mt-2">
          <strong class="text-foreground">AA Coding Agent Index</strong> uses the score and task cost from
          that same index. Its value metric is <code>index_score / cost_per_task</code>.
        </p>
        <p class="mt-2">
          <strong class="text-foreground">BenchLM</strong> is a quality-only view because there is no matched
          BenchLM task cost. Exact, Supported matches are included by default. Family matches and Estimated
          evidence are opt-in and do not receive an invented price.
        </p>
        <p class="mt-2">
          Pareto frontiers compare score and cost only within the selected benchmark. A zero cost is treated as
          free; missing score or cost stays unavailable rather than becoming zero. Token prices and performance
          from the general Artificial Analysis model list are not substituted for benchmark task costs.
        </p>
        <p class="mt-2 text-xs">
          <NuxtLink
            to="/models/methodology"
            class="text-primary hover:underline"
          >
            Read full methodology and limitations
          </NuxtLink>.
        </p>
        <p class="mt-2 text-xs">
          Sources:
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
          </a>, and
          <a
            href="https://deepswe.datacurve.ai/blog/deepswe-v1-1"
            target="_blank"
            rel="noopener noreferrer"
            class="text-primary hover:underline"
          >
            Data-Curve DeepSWE v1.1
          </a>.
          BenchLM data is CC BY-NC 4.0. Refresh/import model data to retrieve current values.
        </p>
      </div>
    </div>
  </UCard>
</template>
