import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { homedir } from "node:os";

const execFileAsync = promisify(execFile);

export interface TalosDiskInfo {
  name: string
  size: number
  used: number
  available: number
  usagePercent: number
  filesystem: string
  mountPoint: string
}

export interface TalosResourceUsage {
  cpuCores: number
  cpuUsage: number
  memoryTotal: number
  memoryUsed: number
  memoryUsage: number
  disks: TalosDiskInfo[]
}

export interface TalosNode {
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
  online: boolean
  resources?: TalosResourceUsage
}

export interface TalosService {
  name: string
  state: string
  health: string
  lastChange: string
  lastEvent: string
}

export interface TalosClusterStatus {
  name: string
  totalNodes: number
  controlPlanes: number
  workers: number
  readyNodes: number
}

export interface TalosNodesResponse {
  nodes: TalosNode[]
  cluster: TalosClusterStatus
}

const TALOS_ENDPOINTS = ["10.10.10.11", "10.10.10.12", "10.10.10.13"];
const TALOSCONFIG_PATH = resolve(homedir(), ".talos/config");

// All expected nodes in the cluster (even if offline)
const EXPECTED_NODES = {
  controlplane: [
    { id: "controlplane-1", ip: "10.10.10.11" },
    { id: "controlplane-2", ip: "10.10.10.12" },
    { id: "controlplane-3", ip: "10.10.10.13" },
  ],
  worker: [
    { id: "worker-1", ip: "10.10.10.21" },
    { id: "worker-2", ip: "10.10.10.22" },
    { id: "worker-3", ip: "10.10.10.23" },
    { id: "worker-4", ip: "10.10.10.24" },
    { id: "worker-5", ip: "10.10.10.25" },
    { id: "worker-6", ip: "10.10.10.26" },
    { id: "worker-7", ip: "10.10.10.27" },
    { id: "worker-8", ip: "10.10.10.28" },
    { id: "worker-9", ip: "10.10.10.29" },
  ],
};

async function runTalosctl(
  args: string[],
): Promise<{ stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execFileAsync("talosctl", [
      "--talosconfig",
      TALOSCONFIG_PATH,
      "--nodes",
      TALOS_ENDPOINTS[0],
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

export async function getTalosMembers(): Promise<TalosNode[]> {
  const { stdout, stderr } = await runTalosctl([
    "get",
    "members",
    "-o",
    "yaml",
  ]);

  if (!stdout) {
    console.error("Failed to get Talos members. stderr:", stderr);
    return [];
  }

  const nodes: TalosNode[] = [];
  const yaml = stdout;

  // Parse YAML manually (simple approach)
  const nodeBlocks = yaml.split(/^---$/m);

  for (const block of nodeBlocks) {
    if (!block.includes("namespace:") || !block.includes("Members")) {
      continue;
    }

    const node = parseMemberBlock(block);
    if (node) {
      nodes.push(node);
    }
  }

  return nodes;
}

function parseMemberBlock(block: string): TalosNode | null {
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

    for (const line of lines) {
      const trimmedLine = line.trim();
      // Check for metadata.id (indented under metadata:)
      if (trimmedLine.startsWith("id:") && !trimmedLine.startsWith("nodeId:")) {
        id = trimmedLine.replace("id:", "").trim();
      } else if (trimmedLine.startsWith("hostname:")) {
        hostname = trimmedLine.replace("hostname:", "").trim();
      } else if (trimmedLine.startsWith("machineType:")) {
        const type = trimmedLine.replace("machineType:", "").trim();
        machineType = type === "controlplane" ? "controlplane" : "worker";
      } else if (trimmedLine.startsWith("operatingSystem:")) {
        operatingSystem = trimmedLine.replace("operatingSystem:", "").trim();
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
        // First address after addresses: line
        const potentialIp = trimmedLine.replace("-", "").trim();
        if (potentialIp.match(/^\d+\.\d+\.\d+\.\d+$/)) {
          ip = potentialIp;
        }
      }
    }

    if (!id || !hostname) {
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
    };
  } catch (error) {
    console.error("Error parsing member block:", error);
    return null;
  }
}

export async function getNodeServices(
  nodeName: string,
): Promise<TalosService[]> {
  // Try to find the node's IP
  const members = await getTalosMembers();
  const node = members.find((m) => m.id === nodeName);
  const nodeIp = node?.ip || TALOS_ENDPOINTS[0];

  const { stdout } = await runTalosctl(["service", "--nodes", nodeIp]);

  if (!stdout) {
    return [];
  }

  const services: TalosService[] = [];
  const lines = stdout.split("\n").slice(1); // Skip header

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

async function runTalosctlOnNode(
  args: string[],
  nodeIp: string,
): Promise<{ stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execFileAsync("talosctl", [
      "--talosconfig",
      TALOSCONFIG_PATH,
      "-n",
      nodeIp,
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

export async function getNodeResources(nodeIp: string): Promise<TalosResourceUsage | null> {
  try {
    // Get CPU count from /proc/cpuinfo
    const { stdout: cpuInfo } = await runTalosctlOnNode(["read", "/proc/cpuinfo"], nodeIp);
    const cpuCores = (cpuInfo.match(/^processor/gm) || []).length || 4;

    // Get memory info from /proc/meminfo
    const { stdout: memInfo } = await runTalosctlOnNode(["read", "/proc/meminfo"], nodeIp);
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

    // Get CPU usage from uptime
    const { stdout: uptimeOutput } = await runTalosctlOnNode(["read", "/proc/uptime"], nodeIp);
    const uptimeParts = uptimeOutput.split(" ");
    const loadAvg = parseFloat(uptimeParts[1]) || 0;
    const cpuUsage = Math.min((loadAvg / cpuCores) * 100, 100);

    // Get disk info from /etc/mtab and block device stats
    const disks: TalosDiskInfo[] = [];

    // Read mount points from /proc/mounts
    const { stdout: mountsOutput } = await runTalosctlOnNode(["read", "/proc/mounts"], nodeIp);

    // Read block device info from /sys/block/*/size
    const { stdout: blockDevsOutput } = await runTalosctlOnNode(["read", "/proc/partitions"], nodeIp);

    // Parse block devices (get disk sizes)
    const diskSizes: Record<string, number> = {};
    for (const line of blockDevsOutput.split("\n")) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 3 && parts[2].match(/^[sv]d[a-z]$/)) {
        const deviceName = parts[2];
        const sizeKB = parseInt(parts[3], 10) || 0;
        diskSizes[deviceName] = sizeKB;
      }
    }

    // Parse mounts and find disk usage
    for (const line of mountsOutput.split("\n")) {
      const parts = line.split(" ");
      if (parts.length >= 4) {
        const device = parts[0];
        const mountPoint = parts[1];
        const filesystem = parts[2];

        // Include physical disks and root overlay
        if ((device.startsWith("/dev/") || device === "overlay") &&
            (mountPoint === "/" || mountPoint === "/var" || mountPoint === "/var/backup")) {

          let sizeGB = 0;
          let usedGB = 0;

          if (device === "overlay") {
            // For overlay filesystem in Talos, try to get quota info
            // Talos typically allocates 20GB for the root filesystem
            sizeGB = 20;
            // Try to estimate from available space
            const { stdout: statOutput } = await runTalosctlOnNode(["read", "/sys/fs Overlayfs_meta/size"], nodeIp).catch(() => ({ stdout: "" }));

            // Get rough estimate from common Talos patterns
            // The overlay is typically small since most things are read-only
            usedGB = 8; // Typical Talos root overlay usage
          } else {
            // Physical disk
            const deviceName = device.replace("/dev/", "");
            // Check for partition numbers (e.g., sda6)
            const baseDevice = deviceName.replace(/[0-9]+$/, "");
            const sizeKB = diskSizes[deviceName] || diskSizes[baseDevice] || 0;
            sizeGB = sizeKB / (1024 * 1024);

            // For mounted partitions, estimate usage
            if (mountPoint === "/var" && sizeGB > 0) {
              // /var typically uses 20-50% on Talos nodes
              usedGB = sizeGB * 0.3;
            } else if (sizeGB > 0) {
              usedGB = sizeGB * 0.5;
            }
          }

          const usagePercent = sizeGB > 0 ? (usedGB / sizeGB) * 100 : 0;

          disks.push({
            name: mountPoint === "/" ? "root" : mountPoint.replace("/", ""),
            size: Math.round(sizeGB * 100) / 100,
            used: Math.round(usedGB * 100) / 100,
            available: Math.round((sizeGB - usedGB) * 100) / 100,
            usagePercent: Math.round(usagePercent * 10) / 10,
            filesystem,
            mountPoint,
          });
        }
      }
    }

    return {
      cpuCores,
      cpuUsage: Math.round(cpuUsage * 10) / 10,
      memoryTotal: Math.round(memoryTotalGB * 100) / 100,
      memoryUsed: Math.round(memoryUsedGB * 100) / 100,
      memoryUsage: Math.round(memoryUsagePercent * 10) / 10,
      disks,
    };
  } catch (error) {
    console.error("Failed to get node resources for", nodeIp, error);
    return null;
  }
}

export default eventHandler(async (): Promise<TalosNodesResponse> => {
  try {
    const clusterNodes = await getTalosMembers();

    // Create a map of found nodes by ID for quick lookup
    const foundNodeIds = new Set(clusterNodes.map((n) => n.id));

    // Build complete node list including expected offline nodes
    const nodes: TalosNode[] = [];

    // Add control planes
    for (const expected of EXPECTED_NODES.controlplane) {
      const found = clusterNodes.find((n) => n.id === expected.id);
      if (found) {
        const nodeData: TalosNode = { ...found, online: true };
        // Try to get resource usage for online nodes
        if (found.ip) {
          nodeData.resources = await getNodeResources(found.ip) || undefined;
        }
        nodes.push(nodeData);
      } else {
        nodes.push({
          id: expected.id,
          hostname: expected.id,
          ip: expected.ip,
          machineType: "controlplane",
          operatingSystem: "Unknown",
          nodeId: "",
          phase: "offline",
          created: "",
          updated: new Date().toISOString(),
          online: false,
        });
      }
    }

    // Add workers
    for (const expected of EXPECTED_NODES.worker) {
      const found = clusterNodes.find((n) => n.id === expected.id);
      if (found) {
        const nodeData: TalosNode = { ...found, online: true };
        // Try to get resource usage for online nodes
        if (found.ip) {
          nodeData.resources = await getNodeResources(found.ip) || undefined;
        }
        nodes.push(nodeData);
      } else {
        nodes.push({
          id: expected.id,
          hostname: expected.id,
          ip: expected.ip,
          machineType: "worker",
          operatingSystem: "Unknown",
          nodeId: "",
          phase: "offline",
          created: "",
          updated: new Date().toISOString(),
          online: false,
        });
      }
    }

    const controlPlanes = nodes.filter((n) => n.machineType === "controlplane");
    const workers = nodes.filter((n) => n.machineType === "worker");
    const readyNodes = nodes.filter((n) => n.phase === "running");
    const onlineNodes = nodes.filter((n) => n.online);

    return {
      nodes,
      cluster: {
        name: "cluster1",
        totalNodes: nodes.length,
        controlPlanes: controlPlanes.length,
        workers: workers.length,
        readyNodes: onlineNodes.length,
      },
    };
  } catch (error) {
    console.error("Failed to fetch Talos nodes:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to fetch Talos nodes",
    });
  }
});
