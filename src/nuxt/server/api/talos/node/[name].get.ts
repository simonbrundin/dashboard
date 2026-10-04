import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { homedir } from "node:os";

const execFileAsync = promisify(execFile);

export interface TalosService {
  name: string
  state: string
  health: string
  lastChange: string
  lastEvent: string
}

export interface TalosNodeDetail {
  id: string
  hostname: string
  ip: string
  machineType: "controlplane" | "worker"
  operatingSystem: string
  nodeId: string
  phase: string
  created: string
  updated: string
  controlPlanePort?: number
  services: TalosService[]
  version: string
  online: boolean
  resources?: {
    cpuCores: number
    cpuUsage: number
    memoryTotal: number
    memoryUsed: number
    memoryUsage: number
    disks?: Array<{
      name: string
      size: number
      used: number
      available: number
      usagePercent: number
      filesystem: string
      mountPoint: string
    }>
  }
  etcdHealth?: {
    healthy: boolean
    memberHealthy: boolean
    leader?: string
  }
}

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
      "--nodes",
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

export default eventHandler(
  async (event): Promise<TalosNodeDetail> => {
    const name = getRouterParam(event, "name");

    if (!name) {
      throw createError({
        statusCode: 400,
        message: "Node name is required",
      });
    }

    try {
      // Get member info
      const { stdout: membersYaml } = await runTalosctl(
        ["get", "members", "-o", "yaml"],
        TALOS_ENDPOINTS[0],
      );

      // Parse the YAML to find our node
      const nodeBlocks = membersYaml.split(/^---$/m);
      let nodeData: TalosNodeDetail | null = null;

      for (const block of nodeBlocks) {
        if (!block.includes("namespace: cluster") || !block.includes("type: Members")) {
          continue;
        }

        const node = parseMemberBlock(block, name);
        if (node) {
          nodeData = node;
          break;
        }
      }

      if (!nodeData) {
        // Node not found in cluster - return offline node
        const isControlPlane = name.startsWith("controlplane");
        const nodeIndex = parseInt(name.replace(isControlPlane ? "controlplane-" : "worker-", ""), 10);
        const baseIp = isControlPlane ? 10 : 20;
        const ip = `10.10.10.${baseIp + nodeIndex}`;

        return {
          id: name,
          hostname: name,
          ip: ip,
          machineType: isControlPlane ? "controlplane" : "worker",
          operatingSystem: "Unknown",
          nodeId: "",
          phase: "offline",
          created: "",
          updated: new Date().toISOString(),
          controlPlanePort: undefined,
          services: [],
          version: "N/A",
          online: false,
        };
      }

      // Get etcd health for control planes
      if (nodeData.machineType === "controlplane") {
        const etcdHealth = await getEtcdHealth(nodeData.ip || TALOS_ENDPOINTS[0]);
        if (etcdHealth) {
          nodeData.etcdHealth = etcdHealth;
        }
      }

      // Get services for this node
      const { stdout: servicesOutput } = await runTalosctl(
        ["service"],
        nodeData.ip || TALOS_ENDPOINTS[0],
      );

      nodeData.services = parseServices(servicesOutput);

      // Get resources for this node
      try {
        const resources = await getNodeResourcesForDetail(nodeData.ip || TALOS_ENDPOINTS[0]);
        if (resources) {
          nodeData.resources = resources;
        }
      } catch (e) {
        console.error("Failed to get node resources:", e);
      }

      return nodeData;
    } catch (error: unknown) {
      if ((error as { statusCode?: number }).statusCode) {
        throw error;
      }
      console.error(`Failed to fetch Talos node ${name}:`, error);
      throw createError({
        statusCode: 500,
        message: `Failed to fetch Talos node: ${name}`,
      });
    }
  },
);

function parseMemberBlock(
  block: string,
  targetName: string,
): TalosNodeDetail | null {
  try {
    const lines = block.split("\n");
    let id = "";
    let hostname = "";
    let ip = "";
    let machineType: "controlplane" | "worker" = "worker";
    let operatingSystem = "";
    let nodeId = "";
    let phase = "";
    let created = "";
    let updated = "";
    let controlPlanePort: number | undefined;
    let version = "";

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith("id:") && !trimmedLine.startsWith("nodeId:")) {
        id = trimmedLine.replace("id:", "").trim();
      } else if (trimmedLine.startsWith("hostname:")) {
        hostname = trimmedLine.replace("hostname:", "").trim();
      } else if (trimmedLine.startsWith("machineType:")) {
        const type = trimmedLine.replace("machineType:", "").trim();
        machineType = type === "controlplane" ? "controlplane" : "worker";
      } else if (trimmedLine.startsWith("operatingSystem:")) {
        operatingSystem = trimmedLine.replace("operatingSystem:", "").trim();
        // Extract version from "Talos (v1.14.0)"
        const match = operatingSystem.match(/v?([\d.]+)/);
        if (match) {
          version = match[1];
        }
      } else if (trimmedLine.startsWith("nodeId:")) {
        nodeId = trimmedLine.replace("nodeId:", "").trim();
      } else if (trimmedLine.startsWith("phase:")) {
        phase = trimmedLine.replace("phase:", "").trim();
      } else if (trimmedLine.startsWith("created:")) {
        created = trimmedLine.replace("created:", "").trim();
      } else if (trimmedLine.startsWith("updated:")) {
        updated = trimmedLine.replace("updated:", "").trim();
      } else if (trimmedLine.startsWith("port:")) {
        controlPlanePort = parseInt(trimmedLine.replace("port:", "").trim(), 10);
      } else if (trimmedLine.startsWith("- ")) {
        const potentialIp = trimmedLine.replace("-", "").trim();
        if (potentialIp.match(/^\d+\.\d+\.\d+\.\d+$/)) {
          ip = potentialIp;
        }
      }
    }

    if (!id) {
      return null;
    }

    // Match by id or hostname
    if (id !== targetName && hostname !== targetName) {
      return null;
    }

    return {
      id,
      hostname,
      ip,
      machineType,
      operatingSystem,
      nodeId,
      phase,
      created,
      updated,
      controlPlanePort,
      services: [],
      version,
      online: true,
    };
  } catch (error) {
    console.error("Error parsing member block:", error);
    return null;
  }
}

function parseServices(output: string): TalosService[] {
  const services: TalosService[] = [];
  const lines = output.split("\n").slice(1); // Skip header

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 5 && !parts[0].startsWith("NODE")) {
      services.push({
        name: parts[1],
        state: parts[2],
        health: parts[3],
        lastChange: parts[4],
        lastEvent: parts.slice(5).join(" "),
      });
    }
  }

  return services;
}

async function getNodeResourcesForDetail(nodeIp: string): Promise<{
  cpuCores: number
  cpuUsage: number
  memoryTotal: number
  memoryUsed: number
  memoryUsage: number
  disks?: Array<{
    name: string
    size: number
    used: number
    available: number
    usagePercent: number
    filesystem: string
    mountPoint: string
  }>
} | null> {
  try {
    // Get CPU count
    const { stdout: cpuInfo } = await runTalosctl(["read", "/proc/cpuinfo"], nodeIp);
    const cpuCores = (cpuInfo.match(/^processor/gm) || []).length || 4;

    // Get memory info
    const { stdout: memInfo } = await runTalosctl(["read", "/proc/meminfo"], nodeIp);
    let memoryTotalKB = 0;
    let memoryAvailableKB = 0;

    for (const line of memInfo.split("\n")) {
      if (line.startsWith("MemTotal:")) {
        memoryTotalKB = parseInt(line.replace(/[^0-9]/g, ""), 10) || 0;
      } else if (line.startsWith("MemAvailable:")) {
        memoryAvailableKB = parseInt(line.replace(/[^0-9]/g, ""), 10) || 0;
      }
    }

    const memoryTotalGB = memoryTotalKB / (1024 * 1024);
    const memoryUsedGB = (memoryTotalKB - memoryAvailableKB) / (1024 * 1024);
    const memoryUsagePercent = memoryTotalKB > 0 ? ((memoryTotalKB - memoryAvailableKB) / memoryTotalKB) * 100 : 0;

    // Get CPU usage
    const { stdout: uptimeOutput } = await runTalosctl(["read", "/proc/uptime"], nodeIp);
    const uptimeParts = uptimeOutput.split(" ");
    const loadAvg = parseFloat(uptimeParts[1]) || 0;
    const cpuUsage = Math.min((loadAvg / cpuCores) * 100, 100);

    return {
      cpuCores,
      cpuUsage: Math.round(cpuUsage * 10) / 10,
      memoryTotal: Math.round(memoryTotalGB * 100) / 100,
      memoryUsed: Math.round(memoryUsedGB * 100) / 100,
      memoryUsage: Math.round(memoryUsagePercent * 10) / 10,
    };
  } catch (error) {
    console.error("Failed to get node resources:", error);
    return null;
  }
}

async function getEtcdHealth(nodeIp: string): Promise<{ healthy: boolean; memberHealthy: boolean; leader?: string } | null> {
  try {
    // Get etcd endpoint health
    const { stdout } = await runTalosctl(["health", "check", "etcd", "--nodes", nodeIp], nodeIp);

    // Parse the output
    const lines = stdout.split("\n");
    let healthy = true;
    let memberHealthy = true;
    let leader: string | undefined;

    for (const line of lines) {
      if (line.includes("is healthy")) {
        // Node is healthy
      } else if (line.includes("is unhealthy") || line.includes("failed")) {
        healthy = false;
      } else if (line.includes("member is healthy")) {
        // Member is healthy
      } else if (line.includes("member is unhealthy") || line.includes("unhealthy")) {
        memberHealthy = false;
      } else if (line.includes("leader")) {
        const match = line.match(/leader[:\s]+(\S+)/i);
        if (match) {
          leader = match[1];
        }
      }
    }

    // Check service status for etcd
    const { stdout: serviceOutput } = await runTalosctl(["service", "etcd"], nodeIp);

    if (serviceOutput.includes("State: Running") && serviceOutput.includes("Health: OK")) {
      // etcd service is running fine
    } else if (serviceOutput.includes("State:")) {
      healthy = serviceOutput.includes("State: Running");
      memberHealthy = serviceOutput.includes("Health: OK");
    }

    return { healthy, memberHealthy, leader };
  } catch (error) {
    console.error("Failed to get etcd health:", error);
    return { healthy: false, memberHealthy: false };
  }
}
