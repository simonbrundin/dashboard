import type { AgentBenchmarkId } from '~/utils/agentBenchmarks'

/**
 * The benchmark the recommendation and the decision table share.
 *
 * Both views read the same measurement, so the numbers on the page can never
 * describe two different runs.
 */
export function useAgentBenchmarkId() {
  return useState<AgentBenchmarkId | null>('models-agent-benchmark-id', () => null)
}

/**
 * How many agent runs the user does per day.
 *
 * Every monthly cost on the page is calculated from this number, so it is
 * shared between the recommendation and the decision table.
 */
export function useAgentTasksPerDay() {
  return useState<number>('models-agent-tasks-per-day', () => 5)
}
