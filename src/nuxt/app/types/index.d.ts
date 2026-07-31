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
