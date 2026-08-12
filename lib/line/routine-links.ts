import { APP_DASHBOARD_TABS, APP_ROUTES } from "@/lib/ssot/routes";
import { getPublicOrigin } from "@/lib/network/public-url";

import { getLineLiffId } from "./config";

export function buildRoutineLiffUrl(): string {
    return `https://liff.line.me/${encodeURIComponent(getLineLiffId())}/routine`;
}

export function buildRoutineLiffTaskUrl(
    taskId: number,
    occurrenceId: number,
): string {
    const url = new URL(buildRoutineLiffUrl());
    url.searchParams.set("taskId", String(taskId));
    url.searchParams.set("occurrenceId", String(occurrenceId));
    return url.toString();
}

export function buildRoutineDashboardTaskUrl(
    taskId: number,
    occurrenceId: number,
): string {
    const url = new URL(APP_ROUTES.dashboard, getPublicOrigin());
    url.searchParams.set("tab", APP_DASHBOARD_TABS.routine);
    url.searchParams.set("taskId", String(taskId));
    url.searchParams.set("occurrenceId", String(occurrenceId));
    return url.toString();
}
