import type { ITTicketPriority, ITTicketType } from "@prisma/client";

import {
    APP_ROUTES,
    IT_DASHBOARD_TAB_QUERY_KEY,
    IT_DASHBOARD_TABS,
} from "@/lib/ssot/routes";

import {
    IT_TICKET_DATABASE_INT_MAX,
    IT_TICKET_PRIORITY_OPTIONS,
    IT_TICKET_STATUS_OPTIONS,
    IT_TICKET_TYPE_OPTIONS,
    type ITOperatorQueueStatusFilter,
} from "../../contracts";

/** Applied operator-queue filters; mirrors the validated queue API input. */
export interface ITOperatorQueueFilters {
    readonly status: ITOperatorQueueStatusFilter;
    readonly type?: ITTicketType;
    readonly priority?: ITTicketPriority;
    readonly triageState?: "TRIAGED" | "UNTRIAGED";
    readonly categoryId?: number | "uncategorized";
    readonly assignmentState?: "ASSIGNED" | "UNASSIGNED";
    readonly assigneeUserId?: number;
}

export const IT_OPERATOR_QUEUE_DEFAULT_FILTERS: ITOperatorQueueFilters = Object.freeze({
    status: "ACTIVE",
});

/**
 * Workspace URL keys. They are namespaced so they never collide with the
 * analytics report keys sharing the same `/dashboard/it` URL.
 */
export const IT_OPERATOR_QUEUE_URL_KEYS = Object.freeze({
    status: "queueStatus",
    type: "queueType",
    priority: "queuePriority",
    triageState: "queueTriage",
    categoryId: "queueCategory",
    assignmentState: "queueAssignment",
    assigneeUserId: "queueAssignee",
} as const);

type SearchParamsReader = Pick<URLSearchParams, "get">;

function parsePositiveId(value: string | null): number | undefined {
    if (value === null || !/^[1-9]\d{0,9}$/.test(value)) return undefined;
    const id = Number(value);
    return id <= IT_TICKET_DATABASE_INT_MAX ? id : undefined;
}

function parseStatus(value: string | null): ITOperatorQueueStatusFilter {
    if (value === "ACTIVE" || value === "HISTORY" || value === "ALL") return value;
    return IT_TICKET_STATUS_OPTIONS.find((option) => option.value === value)?.value ?? "ACTIVE";
}

/**
 * Reads queue filters from the URL. Unknown or malformed values fall back to
 * "no filter" (or the ACTIVE view), never to a broader scope than requested
 * by a valid value. The server validates and authorizes every request again.
 */
export function parseITOperatorQueueUrlFilters(params: SearchParamsReader): ITOperatorQueueFilters {
    const keys = IT_OPERATOR_QUEUE_URL_KEYS;
    const type = IT_TICKET_TYPE_OPTIONS.find((option) => option.value === params.get(keys.type))?.value;
    const priority = IT_TICKET_PRIORITY_OPTIONS
        .find((option) => option.value === params.get(keys.priority))?.value;
    const triage = params.get(keys.triageState);
    const rawCategory = params.get(keys.categoryId);
    const categoryId = rawCategory === "uncategorized" ? "uncategorized" : parsePositiveId(rawCategory);
    const assignment = params.get(keys.assignmentState);
    const assignmentState = assignment === "ASSIGNED" || assignment === "UNASSIGNED" ? assignment : undefined;
    const assigneeUserId = assignmentState === "UNASSIGNED"
        ? undefined
        : parsePositiveId(params.get(keys.assigneeUserId));

    return {
        status: parseStatus(params.get(keys.status)),
        ...(type ? { type } : {}),
        ...(priority ? { priority } : {}),
        ...(triage === "TRIAGED" || triage === "UNTRIAGED" ? { triageState: triage } : {}),
        ...(categoryId !== undefined ? { categoryId } : {}),
        ...(assigneeUserId !== undefined
            ? { assignmentState: "ASSIGNED" as const, assigneeUserId }
            : assignmentState ? { assignmentState } : {}),
    };
}

/** True when the URL names at least one queue filter. */
export function hasITOperatorQueueUrlFilters(params: SearchParamsReader): boolean {
    return Object.values(IT_OPERATOR_QUEUE_URL_KEYS).some((key) => params.get(key) !== null);
}

/** Stable identity for a filter set, independent of property order. */
export function getITOperatorQueueFiltersKey(filters: ITOperatorQueueFilters): string {
    return JSON.stringify([
        filters.status,
        filters.type ?? null,
        filters.priority ?? null,
        filters.triageState ?? null,
        filters.categoryId ?? null,
        filters.assignmentState ?? null,
        filters.assigneeUserId ?? null,
    ]);
}

/** Canonical Dashboard link that opens the operator queue tab with filters applied. */
export function buildITOperatorQueueHref(filters: ITOperatorQueueFilters): string {
    const keys = IT_OPERATOR_QUEUE_URL_KEYS;
    const params = new URLSearchParams();
    params.set(IT_DASHBOARD_TAB_QUERY_KEY, IT_DASHBOARD_TABS.queue);
    params.set(keys.status, filters.status);
    if (filters.type) params.set(keys.type, filters.type);
    if (filters.priority) params.set(keys.priority, filters.priority);
    if (filters.triageState) params.set(keys.triageState, filters.triageState);
    if (filters.categoryId !== undefined) params.set(keys.categoryId, String(filters.categoryId));
    if (filters.assignmentState) params.set(keys.assignmentState, filters.assignmentState);
    if (filters.assigneeUserId !== undefined) params.set(keys.assigneeUserId, String(filters.assigneeUserId));
    return `${APP_ROUTES.dashboardIT}?${params.toString()}`;
}
