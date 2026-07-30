export default defineEventHandler(async (_event) => {
	const config = useRuntimeConfig();

	if (!config.minimaxApiKey) {
		throw createError({
			statusCode: 500,
			statusMessage: "MinMax API key not configured",
		});
	}

	try {
		const response = await $fetch<MinimaxTokenResponse>(
			"https://www.minimax.io/v1/token_plan/remains",
			{
				method: "GET",
				headers: {
					Authorization: `Bearer ${config.minimaxApiKey}`,
					"Content-Type": "application/json",
				},
			},
		);

		// Filtrera ut "general" modellen (coding plan)
		const generalPlan = response.model_remains?.find(
			(m) => m.model_name === "general",
		);

		if (!generalPlan) {
			// Om ingen general-plan finns, returnera hela responsen
			return {
				raw: response,
				percentageRemaining: 100,
				remainingMs: 0,
				intervalEnd: null,
				status: "unknown",
			};
		}

		// Konvertera millisekunder till timmar och minuter
		const remainingMs = generalPlan.remains_time || 0;
		const totalMinutes = Math.floor(remainingMs / (1000 * 60));
		const remainingHours = Math.floor(totalMinutes / 60);
		const remainingMinutes = totalMinutes % 60;

		// Beräkna intervallets slutdatum
		const intervalEnd = generalPlan.end_time
			? new Date(generalPlan.end_time).toISOString()
			: null;

		return {
			raw: response,
			percentageRemaining: generalPlan.current_interval_remaining_percent || 0,
			remainingMs,
			remainingHours,
			remainingMinutes,
			intervalEnd,
			status: generalPlan.current_interval_status,
			modelName: generalPlan.model_name,
		};
	} catch (error: unknown) {
		const err = error as { response?: { status?: number }; message?: string };
		console.error("MinMax API error:", error);
		throw createError({
			statusCode: err.response?.status || 500,
			statusMessage: err.message || "Failed to fetch MinMax token usage",
		});
	}
});

interface MinimaxTokenResponse {
	model_remains: Array<{
		start_time?: number;
		end_time?: number;
		remains_time?: number;
		current_interval_total_count?: number;
		current_interval_usage_count?: number;
		model_name?: string;
		current_weekly_total_count?: number;
		current_weekly_usage_count?: number;
		weekly_start_time?: number;
		weekly_end_time?: number;
		weekly_remains_time?: number;
		current_interval_status?: number;
		current_interval_remaining_percent?: number;
		current_weekly_status?: number;
		current_weekly_remaining_percent?: number;
	}>;
	base_resp: {
		status_code: number;
		status_msg: string;
	};
}
