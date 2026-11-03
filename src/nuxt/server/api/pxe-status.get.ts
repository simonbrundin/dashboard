import dgram from "node:dgram";
import type { PxeCheck, PxeStatus } from "~/types";

const HTTP_TIMEOUT_MS = 5000;
const TFTP_TIMEOUT_MS = 3000;

export default eventHandler(async (): Promise<PxeStatus> => {
	const config = useRuntimeConfig();
	const host = config.pxeHost || "10.10.10.2";
	const httpPort = Number(config.pxeHttpPort) || 8080;
	const tftpPort = Number(config.pxeTftpPort) || 69;
	const base = `http://${host}:${httpPort}`;
	const probeMac = config.pxeProbeMac || "0a:3f:39:25:2b:c8";
	const probeNode = config.pxeProbeNode || "worker-1";

	const checks: PxeCheck[] = [];

	// Matchbox (HTTP) är den del som måste fungera för att en nod ska kunna
	// boota. Dessa kontroller avgör om PXE-servern är uppe. De körs
	// parallellt så att kortet inte hänger när servern är nere.
	const [bootScript, profile, nodeConfig, kernel] = await Promise.all([
		checkHttp(`${base}/boot.ipxe`, "iPXE-startskript", host),
		checkHttp(
			`${base}/ipxe?mac=${encodeURIComponent(probeMac)}`,
			"Profiluppslagning (MAC)",
			host,
		),
		checkHttp(
			`${base}/assets/talos-config/nodes/${probeNode}.yaml`,
			"Nodkonfiguration",
			host,
		),
		checkHttp(
			`${base}/assets/rock4c-plus/kernel-arm64`,
			"Bootkärna (kernel-arm64)",
			host,
		),
	]);

	checks.push(bootScript, profile, nodeConfig, kernel);

	// TFTP (UDP 69) svarar bara från noder i samma L2-segment som PXE-servern.
	// Dashboarden bor i pod-nätet, där svarspaketen inte routas tillbaka - så
	// ett timeout där betyder "vet ej", inte "trasigt". Kontrollen kan stängas
	// av helt med NUXT_PXE_TFTP_ENABLED=false.
	// Env-override via NUXT_PXE_TFTP_ENABLED deserialiseras till boolean,
	// så både "false" och false ska stänga av kontrollen.
	if (isTftpEnabled(config.pxeTftpEnabled)) {
		checks.push(await checkTftp(host, tftpPort));
	}

	const failed = checks.filter((check) => check.status === "fail");
	const ok = failed.length === 0;

	return {
		host,
		ok,
		checkedAt: new Date().toISOString(),
		checks,
	};
});

async function checkHttp(
	url: string,
	label: string,
	host: string,
): Promise<PxeCheck> {
	const startedAt = Date.now();

	try {
		const response = await fetch(url, {
			method: "HEAD",
			signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
		});
		const latencyMs = Date.now() - startedAt;

		return {
			label,
			status: response.ok ? "ok" : "fail",
			httpStatus: response.status,
			latencyMs,
			detail: response.ok ? undefined : `HTTP ${response.status}`,
		};
	} catch (error) {
		return {
			label,
			status: "fail",
			httpStatus: null,
			latencyMs: Date.now() - startedAt,
			detail: describeError(error, host),
		};
	}
}

/**
 * TFTP (UDP 69) svarar med ett RRQ-svar. Ett timeout betyder att inget svar
 * kom - brandvägg, fel nätsegment eller trasig tjänst. Statusen blir "unknown"
 * eftersom ett timeout inte kan skilja de tre åt, och dashboarden inte ska
 * rapportera en brandvägg som en trasig PXE-server.
 */
async function checkTftp(host: string, port: number): Promise<PxeCheck> {
	const label = "TFTP (UDP 69)";
	const startedAt = Date.now();

	const result = await new Promise<{ reachable: boolean; detail?: string }>(
		(resolve) => {
			const socket = dgram.createSocket("udp4");
			let settled = false;

			const finish = (reachable: boolean, detail?: string) => {
				if (settled) return;
				settled = true;
				clearTimeout(timer);
				try {
					socket.close();
				} catch {
					// Sockeln kan redan vara stängd
				}
				resolve({ reachable, detail });
			};

			const timer = setTimeout(
				() => finish(false, "Inget svar (UDP blockerat eller TFTP nere)"),
				TFTP_TIMEOUT_MS,
			);

			socket.on("error", (error) =>
				finish(false, describeError(error, host)),
			);

			socket.on("message", (message) => {
				// Opcode 3 = DATA, 5 = ERROR. Båda visar att TFTP-tjänsten svarar.
				const opcode = message.length >= 2 ? message.readUInt16BE(0) : 0;
				finish(
					true,
					opcode === 5 ? "TFTP svarar med felkod" : undefined,
				);
			});

			const request = Buffer.concat([
				Buffer.from([0, 1]),
				Buffer.from("boot.ipxe", "ascii"),
				Buffer.from("octet", "ascii"),
				Buffer.from([0]),
			]);

			socket.send(request, port, host, (error) => {
				if (error) finish(false, describeError(error, host));
			});
		},
	);

	return {
		label,
		status: result.reachable ? "ok" : "unknown",
		httpStatus: null,
		latencyMs: Date.now() - startedAt,
		detail: result.detail,
	};
}

function isTftpEnabled(value: unknown): boolean {
	if (typeof value === "boolean") return value;
	if (typeof value === "string") {
		return !["false", "0", "no", "off"].includes(value.toLowerCase());
	}

	return true;
}

function describeError(error: unknown, host: string): string {
	const message = error instanceof Error ? error.message : String(error);

	if (message.includes("fetch failed") || message.includes("ECONNREFUSED")) {
		return `Ingen kontakt med ${host}`;
	}
	if (message.includes("timeout") || message.includes("ETIMEDOUT")) {
		return `Timeout mot ${host}`;
	}

	return message;
}
