import { APP_DASHBOARD_TABS, APP_ROUTES } from "@/lib/ssot/routes";
import { getPublicOrigin } from "@/lib/network/public-url";

import { buildLiffUrl } from "./liff-links";

export function buildRoutineLiffUrl(): string {
    return buildLiffUrl(APP_ROUTES.line.routine);
}

export function buildRoutineLiffTaskUrl(
    taskId: number,
    occurrenceId: number,
): string {
    return buildLiffUrl(APP_ROUTES.line.routine, {
        taskId,
        occurrenceId,
    });
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
