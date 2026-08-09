import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export default eventHandler(async (event) => {
	const body = await readBody<{ cmd: string; args: string[] }>(event);

	if (!body?.cmd || !body?.args) {
		throw createError({
			statusCode: 400,
			message: "Missing cmd or args",
		});
	}

	const { cmd, args } = body;

	try {
		const command = `${cmd} ${args.join(" ")}`;
		const { stdout, stderr } = await execAsync(command, {
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
