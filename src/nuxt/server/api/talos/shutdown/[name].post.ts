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
): Promise<{ stdout: string; stderr: string; success: boolean }> {
  try {
    const { stdout, stderr } = await execFileAsync("talosctl", [
      "--talosconfig",
      TALOSCONFIG_PATH,
      "--nodes",
      nodeIp || TALOS_ENDPOINTS[0],
      ...args,
    ]);
    return { stdout, stderr, success: true };
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string; message?: string };
    return {
      stdout: execError.stdout || "",
      stderr: execError.stderr || execError.message || "",
      success: false,
    };
  }
}

function findNodeIp(yaml: string, name: string): string | undefined {
  const nodeBlocks = yaml.split(/^---$/m);

  for (const block of nodeBlocks) {
    if (!block.includes("id:") || !block.includes(name)) {
      continue;
    }

    const lines = block.split("\n");
    let currentNodeId = "";
    let ip = "";

    for (const line of lines) {
      if (line.startsWith("id:")) {
        currentNodeId = line.replace("id:", "").trim();
      } else if (line.startsWith("- ")) {
        const potentialIp = line.replace("-", "").trim();
        if (potentialIp.match(/^\d+\.\d+\.\d+\.\d+$/)) {
          ip = potentialIp;
        }
      }
    }

    if (currentNodeId === name || block.includes(`hostname: ${name}`)) {
      return ip;
    }
  }

  return undefined;
}

export default eventHandler(async (event) => {
  const name = getRouterParam(event, "name");
  const body = await readBody<{ reason?: string }>(event);

  if (!name) {
    throw createError({
      statusCode: 400,
      message: "Node name is required",
    });
  }

  // Find the node IP
  const { stdout: membersYaml } = await runTalosctl(
    ["get", "members", "-o", "yaml"],
    TALOS_ENDPOINTS[0],
  );

  const nodeIp = findNodeIp(membersYaml, name);

  const result = await runTalosctl(
    ["shutdown"],
    nodeIp || TALOS_ENDPOINTS[0],
  );

  if (!result.success) {
    throw createError({
      statusCode: 500,
      message: `Failed to shutdown node ${name}: ${result.stderr}`,
    });
  }

  return {
    success: true,
    message: `Shutdown initiated for ${name}`,
    reason: body?.reason,
  };
});
