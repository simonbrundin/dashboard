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

export interface HardwareInfo {
  processors: {
    model: string
    cores: number
    frequency: string
  }[]
  memory: {
    total: string
    modules: {
      size: string
      speed: string
      type: string
    }[]
  }
  network: {
    interfaces: {
      name: string
      mac: string
      ip: string
      status: string
    }[]
  }
  disks: {
    name: string
    size: string
    type: string
    vendor: string
  }[]
}

export interface HardwareResponse {
  hostname: string
  hardware: HardwareInfo
}

export default eventHandler(async (event): Promise<HardwareResponse> => {
  const query = getQuery(event);
  const nodeName = query.node as string || 'controlplane-1';

  // Find node IP
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

  // Get system info
  const { stdout: systemInfoOutput } = await runTalosctl([
    "get",
    "systeminformation",
    "-o", "yaml",
  ], nodeIp);

  // Get CPU info for core count
  const { stdout: cpuInfoOutput } = await runTalosctl([
    "read",
    "/proc/cpuinfo",
  ], nodeIp);

  // Count processors from cpuinfo
  let coreCount = 0;
  const cpuLines = cpuInfoOutput.split('\n');
  for (const line of cpuLines) {
    if (line.startsWith('processor')) {
      coreCount++;
    }
  }

  const processors: HardwareInfo['processors'] = [];
  const memoryModules: HardwareInfo['memory'] = { total: 'Unknown', modules: [] };

  // Parse YAML system information
  const specMatch = systemInfoOutput.match(/^spec:$/m);
  if (specMatch) {
    const specStart = systemInfoOutput.indexOf('spec:');
    const specContent = systemInfoOutput.slice(specStart);

    // Extract manufacturer and product name
    const manufacturer = specContent.match(/manufacturer:\s*(.+)/)?.[1] || '';
    const productName = specContent.match(/productName:\s*(.+)/)?.[1] || '';
    const serialNumber = specContent.match(/serialnumber:\s*(.+)/)?.[1] || '';

    // Add a "processor" entry with the board info
    if (productName) {
      processors.push({
        model: productName,
        cores: coreCount,
        frequency: manufacturer,
      });
    }
  }

  // Get memory info
  const { stdout: memOutput } = await runTalosctl(["read", "/proc/meminfo"], nodeIp);
  const memLines = memOutput.split('\n');
  let memTotal = 0;

  for (const line of memLines) {
    if (line.startsWith('MemTotal:')) {
      const match = line.match(/(\d+)/);
      if (match) {
        memTotal = parseInt(match[1]) / 1024 / 1024; // KB to GB
        memoryModules.total = `${memTotal.toFixed(1)} GB`;
      }
    }
  }

  // Get network interfaces
  const networkInterfaces: HardwareInfo['network']['interfaces'] = [];
  try {
    const { stdout: networkOutput } = await runTalosctl([
      "get",
      "networkstatus",
      "-o", "yaml",
    ], nodeIp);

    const netBlocks = networkOutput.split(/^---$/m);
    for (const block of netBlocks) {
      if (block.includes('linux_name:')) {
        const nameMatch = block.match(/linux_name:\s*(.+)/);
        const macMatch = block.match(/hardward_address:\s*(.+)/) || block.match(/address:\s*(.+)/);
        const ipMatch = block.match(/inet\s+(\d+\.\d+\.\d+\.\d+)/);

        if (nameMatch) {
          networkInterfaces.push({
            name: nameMatch[1].trim(),
            mac: macMatch ? macMatch[1].trim() : 'N/A',
            ip: ipMatch ? ipMatch[1].trim() : 'N/A',
            status: block.includes('link_up: true') ? 'UP' : 'DOWN',
          });
        }
      }
    }
  } catch {
    // Try alternative method
  }

  // Get disk info
  const disks: HardwareInfo['disks'] = [];
  try {
    const { stdout: diskOutput } = await runTalosctl([
      "get",
      "disk",
      "-o", "yaml",
    ], nodeIp);

    const diskBlocks = diskOutput.split(/^---$/m);
    for (const block of diskBlocks) {
      if (block.includes('device_name:')) {
        const nameMatch = block.match(/device_name:\s*(.+)/);
        const sizeMatch = block.match(/size:\s*(\d+)/);
        const typeMatch = block.match(/type:\s*(.+)/);
        const vendorMatch = block.match(/vendor:\s*(.+)/);

        if (nameMatch) {
          let sizeStr = 'Unknown';
          if (sizeMatch) {
            const sizeGB = parseInt(sizeMatch[1]) / 1024 / 1024 / 1024;
            sizeStr = sizeGB >= 1 ? `${sizeGB.toFixed(1)} GB` : `${(sizeGB * 1024).toFixed(0)} MB`;
          }

          disks.push({
            name: nameMatch[1].trim(),
            size: sizeStr,
            type: typeMatch ? typeMatch[1].trim() : 'Unknown',
            vendor: vendorMatch ? vendorMatch[1].trim() : 'Unknown',
          });
        }
      }
    }
  } catch {
    // Disks might not be available
  }

  return {
    hostname: nodeName,
    hardware: {
      processors,
      memory: memoryModules,
      network: { interfaces: networkInterfaces },
      disks,
    },
  };
});
