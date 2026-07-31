import type { GitHubRepo } from "~/types";

export default eventHandler(async () => {
	const config = useRuntimeConfig();

	const username = config.githubUsername || "simonbrundin";
	const token = config.githubToken;

	const headers: Record<string, string> = {
		Accept: "application/vnd.github+json",
		"X-GitHub-Api-Version": "2022-11-28",
	};

	if (token) {
		headers["Authorization"] = `Bearer ${token}`;
	}

	try {
		// Use /user/repos when authenticated to include private repos
		// Use /users/{username}/repos when not authenticated (returns only public)
		const endpoint = token
			? "https://api.github.com/user/repos"
			: `https://api.github.com/users/${username}/repos`;

		const queryParams = token
			? { sort: "updated", per_page: 100, affiliation: "owner" }
			: { sort: "updated", per_page: 100, type: "owner" };

		return await $fetch<GitHubRepo[]>(endpoint, {
			headers,
			query: queryParams,
		});
	} catch (error: unknown) {
		const err = error as { statusCode?: number; message?: string };
		throw createError({
			statusCode: err.statusCode || 500,
			statusMessage: `Failed to fetch GitHub repos: ${err.message}`,
		});
	}
});
