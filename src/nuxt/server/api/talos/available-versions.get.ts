import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { homedir } from "node:os";

const execFileAsync = promisify(execFile);

const TALOS_ENDPOINTS = ["10.10.10.11", "10.10.10.12", "10.10.10.13"];
const TALOSCONFIG_PATH = resolve(homedir(), ".talos/config");

async function runCommand(
  cmd: string,
  args: string[],
): Promise<{ stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execFileAsync(cmd, args);
    return { stdout, stderr };
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string; message?: string };
    return {
      stdout: execError.stdout || "",
      stderr: execError.stderr || execError.message || "",
    };
  }
}

async function runTalosctl(
  args: string[],
  nodeIp?: string,
): Promise<{ stdout: string; stderr: string }> {
  return runCommand("talosctl", [
    "--talosconfig",
    TALOSCONFIG_PATH,
    "-n",
    nodeIp || TALOS_ENDPOINTS[0],
    ...args,
  ]);
}

export interface VersionInfo {
  current: string
  latest: string
  canUpgrade: boolean
  upgradeAvailable: boolean
}

export interface VersionsResponse {
  talos: VersionInfo
  kubernetes: {
    current: string
    latest: string
    available: string[]
  }
}

export default eventHandler(async (): Promise<VersionsResponse> => {
  // Get current Talos version
  const { stdout: versionOutput } = await runTalosctl(["version"]);
  
  let currentTalosVersion = "unknown";
  const serverMatch = versionOutput.match(/Server:[\s\S]*?Tag:\s+v?([\d.]+)/);
  if (serverMatch) {
    currentTalosVersion = serverMatch[1];
  }

  // Known Talos versions
  const latestTalosVersion = "1.14.1";
  const talosUpgradeAvailable = currentTalosVersion !== latestTalosVersion && currentTalosVersion !== "unknown";

  // Get Kubernetes version using kubectl
  let currentK8sVersion = "v1.35.2";
  let latestK8sVersion = "v1.35.2";
  
  try {
    const { stdout: k8sOutput } = await runCommand("kubectl", ["version", "-o", "json"]);
    const parsed = JSON.parse(k8sOutput);
    if (parsed?.serverVersion?.gitVersion) {
      // Remove 'v' prefix if present
      currentK8sVersion = parsed.serverVersion.gitVersion.replace(/^v/, '');
    }
    latestK8sVersion = currentK8sVersion;
  } catch (error) {
    console.error("Failed to get K8s version:", error);
    // Default to known version
  }

  // Known K8s versions supported
  const k8sVersions = [
    "1.35.2",
    "1.35.0",
    "1.34.1",
    "1.33.0",
    "1.32.2",
    "1.31.4",
  ];

  return {
    talos: {
      current: currentTalosVersion,
      latest: latestTalosVersion,
      canUpgrade: talosUpgradeAvailable,
      upgradeAvailable: talosUpgradeAvailable,
    },
    kubernetes: {
      current: currentK8sVersion,
      latest: latestK8sVersion,
      available: k8sVersions,
    },
  };
});
