import type { UptimeKumaSummary } from "~/types";

interface ParsedMetrics {
	monitors: Array<{
		id: string;
		name: string;
		url: string;
		status: number;
		responseTime?: number;
		uptime1d?: number;
		certDaysRemaining?: number;
	}>;
	summary: UptimeKumaSummary;
}

export default eventHandler(async () => {
	const config = useRuntimeConfig();
	const uptimeKumaUrl = config.uptimeKumaUrl;
	const uptimeKumaApiKey = config.uptimeKumaApiKey;

	// Return mock data if not configured
	if (!uptimeKumaUrl || !uptimeKumaApiKey) {
		return getMockData();
	}

	try {
		// Fetch Prometheus metrics from Uptime Kuma
		const credentials = btoa(`x:${uptimeKumaApiKey}`);

		const response = await $fetch<string>(`${uptimeKumaUrl}/metrics`, {
			headers: {
				Authorization: `Basic ${credentials}`,
			},
		});

		return parsePrometheusMetrics(response);
	} catch (error) {
		console.error("Failed to fetch Uptime Kuma metrics:", error);
		return getMockData();
	}
});

function parsePrometheusMetrics(metricsText: string): ParsedMetrics {
	const monitors = new Map<
		string,
		{
			id: string;
			name: string;
			url: string;
			status?: number;
			responseTime?: number;
			uptime1d?: number;
			certDaysRemaining?: number;
		}
	>();

	const lines = metricsText.split("\n");

	for (const line of lines) {
		if (!line || line.startsWith("#")) continue;

		// Parse: metric_name{labels} value
		const match = line.match(/^(\w+)\{(.+?)\}\s+([\d.e+-]+)$/);
		if (!match) continue;

		const metricName = match[1] ?? "";
		const labelsStr = match[2] ?? "";
		const value = match[3] ?? "";

		const labels = parseLabels(labelsStr);
		const monitorId = labels.monitor_id;

		if (!monitorId) continue;

		// Initialize monitor if not exists
		if (!monitors.has(monitorId)) {
			monitors.set(monitorId, {
				id: monitorId,
				name: labels.monitor_name || "Unknown",
				url: labels.monitor_url || "",
			});
		}

		const monitor = monitors.get(monitorId);
		if (!monitor) continue;

		// Parse specific metrics
		if (metricName === "monitor_status") {
			monitor.status = parseInt(value, 10);
		} else if (metricName === "monitor_response_time") {
			monitor.responseTime = parseFloat(value);
		} else if (
			metricName === "monitor_uptime_ratio" &&
			labels.window === "1d"
		) {
			monitor.uptime1d = parseFloat(value) * 100;
		} else if (metricName === "monitor_cert_days_remaining") {
			monitor.certDaysRemaining = parseFloat(value);
		}
	}

	// Calculate summary
	const monitorsList = Array.from(monitors.values()).map((m) => ({
		...m,
		status: m.status ?? 0,
	}));

	const summary: UptimeKumaSummary = {
		total: monitorsList.length,
		up: monitorsList.filter((m) => m.status === 1).length,
		down: monitorsList.filter((m) => m.status === 0).length,
		maintenance: monitorsList.filter((m) => m.status === 3).length,
		pending: monitorsList.filter((m) => m.status === 2).length,
	};

	return { monitors: monitorsList, summary };
}

function parseLabels(labelsStr: string): Record<string, string> {
	const result: Record<string, string> = {};
	const matches = labelsStr.matchAll(/(\w+)="([^"]*)"/g);
	for (const match of matches) {
		const key = match[1];
		if (key) {
			result[key] = match[2] ?? "";
		}
	}
	return result;
}

function getMockData() {
	return {
		monitors: [
			{
				id: "1",
				name: "Example",
				url: "https://example.com",
				status: 1,
				responseTime: 100,
				uptime1d: 99.9,
			},
		],
		summary: { total: 1, up: 1, down: 0, maintenance: 0, pending: 0 },
	};
}
