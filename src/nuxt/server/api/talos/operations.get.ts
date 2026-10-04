import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { homedir } from "node:os";

const execFileAsync = promisify(execFile);

const TALOS_ENDPOINTS = ["10.10.10.11", "10.10.10.12", "10.10.10.13"];
const TALOSCONFIG_PATH = resolve(homedir(), ".talos/config");

async function runTalosctl(
  args: string[],
  nodeIp?: string,
): Promise<{ stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execFileAsync("talosctl", [
      "--talosconfig",
      TALOSCONFIG_PATH,
      "-n",
      nodeIp || TALOS_ENDPOINTS[0],
      ...args,
    ]);
    return { stdout, stderr };
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string; message?: string };
    return {
      stdout: execError.stdout || "",
      stderr: execError.stderr || execError.message || "",
    };
  }
}

export interface Operation {
  id: string
  type: 'upgrade' | 'backup' | 'config' | 'drain' | 'other'
  status: 'in_progress' | 'completed' | 'failed' | 'pending'
  nodeName: string
  description: string
  startedAt: string
  completedAt?: string
  progress?: number
}

export interface OperationsResponse {
  operations: Operation[]
  hasOngoing: boolean
}

export default eventHandler(async (): Promise<OperationsResponse> => {
  const operations: Operation[] = [];

  // Check for ongoing upgrades
  try {
    const { stdout: upgradeStatus } = await runTalosctl([
      "get",
      "machineupgradeinfos",
      "-o", "yaml",
    ]);

    if (upgradeStatus.includes('upgrading: true') || upgradeStatus.includes('phase: upgrading')) {
      operations.push({
        id: 'talos-upgrade',
        type: 'upgrade',
        status: 'in_progress',
        nodeName: 'cluster',
        description: 'Talos upgrade in progress',
        startedAt: new Date().toISOString(),
        progress: 50,
      });
    }
  } catch {
    // No upgrade in progress
  }

  // Check for node drains (from previous drain API calls)
  // In a real implementation, this would check persistent state

  return {
    operations,
    hasOngoing: operations.some(op => op.status === 'in_progress' || op.status === 'pending'),
  };
});
