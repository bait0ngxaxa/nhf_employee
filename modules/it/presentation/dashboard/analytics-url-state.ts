import type { ITTicketPriority, ITTicketType } from "@prisma/client";

import {
    IT_ANALYTICS_PERIODS,
    IT_ANALYTICS_UNCATEGORIZED_FILTER,
    IT_TICKET_DATABASE_INT_MAX,
    IT_TICKET_TYPE_OPTIONS,
    type ITAnalyticsCategoryFilter,
    type ITAnalyticsPeriod,
} from "../../contracts";
import { buildITOperatorQueueHref, type ITOperatorQueueFilters } from "./operator-queue-url";

/** Report filters selected by the viewer. `null` means "all". */
export interface ITAnalyticsReportState {
    readonly period: ITAnalyticsPeriod;
    readonly type: ITTicketType | null;
    readonly category: ITAnalyticsCategoryFilter | null;
}

export const IT_ANALYTICS_DEFAULT_REPORT_STATE: ITAnalyticsReportState = Object.freeze({
    period: "30D",
    type: null,
    category: null,
});

/** Namespaced so report filters never collide with operator-queue URL keys. */
export const IT_ANALYTICS_URL_KEYS = Object.freeze({
    period: "reportPeriod",
    type: "reportType",
    category: "reportCategory",
} as const);

type SearchParamsReader = Pick<URLSearchParams, "get">;

export function parseITAnalyticsCategoryFilter(value: string | null): ITAnalyticsCategoryFilter | null {
    if (value === IT_ANALYTICS_UNCATEGORIZED_FILTER) return IT_ANALYTICS_UNCATEGORIZED_FILTER;
    if (value === null || !/^[1-9]\d{0,9}$/.test(value)) return null;
    const id = Number(value);
    return id <= IT_TICKET_DATABASE_INT_MAX ? id : null;
}

/** Invalid URL values fall back to the default instead of failing the page. */
export function parseITAnalyticsUrlState(params: SearchParamsReader): ITAnalyticsReportState {
    const period = params.get(IT_ANALYTICS_URL_KEYS.period);
    const type = params.get(IT_ANALYTICS_URL_KEYS.type);
    return {
        period: (IT_ANALYTICS_PERIODS as readonly string[]).includes(period ?? "")
            ? period as ITAnalyticsPeriod
            : IT_ANALYTICS_DEFAULT_REPORT_STATE.period,
        type: IT_TICKET_TYPE_OPTIONS.find((option) => option.value === type)?.value ?? null,
        category: parseITAnalyticsCategoryFilter(params.get(IT_ANALYTICS_URL_KEYS.category)),
    };
}

/** Writes report state into a copy of the URL, omitting defaults and keeping other keys. */
export function writeITAnalyticsUrlState(
    current: URLSearchParams,
    state: ITAnalyticsReportState,
): URLSearchParams {
    const next = new URLSearchParams(current.toString());
    const setOrDelete = (key: string, value: string | null): void => {
        if (value === null) next.delete(key);
        else next.set(key, value);
    };
    setOrDelete(
        IT_ANALYTICS_URL_KEYS.period,
        state.period === IT_ANALYTICS_DEFAULT_REPORT_STATE.period ? null : state.period,
    );
    setOrDelete(IT_ANALYTICS_URL_KEYS.type, state.type);
    setOrDelete(IT_ANALYTICS_URL_KEYS.category, state.category === null ? null : String(state.category));
    return next;
}

/** Query string for `GET /api/it/analytics`; only supported keys, once each. */
export function toITAnalyticsApiQuery(state: ITAnalyticsReportState): string {
    const params = new URLSearchParams({ period: state.period });
    if (state.type !== null) params.set("type", state.type);
    if (state.category !== null) params.set("category", String(state.category));
    return params.toString();
}

export function isDefaultITAnalyticsReportState(state: ITAnalyticsReportState): boolean {
    return state.period === IT_ANALYTICS_DEFAULT_REPORT_STATE.period
        && state.type === null
        && state.category === null;
}

export function getITAnalyticsReportStateKey(state: ITAnalyticsReportState): string {
    return `${state.period}|${state.type ?? ""}|${state.category ?? ""}`;
}

export interface ITAnalyticsQueueDestinations {
    readonly getCategoryHref: (categoryId: number | null) => string;
    readonly getPriorityHref: (priority: ITTicketPriority) => string;
    readonly unassignedHref: string;
    readonly untriagedHref: string;
}

/**
 * Builds operator-queue links for current-backlog drill-downs. The queue's
 * ACTIVE view matches the analytics backlog statuses; the report's applied
 * Ticket filters are carried over so destination counts match the report.
 * The queue has no age filter, so aged backlog intentionally has no link.
 */
export function buildITAnalyticsQueueDestinations(
    filters: { readonly type: ITTicketType | null; readonly category: ITAnalyticsCategoryFilter | null },
): ITAnalyticsQueueDestinations {
    const base: ITOperatorQueueFilters = {
        status: "ACTIVE",
        ...(filters.type !== null ? { type: filters.type } : {}),
        ...(filters.category !== null ? { categoryId: filters.category } : {}),
    };
    return {
        getCategoryHref: (categoryId) => buildITOperatorQueueHref({
            ...base,
            categoryId: categoryId ?? IT_ANALYTICS_UNCATEGORIZED_FILTER,
        }),
        getPriorityHref: (priority) => buildITOperatorQueueHref({ ...base, priority }),
        unassignedHref: buildITOperatorQueueHref({ ...base, assignmentState: "UNASSIGNED" }),
        untriagedHref: buildITOperatorQueueHref({ ...base, triageState: "UNTRIAGED" }),
    };
}
