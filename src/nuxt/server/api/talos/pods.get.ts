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

export interface Pod {
  name: string
  namespace: string
  ready: string
  status: string
  restarts: number
  age: string
  nodeName: string
}

export interface PodsResponse {
  nodeName: string
  pods: Pod[]
}

export default eventHandler(async (event): Promise<PodsResponse> => {
  const query = getQuery(event);
  const nodeName = query.node as string || 'controlplane-1';

  const nodeMap: Record<string, string> = {
    'controlplane-1': '10.10.10.11',
    'controlplane-2': '10.10.10.12',
    'controlplane-3': '10.10.10.13',
    'worker-1': '10.10.10.21',
    'worker-2': '10.10.10.22',
    'worker-3': '10.10.10.23',
    'worker-4': '10.10.10.24',
    'worker-5': '10.10.10.25',
    'worker-6': '10.10.10.26',
    'worker-7': '10.10.10.27',
    'worker-8': '10.10.10.28',
    'worker-9': '10.10.10.29',
  };

  const nodeIp = nodeMap[nodeName] || TALOS_ENDPOINTS[0];
  const pods: Pod[] = [];

  try {
    // Get containers from the node using CRI namespace
    const { stdout } = await runTalosctl([
      "containers",
      "--namespace", "cri",
    ], nodeIp);

    // Parse the table output
    const lines = stdout.split('\n');
    
    // Map to track unique pods
    const podMap = new Map<string, {
      name: string
      namespace: string
      status: string
      restarts: number
      totalContainers: number
      runningContainers: number
    }>();

    for (const line of lines) {
      // Skip header and empty lines
      if (!line.trim() || line.startsWith('NODE')) continue;
      if (line.includes('─────')) continue;
      if (!line.includes('CONTAINER_')) continue;

      // Split and filter empty parts
      const parts = line.split(/\s+/).filter(p => p.length > 0);
      
      // The format is: NODE NAMESPACE TREE ID IMAGE PID STATUS
      // TREE is one of: └─, ├─, │
      if (parts.length < 7) continue;

      const namespace = parts[1];
      const id = parts[3]; // ID is at index 3
      const status = parts[parts.length - 1];

      // Skip sandbox containers
      if (status === 'SANDBOX_READY') continue;

      // Parse the ID (format: namespace/podname:containername:hash)
      const idMatch = id.match(/^([\w\-\.]+\/[\w\-\.]+):([\w\-]+):([a-f0-9]+)$/);
      if (!idMatch) continue;

      const podId = idMatch[1];
      const containerName = idMatch[2];
      
      // Skip init containers
      if (containerName === 'install-config' || containerName === 'bootstrap-controller') continue;

      if (!podMap.has(podId)) {
        podMap.set(podId, {
          name: podId.split('/')[1],
          namespace: podId.split('/')[0],
          status: status === 'CONTAINER_RUNNING' ? 'Running' : status.replace('CONTAINER_', ''),
          restarts: 0,
          totalContainers: 0,
          runningContainers: 0,
        });
      }
      
      const pod = podMap.get(podId)!;
      pod.totalContainers++;
      if (status === 'CONTAINER_RUNNING') {
        pod.runningContainers++;
      }
    }

    // Convert to pods array
    for (const pod of podMap.values()) {
      pods.push({
        name: pod.name,
        namespace: pod.namespace,
        ready: `${pod.runningContainers}/${pod.totalContainers}`,
        status: pod.status,
        restarts: pod.restarts,
        age: 'running',
        nodeName,
      });
    }
  } catch (error) {
    console.error(`Failed to get pods for ${nodeName}:`, error);
  }

  return {
    nodeName,
    pods: pods.sort((a, b) => `${a.namespace}/${a.name}`.localeCompare(`${b.namespace}/${b.name}`)),
  };
});
