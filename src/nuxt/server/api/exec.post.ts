import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ALLOWED_COMMANDS = new Set(["kubectl"]);

export default eventHandler(async (event) => {
	const body = await readBody<{ cmd: string; args: string[] }>(event);

	if (
		!body
		|| typeof body.cmd !== "string"
		|| !Array.isArray(body.args)
		|| body.args.some((arg) => typeof arg !== "string")
	) {
		throw createError({
			statusCode: 400,
			message: "Missing cmd or args",
		});
	}

	const { cmd, args } = body;
	if (!ALLOWED_COMMANDS.has(cmd)) {
		throw createError({
			statusCode: 403,
			message: `Command is not allowed: ${cmd}`,
		});
	}

	try {
		const { stdout, stderr } = await execFileAsync(cmd, args, {
			timeout: 30000,
			maxBuffer: 10 * 1024 * 1024,
		});

		return { stdout, stderr };
	} catch (error: unknown) {
		const execError = error as {
			stdout?: string;
			stderr?: string;
			message?: string;
		};
		return {
			stdout: execError.stdout || "",
			stderr: execError.stderr || execError.message || "",
		};
	}
});
