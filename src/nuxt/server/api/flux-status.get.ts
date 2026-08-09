import type {
	FluxController,
	FluxHelmRelease,
	FluxKustomization,
	FluxResourceStatus,
	FluxSource,
	FluxStatus,
} from "~/types";

export default eventHandler(async (): Promise<FluxStatus> => {
	try {
		const controllers = await getFluxControllers();
		const sources = await getFluxSources();
		const kustomizations = await getFluxKustomizations();
		const helmReleases = await getFluxHelmReleases();

		const summary = {
			controllersReady: controllers.filter((c) => c.ready).length,
			controllersTotal: controllers.length,
			sourcesReady: sources.filter((s) => s.ready).length,
			sourcesTotal: sources.length,
			kustomizationsReady: kustomizations.filter((k) => k.ready && k.enabled)
				.length,
			kustomizationsTotal: kustomizations.filter((k) => k.enabled).length,
			helmReleasesReady: helmReleases.filter((h) => h.ready).length,
			helmReleasesTotal: helmReleases.length,
		};

		return { controllers, sources, kustomizations, helmReleases, summary };
	} catch (error) {
		console.error("Failed to fetch Flux status:", error);
		return getMockFluxStatus();
	}
});

interface FluxCondition {
	type: string;
	status: string;
	reason?: string;
	message?: string;
}

function getConditionStatus(conditions: FluxCondition[]): FluxResourceStatus {
	if (!conditions || conditions.length === 0) return "Unknown";
	const ready = conditions.find((c) => c.type === "Ready");
	const reconciling = conditions.find((c) => c.type === "Reconciling");
	if (!ready) return "Unknown";

	// Ready is True = all good
	if (ready.status === "True") {
		// Check if there's an active "Progressing" condition
		const isProgressing = conditions.some(
			(c) => c.type === "Progressing" && c.status === "True",
		);
		if (isProgressing) return "Progressing";
		return "Ready";
	}

	// Ready is False
	if (reconciling && reconciling.status === "True") {
		// Check the reason to determine if it's actually failing
		const reason = reconciling.reason?.toLowerCase() || "";
		// ProgressingWithRetry means it's failing repeatedly
		if (reason.includes("retry") || reason.includes("failed")) {
			return "NotReady";
		}
		// Just progressing
		return "Progressing";
	}

	// Not ready and not reconciling = static failure
	return "NotReady";
}

async function getFluxControllers(): Promise<FluxController[]> {
	const output = await runKubectl([
		"get",
		"pods",
		"-n",
		"flux-system",
		"-o",
		"json",
	]);

	if (!output?.items) return [];

	const controllers: FluxController[] = [];
	const fluxControllerNames = [
		"source-controller",
		"kustomize-controller",
		"helm-controller",
		"notification-controller",
		"image-automation-controller",
		"image-reflector-controller",
	];

	for (const pod of output.items as Array<{
		metadata?: {
			name?: string;
			namespace?: string;
			creationTimestamp?: string;
		};
		status?: { conditions?: FluxCondition[]; readyReplicas?: number };
		spec?: { replicas?: number };
	}>) {
		const name = pod.metadata?.name || "";
		const isFluxController = fluxControllerNames.some((n) => name.includes(n));
		if (!isFluxController) continue;

		const conditions = pod.status?.conditions || [];
		const status = getConditionStatus(conditions);
		const ready = status === "Ready";

		controllers.push({
			name: name.replace(/-\w+$/, ""),
			namespace: pod.metadata?.namespace || "flux-system",
			ready,
			status,
			replicas: pod.spec?.replicas || 1,
			readyReplicas: pod.status?.readyReplicas || 0,
			age: formatAge(pod.metadata?.creationTimestamp),
			message: !ready
				? conditions.find((c) => c.type === "Ready" && c.status === "False")
						?.message
				: undefined,
		});
	}

	return controllers;
}

async function getFluxSources(): Promise<FluxSource[]> {
	const sources: FluxSource[] = [];
	const sourceTypes = [
		{ crd: "gitrepositories", kind: "GitRepository" as const },
		{ crd: "helmrepositories", kind: "HelmRepository" as const },
		{ crd: "ocirepositories", kind: "OCIRepository" as const },
	];

	for (const { crd, kind } of sourceTypes) {
		try {
			const result = await runKubectl(["get", crd, "-A", "-o", "json"]);
			if (!result?.items) continue;

			for (const item of result.items as Array<{
				metadata?: {
					name?: string;
					namespace?: string;
					creationTimestamp?: string;
				};
				spec?: { url?: string };
				status?: {
					conditions?: Array<{
						type: string;
						status: string;
						message?: string;
					}>;
					artifact?: { lastUpdateTime?: string };
				};
			}>) {
				const conditions = item.status?.conditions || [];
				const status = getConditionStatus(conditions);
				const ready = status === "Ready";

				sources.push({
					name: item.metadata?.name || "",
					namespace: item.metadata?.namespace || "",
					kind,
					url: item.spec?.url || "",
					ready,
					status,
					age: formatAge(item.metadata?.creationTimestamp),
					lastUpdated: item.status?.artifact?.lastUpdateTime,
					message: !ready
						? conditions.find((c) => c.type === "Ready" && c.status === "False")
								?.message
						: undefined,
				});
			}
		} catch {
			// CRD might not exist
		}
	}

	return sources;
}

async function getFluxKustomizations(): Promise<FluxKustomization[]> {
	try {
		const result = await runKubectl([
			"get",
			"kustomizations",
			"-A",
			"-o",
			"json",
		]);
		if (!result?.items) return [];

		return (
			result.items as Array<{
				metadata?: {
					name?: string;
					namespace?: string;
					creationTimestamp?: string;
				};
				spec?: { suspend?: boolean };
				status?: {
					conditions?: Array<{
						type: string;
						status: string;
						message?: string;
					}>;
					lastHandledReconcileAt?: string;
				};
			}>
		).map((k) => {
			const conditions = k.status?.conditions || [];
			const status = getConditionStatus(conditions);
			const ready = status === "Ready";

			return {
				name: k.metadata?.name || "",
				namespace: k.metadata?.namespace || "",
				enabled: !k.spec?.suspend,
				ready,
				status,
				suspended: k.spec?.suspend || false,
				age: formatAge(k.metadata?.creationTimestamp),
				lastReconciled: k.status?.lastHandledReconcileAt,
				error: !ready
					? conditions.find((c) => c.type === "Ready" && c.status === "False")
							?.message
					: undefined,
			};
		});
	} catch {
		return [];
	}
}

async function getFluxHelmReleases(): Promise<FluxHelmRelease[]> {
	try {
		const result = await runKubectl([
			"get",
			"helmreleases",
			"-A",
			"-o",
			"json",
		]);
		if (!result?.items) return [];

		return (
			result.items as Array<{
				metadata?: {
					name?: string;
					namespace?: string;
					creationTimestamp?: string;
				};
				spec?: { chart?: { spec?: { chart?: string } } };
				status?: {
					conditions?: Array<{
						type: string;
						status: string;
						message?: string;
					}>;
					lastHandledReconcileAt?: string;
					history?: Array<{ revision: string }>;
				};
			}>
		).map((hr) => {
			const conditions = hr.status?.conditions || [];
			const status = getConditionStatus(conditions);
			const ready = status === "Ready";

			return {
				name: hr.metadata?.name || "",
				namespace: hr.metadata?.namespace || "",
				chart: hr.spec?.chart?.spec?.chart || "Unknown",
				revision: hr.status?.history?.[0]?.revision || "Unknown",
				ready,
				status,
				age: formatAge(hr.metadata?.creationTimestamp),
				lastReconciled: hr.status?.lastHandledReconcileAt,
				message: !ready
					? conditions.find((c) => c.type === "Ready" && c.status === "False")
							?.message
					: undefined,
			};
		});
	} catch {
		return [];
	}
}

function formatAge(timestamp?: string): string {
	if (!timestamp) return "-";
	const age = Date.now() - new Date(timestamp).getTime();
	const seconds = Math.floor(age / 1000);
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h`;
	const days = Math.floor(hours / 24);
	if (days < 30) return `${days}d`;
	const months = Math.floor(days / 30);
	return `${months}mo`;
}

async function runKubectl(
	args: string[],
): Promise<{ items?: unknown[]; [key: string]: unknown }> {
	const { stdout } = await runCommand("kubectl", args);
	try {
		return JSON.parse(stdout);
	} catch {
		return {};
	}
}

async function runCommand(
	cmd: string,
	args: string[],
): Promise<{ stdout: string; stderr: string }> {
	return $fetch<{ stdout: string; stderr: string }>("/api/exec", {
		method: "POST",
		body: { cmd, args },
	});
}

function getMockFluxStatus(): FluxStatus {
	return {
		controllers: [
			{
				name: "source-controller",
				namespace: "flux-system",
				ready: true,
				status: "Ready",
				replicas: 1,
				readyReplicas: 1,
				age: "45d",
			},
			{
				name: "kustomize-controller",
				namespace: "flux-system",
				ready: true,
				status: "Ready",
				replicas: 1,
				readyReplicas: 1,
				age: "45d",
			},
			{
				name: "helm-controller",
				namespace: "flux-system",
				ready: true,
				status: "Ready",
				replicas: 1,
				readyReplicas: 1,
				age: "45d",
			},
			{
				name: "notification-controller",
				namespace: "flux-system",
				ready: true,
				status: "Ready",
				replicas: 1,
				readyReplicas: 1,
				age: "45d",
			},
		],
		sources: [
			{
				name: "flux-system",
				namespace: "flux-system",
				kind: "GitRepository",
				url: "ssh://git@github.com/simonbrundin/infrastructure",
				ready: true,
				status: "Ready",
				age: "45d",
			},
			{
				name: "bitnami",
				namespace: "flux-system",
				kind: "HelmRepository",
				url: "https://charts.bitnami.com/bitnami",
				ready: true,
				status: "Ready",
				age: "45d",
			},
		],
		kustomizations: [
			{
				name: "flux-system",
				namespace: "flux-system",
				enabled: true,
				ready: true,
				status: "Ready",
				suspended: false,
				age: "45d",
			},
		],
		helmReleases: [
			{
				name: "cert-manager",
				namespace: "cert-manager",
				chart: "cert-manager",
				revision: "v1.15.0",
				ready: true,
				status: "Ready",
				age: "30d",
			},
		],
		summary: {
			controllersReady: 4,
			controllersTotal: 4,
			sourcesReady: 2,
			sourcesTotal: 2,
			kustomizationsReady: 1,
			kustomizationsTotal: 1,
			helmReleasesReady: 1,
			helmReleasesTotal: 1,
		},
	};
}
