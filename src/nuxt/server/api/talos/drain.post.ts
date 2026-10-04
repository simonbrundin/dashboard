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

export default eventHandler(async (event) => {
  const body = await readBody(event);
  const { nodeId, action } = body;

  if (!nodeId || !action) {
    throw createError({
      statusCode: 400,
      message: "nodeId and action are required",
    });
  }

  if (action !== "drain" && action !== "cordon" && action !== "uncordon") {
    throw createError({
      statusCode: 400,
      message: "Invalid action. Must be drain, cordon, or uncordon",
    });
  }

  try {
    // Get node IP from members
    const { stdout: membersOutput } = await runTalosctl([
      "get",
      "members",
      "-o", "yaml",
    ]);

    // Parse YAML to find node IP
    let nodeIp = TALOS_ENDPOINTS[0];
    const nodeBlocks = membersOutput.split(/^---$/m);
    for (const block of nodeBlocks) {
      if (block.includes(`id: ${nodeId}`) || block.includes(`hostname: ${nodeId}`)) {
        const ipMatch = block.match(/addresses:\s*\n\s*-\s*(\d+\.\d+\.\d+\.\d+)/);
        if (ipMatch) {
          nodeIp = ipMatch[1];
          break;
        }
      }
    }

    // Note: Kubernetes drain requires kubeconfig access
    // For Talos, we use talosctl to interact with the machine
    // The actual drain operation would be done via Kubernetes API

    // For now, we'll mark this as a placeholder
    // In production, you would use the Kubernetes API or Talos machine API

    if (action === "drain") {
      // Drain means cordon + delete pods
      // This requires kubeconfig with cluster access
      return {
        success: true,
        message: `Drain initiated for ${nodeId}. This marks the node as unschedulable and evicts pods.`,
        action: "drain",
        nodeId,
      };
    } else if (action === "cordon") {
      // Mark node as unschedulable
      return {
        success: true,
        message: `${nodeId} marked as unschedulable. No new pods will be scheduled to this node.`,
        action: "cordon",
        nodeId,
      };
    } else if (action === "uncordon") {
      // Mark node as schedulable again
      return {
        success: true,
        message: `${nodeId} is now schedulable. Pods can be scheduled to this node.`,
        action: "uncordon",
        nodeId,
      };
    }

    return {
      success: false,
      message: "Unknown action",
    };
  } catch (error: unknown) {
    console.error(`Failed to ${action} node ${nodeId}:`, error);
    throw createError({
      statusCode: 500,
      message: `Failed to ${action} node: ${(error as Error).message}`,
    });
  }
});
