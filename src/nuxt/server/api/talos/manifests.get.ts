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

export interface Manifest {
  name: string
  namespace: string
  state: 'Applied' | 'Pending' | 'Error'
  status: string
}

export interface ManifestsResponse {
  manifests: Manifest[]
  summary: {
    total: number
    applied: number
    pending: number
    error: number
  }
}

export default eventHandler(async (): Promise<ManifestsResponse> => {
  const manifests: Manifest[] = [];

  try {
    // Get kubernetes manifests from the API
    const { stdout } = await runTalosctl([
      "get",
      "manifest",
      "-o", "yaml",
    ]);

    // Parse YAML output
    const blocks = stdout.split(/^---$/m);
    
    for (const block of blocks) {
      if (!block.trim()) continue;
      
      // Extract metadata
      const nameMatch = block.match(/id:\s*(.+)/);
      const namespaceMatch = block.match(/namespace:\s*(.+)/);
      const phaseMatch = block.match(/phase:\s*(.+)/);
      
      const name = nameMatch?.[1] || 'unknown';
      const namespace = namespaceMatch?.[1] || 'default';
      const phase = phaseMatch?.[1] || 'applied';
      
      let state: 'Applied' | 'Pending' | 'Error' = 'Applied';
      let status = 'Applied successfully';
      
      if (phase.includes('pending') || phase.includes('Pending')) {
        state = 'Pending';
        status = 'Waiting to be applied';
      } else if (phase.includes('error') || phase.includes('Error') || phase.includes('failed')) {
        state = 'Error';
        status = 'Failed to apply';
      }
      
      manifests.push({ name, namespace, state, status });
    }
  } catch (error) {
    console.error('Failed to get manifests:', error);
  }

  const summary = {
    total: manifests.length,
    applied: manifests.filter(m => m.state === 'Applied').length,
    pending: manifests.filter(m => m.state === 'Pending').length,
    error: manifests.filter(m => m.state === 'Error').length,
  };

  return { manifests, summary };
});
