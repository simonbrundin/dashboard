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

export interface EtcdBackup {
  id: string
  createdAt: string
  size: string
  completed: boolean
  nodeName: string
}

export interface EtcdBackupsResponse {
  enabled: boolean
  interval: string
  lastBackup?: string
  backups: EtcdBackup[]
  nextScheduled?: string
}

export default eventHandler(async (): Promise<EtcdBackupsResponse> => {
  // Check for etcd backup snapshots
  const backups: EtcdBackup[] = [];

  try {
    const { stdout } = await runTalosctl([
      "get",
      "etcdsnapshots",
      "-o", "yaml",
    ]);

    // Parse snapshots
    const blocks = stdout.split(/^---$/m);
    
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      if (!block.trim()) continue;

      const createdMatch = block.match(/created:\\s*(.+)/);
      const sizeMatch = block.match(/size:\\s*(\\d+)/);
      
      backups.push({
        id: `backup-${i}`,
        createdAt: createdMatch?.[1] || new Date().toISOString(),
        size: sizeMatch ? `${(parseInt(sizeMatch[1]) / 1024 / 1024).toFixed(1)} MB` : 'Unknown',
        completed: true,
        nodeName: TALOS_ENDPOINTS[0],
      });
    }
  } catch {
    // No backups available
  }

  // Check backup configuration
  let enabled = false;
  let interval = '1h';

  try {
    const { stdout: configOutput } = await runTalosctl([
      "get",
      "clusterconfig",
      "-o", "yaml",
    ]);

    if (configOutput.includes('etcdBackupEnabled') || configOutput.includes('backup:')) {
      enabled = true;
    }
  } catch {
    // Config not available
  }

  return {
    enabled,
    interval,
    lastBackup: backups[0]?.createdAt,
    backups: backups.slice(0, 10), // Last 10 backups
    nextScheduled: enabled ? new Date(Date.now() + 3600000).toISOString() : undefined,
  };
});
