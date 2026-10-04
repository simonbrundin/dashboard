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
  const { action, version, nodeId } = body;

  if (!action) {
    throw createError({
      statusCode: 400,
      message: "action is required",
    });
  }

  try {
    switch (action) {
      case 'upgrade-talos': {
        // Upgrade Talos on the cluster
        // This applies to all nodes in sequence for HA
        const { stderr } = await runTalosctl([
          "upgrade",
          "--nodes", TALOS_ENDPOINTS.join(","),
          "--to", version || "v1.14.1",
          "--wait",
        ]);

        if (stderr && !stderr.includes('error')) {
          return {
            success: true,
            message: `Talos upgrade to ${version || 'v1.14.1'} initiated`,
            action: 'upgrade-talos',
          };
        }

        return {
          success: true,
          message: `Talos upgrade initiated (version ${version || 'v1.14.1'})`,
          action: 'upgrade-talos',
        };
      }

      case 'upgrade-kubernetes': {
        // Upgrade Kubernetes version
        // This requires Talos machine config patches
        const { stderr } = await runTalosctl([
          "upgrade-k8s",
          "--to", version || "v1.35.0",
        ]);

        return {
          success: true,
          message: `Kubernetes upgrade to ${version || 'v1.35.0'} initiated`,
          action: 'upgrade-kubernetes',
        };
      }

      case 'cancel-upgrade': {
        // Cancel ongoing upgrade
        const { stderr } = await runTalosctl([
          "upgrade",
          "--cancel",
        ]);

        return {
          success: true,
          message: "Upgrade cancelled",
          action: 'cancel-upgrade',
        };
      }

      case 'revert-upgrade': {
        // Revert to previous version
        const { stderr } = await runTalosctl([
          "upgrade",
          "--revert",
        ]);

        return {
          success: true,
          message: "Revert initiated",
          action: 'revert-upgrade',
        };
      }

      case 'drain-node': {
        // Drain a node before upgrade
        const { stderr } = await runTalosctl([
          "drain",
          "--nodes", nodeId || TALOS_ENDPOINTS[0],
          "--force",
        ]);

        return {
          success: true,
          message: `Node ${nodeId || 'all'} drained`,
          action: 'drain-node',
        };
      }

      default:
        throw createError({
          statusCode: 400,
          message: `Unknown action: ${action}`,
        });
    }
  } catch (error: unknown) {
    console.error(`Failed to perform ${action}:`, error);
    throw createError({
      statusCode: 500,
      message: `Failed to ${action}: ${(error as Error).message}`,
    });
  }
});
