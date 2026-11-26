import type { ModelData } from '~/data/models'

/**
 * The benchmarks that pair a quality score with a cost of the same run.
 *
 * Score and cost are only ever read from the same benchmark. A Terminal-Bench
 * pass rate is never divided by an Artificial Analysis cost - that mixes two
 * different workloads and produces a number that means nothing.
 */
export type AgentBenchmarkId =
  | 'terminal-bench-4.1'
  | 'terminal-bench-4.0'
  | 'deep-swe'
  | 'aa-coding-agent'

export interface AgentBenchmark {
  id: AgentBenchmarkId
  label: string
  /** What the score measures, in plain language. */
  scoreLabel: string
  /**
   * True when the score is a pass rate in percent, so the cost of one
   * successful task can be derived from the cost of one attempt.
   */
  isPassRate: boolean
  /** The benchmark's quality score for a model, null when not measured. */
  score: (model: ModelData) => number | null
  /** Cost of one successful task in USD, when the benchmark publishes it. */
  costPerSolvedTask: (model: ModelData) => number | null
  /** Cost of one attempt in USD. */
  costPerAttempt: (model: ModelData) => number | null
  /** The agent harness the benchmark was run with, when it is documented. */
  harness: string | null
  /** The harness of a single row, when each row names its own. */
  harnessFor?: (model: ModelData) => string | null
  /** The published confidence interval of a single row, when it has one. */
  confidenceFor?: (model: ModelData) => { low: number | null; high: number | null } | null
}

function finite(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export const AGENT_BENCHMARKS: AgentBenchmark[] = [
  {
    id: 'terminal-bench-4.1',
    label: 'Terminal-Bench 4.1',
    scoreLabel: 'löser Terminal-Bench-uppgifterna',
    isPassRate: true,
    score: model => finite(model.terminalBench41Score),
    costPerSolvedTask: model => finite(model.terminalBench41CostPerSuccessfulTask),
    costPerAttempt: model => finite(model.terminalBench41CostPerTask),
    // Artificial Analysis states that it runs its Terminal-Bench evaluations
    // with the mini-swe-agent harness, pass@1 averaged over three repeats.
    harness: 'mini-swe-agent'
  },
  {
    id: 'terminal-bench-4.0',
    label: 'Terminal-Bench 4.0',
    scoreLabel: 'löser Terminal-Bench-uppgifterna',
    isPassRate: true,
    score: model => finite(model.terminalBenchScore),
    costPerSolvedTask: model => finite(model.terminalBenchCostPerSuccessfulTask),
    costPerAttempt: model => finite(model.terminalBenchCostPerTask),
    harness: 'mini-swe-agent'
  },
  {
    id: 'deep-swe',
    label: 'DeepSWE v1.1',
    scoreLabel: 'löser riktiga issue-uppgifter',
    isPassRate: true,
    score: model => finite(model.deepSweScore),
    costPerSolvedTask: model => finite(model.deepSweCostPerSuccessfulTask),
    costPerAttempt: model => finite(model.deepSweCostPerTask),
    // Every DeepSWE row publishes its own harness.
    harness: null,
    harnessFor: model => model.deepSweHarness ?? null,
    confidenceFor: model =>
      model.deepSweCiLow != null && model.deepSweCiHigh != null
        ? { low: model.deepSweCiLow, high: model.deepSweCiHigh }
        : null
  },
  {
    id: 'aa-coding-agent',
    label: 'AA Coding Agent Index',
    scoreLabel: 'poäng i AA:s agentindex',
    isPassRate: false,
    score: model => finite(model.aaCodingAgentIndex),
    // AA publishes the cost of the whole agent run, not per solved task.
    costPerSolvedTask: () => null,
    costPerAttempt: model => finite(model.aaCodingAgentCostPerTask),
    // Each row names its own agent (Codex, Claude Code, ...).
    harness: null,
    harnessFor: model => model.aaCodingAgentName ?? null
  }
]

export function getAgentBenchmark(id: AgentBenchmarkId): AgentBenchmark {
  const found = AGENT_BENCHMARKS.find(benchmark => benchmark.id === id)
  if (!found) throw new Error(`Unknown agent benchmark: ${id}`)
  return found
}

/**
 * The cost of one agent task, with the denominator spelled out.
 *
 * `per-solved-task` is the number that answers "how much does it cost me to
 * get a working result". It is only available when the benchmark reports a
 * pass rate - otherwise the cost is per attempt and a model that fails often
 * looks cheaper than it is.
 */
export interface AgentCostBasis {
  /** Cost per successful task, when the benchmark's pass rate is known. */
  costPerSolvedTask: number | null
  /** Cost per attempt. */
  costPerAttempt: number | null
  /** Pass rate in percent from the same benchmark. */
  passRate: number | null
  /** Which benchmark the numbers come from. */
  benchmark: AgentBenchmarkId
  /** True when only a per-attempt cost is known. */
  isPerAttempt: boolean
}

/**
 * Reads the cost of one agent task for a model from a single benchmark.
 *
 * The benchmark's own cost per successful task is preferred. When it is
 * missing but a pass rate and a per-attempt cost are known, the cost per
 * successful task is derived - cost per attempt divided by the pass rate.
 */
export function resolveCostBasis(
  model: ModelData,
  benchmark: AgentBenchmark
): AgentCostBasis | null {
  const score = benchmark.score(model)
  const costPerAttempt = benchmark.costPerAttempt(model)
  const published = benchmark.costPerSolvedTask(model)

  if (published != null) {
    return {
      costPerSolvedTask: published,
      costPerAttempt,
      passRate: score,
      benchmark: benchmark.id,
      isPerAttempt: false
    }
  }

  if (costPerAttempt == null) return null

  if (benchmark.isPassRate && score != null && score > 0) {
    return {
      costPerSolvedTask: costPerAttempt / (score / 100),
      costPerAttempt,
      passRate: score,
      benchmark: benchmark.id,
      isPerAttempt: false
    }
  }

  return {
    costPerSolvedTask: null,
    costPerAttempt,
    passRate: benchmark.isPassRate ? score : null,
    benchmark: benchmark.id,
    isPerAttempt: true
  }
}

/**
 * Converts a cost per attempt into a cost per solved task.
 *
 * The pass rate has to come from the same benchmark as the cost, otherwise
 * the two numbers do not describe the same run.
 */
export function costPerSolvedTaskFrom(
  costPerAttempt: number | null | undefined,
  passRate: number | null | undefined
): number | null {
  if (costPerAttempt == null || !Number.isFinite(costPerAttempt)) return null
  if (passRate == null || !Number.isFinite(passRate) || passRate <= 0) return null
  return costPerAttempt / (passRate / 100)
}

/**
 * How many models have a usable score and cost in a benchmark. Used to show
 * how much choice a benchmark actually offers.
 */
export function benchmarkCoverage(
  models: ModelData[],
  benchmark: AgentBenchmark
): { withScore: number; withCost: number } {
  let withScore = 0
  let withCost = 0
  for (const model of models) {
    if (benchmark.score(model) != null) withScore++
    if (benchmark.costPerSolvedTask(model) != null || benchmark.costPerAttempt(model) != null) {
      withCost++
    }
  }
  return { withScore, withCost }
}
