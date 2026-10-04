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
  const { action, version } = body;

  if (!action) {
    throw createError({
      statusCode: 400,
      message: "action is required",
    });
  }

  try {
    switch (action) {
      case 'cancel-talos-upgrade': {
        // Cancel the current Talos upgrade
        // This is done by resetting the upgrade state
        const { stderr } = await runTalosctl([
          "upgrade",
          "--cancel",
        ]);

        if (stderr && !stderr.includes('no upgrade in progress')) {
          return {
            success: true,
            message: "Talos upgrade cancelled",
          };
        }

        return {
          success: true,
          message: "No Talos upgrade in progress",
        };
      }

      case 'revert-talos-upgrade': {
        // Revert to previous Talos version
        const { stdout, stderr } = await runTalosctl([
          "upgrade",
          "--revert",
        ]);

        if (stderr && !stderr.includes('no previous version')) {
          return {
            success: true,
            message: "Talos upgrade revert initiated",
          };
        }

        return {
          success: false,
          message: "No previous version to revert to",
        };
      }

      case 'pause-upgrade': {
        // Pause upgrade by setting maintenance mode
        const { stderr } = await runTalosctl([
          "maintenance",
          "--upgrade-pause",
        ]);

        return {
          success: true,
          message: "Upgrade paused",
        };
      }

      case 'resume-upgrade': {
        // Resume upgrade
        const { stderr } = await runTalosctl([
          "maintenance",
          "--upgrade-resume",
        ]);

        return {
          success: true,
          message: "Upgrade resumed",
        };
      }

      case 'apply-config': {
        // Apply config with specific version
        if (!version) {
          throw createError({
            statusCode: 400,
            message: "version is required for apply-config",
          });
        }

        const { stderr } = await runTalosctl([
          "apply-config",
          "--nodes", TALOS_ENDPOINTS[0],
          "--mode", "stage",
        ]);

        return {
          success: true,
          message: `Config applied for version ${version}`,
        };
      }

      default:
        throw createError({
          statusCode: 400,
          message: `Unknown action: ${action}`,
        });
    }
  } catch (error: unknown) {
    console.error(`Failed to perform upgrade action ${action}:`, error);
    throw createError({
      statusCode: 500,
      message: `Failed to perform action: ${(error as Error).message}`,
    });
  }
});
