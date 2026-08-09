import type { AvatarProps } from "@nuxt/ui";

export type UserStatus = "subscribed" | "unsubscribed" | "bounced";
export type SaleStatus = "paid" | "failed" | "refunded";

export interface User {
	id: number;
	name: string;
	email: string;
	avatar?: AvatarProps;
	status: UserStatus;
	location: string;
}

export interface Mail {
	id: number;
	unread?: boolean;
	from: User;
	subject: string;
	body: string;
	date: string;
}

export interface Member {
	name: string;
	username: string;
	role: "member" | "owner";
	avatar: AvatarProps;
}

export interface Stat {
	title: string;
	icon: string;
	value: number | string;
	variation: number;
	formatter?: (value: number) => string;
}

export interface Sale {
	id: string;
	date: string;
	status: SaleStatus;
	email: string;
	amount: number;
}

export interface Notification {
	id: number;
	unread?: boolean;
	sender: User;
	body: string;
	date: string;
}

export type Period = "daily" | "weekly" | "monthly";

export interface Range {
	start: Date;
	end: Date;
}

// GitHub types
export interface GitHubRepo {
	id: number;
	name: string;
	full_name: string;
	description: string | null;
	html_url: string;
	stargazers_count: number;
	forks_count: number;
	language: string | null;
	topics: string[];
	private: boolean;
	updated_at: string;
	pushed_at: string;
	default_branch: string;
	open_issues_count: number;
}

// Uptime Kuma types
export type UptimeKumaStatus = 0 | 1 | 2 | 3;

export interface UptimeKumaMonitor {
	id: number;
	name: string;
	url: string;
	hostname?: string;
	port?: number;
	status: UptimeKumaStatus;
	statusName: "Down" | "Up" | "Pending" | "Maintenance";
	uptime?: number;
	responseTime?: number;
	ssl?: {
		daysRemaining: number;
		issuer: string;
	};
	tags?: Array<{
		id: number;
		name: string;
		color: string;
	}>;
	order?: number;
	maintenance?: boolean;
}

export interface UptimeKumaSummary {
	total: number;
	up: number;
	down: number;
	maintenance: number;
	pending: number;
}

// Flux types
export type FluxResourceStatus =
	| "Ready"
	| "NotReady"
	| "Progressing"
	| "Unknown";

export interface FluxCondition {
	type: string;
	status: string;
	message?: string;
}

export interface FluxController {
	name: string;
	namespace: string;
	ready: boolean;
	status: FluxResourceStatus;
	replicas: number;
	readyReplicas: number;
	age: string;
	message?: string;
}

export interface FluxSource {
	name: string;
	namespace: string;
	kind: "GitRepository" | "HelmRepository" | "OCIRepository";
	url: string;
	ready: boolean;
	status: FluxResourceStatus;
	age: string;
	lastUpdated?: string;
	message?: string;
}

export interface FluxKustomization {
	name: string;
	namespace: string;
	enabled: boolean;
	ready: boolean;
	status: FluxResourceStatus;
	suspended: boolean;
	age: string;
	lastReconciled?: string;
	error?: string;
}

export interface FluxHelmRelease {
	name: string;
	namespace: string;
	chart: string;
	revision: string;
	ready: boolean;
	status: FluxResourceStatus;
	age: string;
	lastReconciled?: string;
	message?: string;
}

export interface FluxStatus {
	controllers: FluxController[];
	sources: FluxSource[];
	kustomizations: FluxKustomization[];
	helmReleases: FluxHelmRelease[];
	summary: {
		controllersReady: number;
		controllersTotal: number;
		sourcesReady: number;
		sourcesTotal: number;
		kustomizationsReady: number;
		kustomizationsTotal: number;
		helmReleasesReady: number;
		helmReleasesTotal: number;
	};
}
