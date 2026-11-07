import {
    IT_ANALYTICS_BACKLOG_AGE_BUCKETS,
    IT_ANALYTICS_PERIODS,
    IT_ANALYTICS_TIME_ZONE,
    IT_ANALYTICS_UNCATEGORIZED_FILTER,
    IT_TICKET_DATABASE_INT_MAX,
    IT_TICKET_PRIORITY_OPTIONS,
    IT_TICKET_STATUS_OPTIONS,
    IT_TICKET_TYPE_OPTIONS,
    type ITAnalyticsCategoryFilter,
    type ITAnalyticsDashboard as ITAnalyticsDashboardDTO,
} from "../../contracts";
import type { ITTicketPriority, ITTicketStatus, ITTicketType } from "@prisma/client";

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: RecordValue, keys: readonly string[]): boolean {
    const actual = Object.keys(value);
    return actual.length === keys.length && keys.every((key) => key in value);
}

function isNonNegativeInteger(value: unknown): value is number {
    return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isNonNegativeNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isTimestamp(value: unknown): value is string {
    return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isPeriod(value: unknown): value is ITAnalyticsDashboardDTO["period"]["key"] {
    return typeof value === "string"
        && (IT_ANALYTICS_PERIODS as readonly string[]).includes(value);
}

function isStatus(value: unknown): value is ITTicketStatus {
    return typeof value === "string"
        && IT_TICKET_STATUS_OPTIONS.some((option) => option.value === value);
}

function isTicketType(value: unknown): value is ITTicketType {
    return typeof value === "string"
        && IT_TICKET_TYPE_OPTIONS.some((option) => option.value === value);
}

function isPriority(value: unknown): value is ITTicketPriority {
    return typeof value === "string"
        && IT_TICKET_PRIORITY_OPTIONS.some((option) => option.value === value);
}

function parseLabelCounts(
    value: unknown,
): readonly { readonly label: string; readonly count: number }[] | null {
    if (!Array.isArray(value)) return null;
    const rows: { label: string; count: number }[] = [];
    for (const item of value) {
        if (!isRecord(item)
            || !hasExactKeys(item, ["label", "count"])
            || typeof item.label !== "string"
            || !isNonNegativeInteger(item.count)) {
            return null;
        }
        rows.push({ label: item.label, count: item.count });
    }
    return rows;
}

function parsePriorityCounts(
    value: unknown,
): ITAnalyticsDashboardDTO["priorityDistribution"] | null {
    if (!Array.isArray(value)) return null;
    const rows: ITAnalyticsDashboardDTO["priorityDistribution"][number][] = [];
    for (const item of value) {
        if (!isRecord(item)
            || !hasExactKeys(item, ["priority", "count"])
            || !isPriority(item.priority)
            || !isNonNegativeInteger(item.count)) {
            return null;
        }
        rows.push({ priority: item.priority, count: item.count });
    }
    return rows;
}

function isEntityId(value: unknown): value is number {
    return Number.isSafeInteger(value)
        && (value as number) > 0
        && (value as number) <= IT_TICKET_DATABASE_INT_MAX;
}

function isCategoryFilter(value: unknown): value is ITAnalyticsCategoryFilter {
    return value === IT_ANALYTICS_UNCATEGORIZED_FILTER || isEntityId(value);
}

function parseFilters(value: unknown): ITAnalyticsDashboardDTO["filters"] | null {
    if (!isRecord(value)
        || !hasExactKeys(value, ["type", "category"])
        || (value.type !== null && !isTicketType(value.type))
        || (value.category !== null && !isCategoryFilter(value.category))) {
        return null;
    }
    return { type: value.type, category: value.category };
}

function parseFilterOptions(value: unknown): ITAnalyticsDashboardDTO["filterOptions"] | null {
    if (!isRecord(value)
        || !hasExactKeys(value, ["categories"])
        || !Array.isArray(value.categories)) {
        return null;
    }
    const categories: ITAnalyticsDashboardDTO["filterOptions"]["categories"][number][] = [];
    const seen = new Set<number>();
    for (const item of value.categories) {
        if (!isRecord(item)
            || !hasExactKeys(item, ["id", "key", "name", "isActive"])
            || !isEntityId(item.id)
            || seen.has(item.id)
            || typeof item.key !== "string"
            || typeof item.name !== "string"
            || typeof item.isActive !== "boolean") {
            return null;
        }
        seen.add(item.id);
        categories.push({ id: item.id, key: item.key, name: item.name, isActive: item.isActive });
    }
    return { categories };
}

function parseTopCategories(value: unknown): ITAnalyticsDashboardDTO["topCategories"] | null {
    if (!isRecord(value)
        || !hasExactKeys(value, ["limit", "rows", "otherCategoryCount", "otherTicketCount"])
        || !isNonNegativeInteger(value.limit)
        || !isNonNegativeInteger(value.otherCategoryCount)
        || !isNonNegativeInteger(value.otherTicketCount)
        || !Array.isArray(value.rows)
        || value.rows.length > value.limit) {
        return null;
    }
    const rows: ITAnalyticsDashboardDTO["topCategories"]["rows"][number][] = [];
    for (const item of value.rows) {
        if (!isRecord(item)
            || !hasExactKeys(item, ["categoryId", "label", "count"])
            || (item.categoryId !== null && !isEntityId(item.categoryId))
            || typeof item.label !== "string"
            || !isNonNegativeInteger(item.count)) {
            return null;
        }
        rows.push({ categoryId: item.categoryId, label: item.label, count: item.count });
    }
    return {
        limit: value.limit,
        rows,
        otherCategoryCount: value.otherCategoryCount,
        otherTicketCount: value.otherTicketCount,
    };
}

/** Requires every aging bucket exactly once, in canonical order. */
function parseBacklogAging(value: unknown): ITAnalyticsDashboardDTO["backlogAging"] | null {
    if (!Array.isArray(value) || value.length !== IT_ANALYTICS_BACKLOG_AGE_BUCKETS.length) {
        return null;
    }
    const rows: ITAnalyticsDashboardDTO["backlogAging"][number][] = [];
    for (const [index, definition] of IT_ANALYTICS_BACKLOG_AGE_BUCKETS.entries()) {
        const item: unknown = value[index];
        if (!isRecord(item)
            || !hasExactKeys(item, ["bucket", "count"])
            || item.bucket !== definition.key
            || !isNonNegativeInteger(item.count)) {
            return null;
        }
        rows.push({ bucket: definition.key, count: item.count });
    }
    return rows;
}

function parseResponseResolutionByPriority(
    value: unknown,
): ITAnalyticsDashboardDTO["responseResolutionByPriority"] | null {
    if (!Array.isArray(value)) return null;
    const rows: ITAnalyticsDashboardDTO["responseResolutionByPriority"][number][] = [];
    for (const item of value) {
        if (!isRecord(item)
            || !hasExactKeys(item, [
                "priority",
                "firstRespondedTickets",
                "averageFirstResponseMinutes",
                "resolvedTickets",
                "averageResolutionMinutes",
            ])
            || !isPriority(item.priority)
            || !isNonNegativeInteger(item.firstRespondedTickets)
            || !isNonNegativeInteger(item.resolvedTickets)
            || (item.averageFirstResponseMinutes !== null
                && !isNonNegativeNumber(item.averageFirstResponseMinutes))
            || (item.averageResolutionMinutes !== null
                && !isNonNegativeNumber(item.averageResolutionMinutes))) {
            return null;
        }
        rows.push({
            priority: item.priority,
            firstRespondedTickets: item.firstRespondedTickets,
            averageFirstResponseMinutes: item.averageFirstResponseMinutes,
            resolvedTickets: item.resolvedTickets,
            averageResolutionMinutes: item.averageResolutionMinutes,
        });
    }
    return rows;
}

export function parseITAnalyticsDashboardResponse(
    value: unknown,
): ITAnalyticsDashboardDTO | null {
    if (!isRecord(value)
        || !hasExactKeys(value, ["success", "dashboard"])
        || value.success !== true
        || !isRecord(value.dashboard)) {
        return null;
    }
    const dashboard = value.dashboard;
    if (!hasExactKeys(dashboard, [
        "generatedAt",
        "timeZone",
        "period",
        "filters",
        "filterOptions",
        "summary",
        "trend",
        "statusDistribution",
        "typeDistribution",
        "priorityDistribution",
        "priorityBacklog",
        "responseResolutionByPriority",
        "topCategories",
        "backlogAging",
        "categoryBacklog",
        "assigneeBacklog",
        "departmentCreated",
    ])
        || !isTimestamp(dashboard.generatedAt)
        || dashboard.timeZone !== IT_ANALYTICS_TIME_ZONE
        || !isRecord(dashboard.period)
        || !hasExactKeys(dashboard.period, ["key", "startAt", "endAt"])
        || !isPeriod(dashboard.period.key)
        || !isTimestamp(dashboard.period.startAt)
        || !isTimestamp(dashboard.period.endAt)
        || !isRecord(dashboard.summary)
        || !hasExactKeys(dashboard.summary, [
            "currentBacklog",
            "waitingRequester",
            "unassignedBacklog",
            "untriagedBacklog",
            "highPriorityBacklog",
            "agedBacklog",
            "oldestUnresolvedAgeMinutes",
            "newTickets",
            "resolvedTickets",
            "firstRespondedTickets",
            "averageFirstResponseMinutes",
            "averageResolutionMinutes",
        ])) {
        return null;
    }

    const summary = dashboard.summary;
    const countKeys = [
        "currentBacklog",
        "waitingRequester",
        "unassignedBacklog",
        "untriagedBacklog",
        "highPriorityBacklog",
        "agedBacklog",
        "newTickets",
        "resolvedTickets",
        "firstRespondedTickets",
    ] as const;
    if (countKeys.some((key) => !isNonNegativeInteger(summary[key]))) return null;
    for (const key of [
        "oldestUnresolvedAgeMinutes",
        "averageFirstResponseMinutes",
        "averageResolutionMinutes",
    ] as const) {
        const metric = summary[key];
        if (metric !== null && !isNonNegativeNumber(metric)) return null;
    }

    if (!Array.isArray(dashboard.trend)) return null;
    const trend: ITAnalyticsDashboardDTO["trend"][number][] = [];
    for (const item of dashboard.trend) {
        if (!isRecord(item)
            || !hasExactKeys(item, ["date", "created", "resolved"])
            || typeof item.date !== "string"
            || !/^\d{4}-\d{2}-\d{2}$/.test(item.date)
            || !isNonNegativeInteger(item.created)
            || !isNonNegativeInteger(item.resolved)) {
            return null;
        }
        trend.push({ date: item.date, created: item.created, resolved: item.resolved });
    }

    if (!Array.isArray(dashboard.statusDistribution)
        || !Array.isArray(dashboard.typeDistribution)) return null;
    const statusDistribution: ITAnalyticsDashboardDTO["statusDistribution"][number][] = [];
    for (const item of dashboard.statusDistribution) {
        if (!isRecord(item)
            || !hasExactKeys(item, ["status", "count"])
            || !isStatus(item.status)
            || !isNonNegativeInteger(item.count)) return null;
        statusDistribution.push({ status: item.status, count: item.count });
    }
    const typeDistribution: ITAnalyticsDashboardDTO["typeDistribution"][number][] = [];
    for (const item of dashboard.typeDistribution) {
        if (!isRecord(item)
            || !hasExactKeys(item, ["type", "count"])
            || !isTicketType(item.type)
            || !isNonNegativeInteger(item.count)) return null;
        typeDistribution.push({ type: item.type, count: item.count });
    }

    const categoryBacklog = parseLabelCounts(dashboard.categoryBacklog);
    const assigneeBacklog = parseLabelCounts(dashboard.assigneeBacklog);
    const departmentCreated = parseLabelCounts(dashboard.departmentCreated);
    const priorityDistribution = parsePriorityCounts(dashboard.priorityDistribution);
    const priorityBacklog = parsePriorityCounts(dashboard.priorityBacklog);
    const responseResolutionByPriority = parseResponseResolutionByPriority(
        dashboard.responseResolutionByPriority,
    );
    const filters = parseFilters(dashboard.filters);
    const filterOptions = parseFilterOptions(dashboard.filterOptions);
    const topCategories = parseTopCategories(dashboard.topCategories);
    const backlogAging = parseBacklogAging(dashboard.backlogAging);
    if (categoryBacklog === null || assigneeBacklog === null || departmentCreated === null
        || priorityDistribution === null || priorityBacklog === null
        || responseResolutionByPriority === null || filters === null
        || filterOptions === null || topCategories === null || backlogAging === null) {
        return null;
    }

    return {
        generatedAt: dashboard.generatedAt,
        timeZone: IT_ANALYTICS_TIME_ZONE,
        period: {
            key: dashboard.period.key,
            startAt: dashboard.period.startAt,
            endAt: dashboard.period.endAt,
        },
        filters,
        filterOptions,
        summary: {
            currentBacklog: summary.currentBacklog as number,
            waitingRequester: summary.waitingRequester as number,
            unassignedBacklog: summary.unassignedBacklog as number,
            untriagedBacklog: summary.untriagedBacklog as number,
            highPriorityBacklog: summary.highPriorityBacklog as number,
            agedBacklog: summary.agedBacklog as number,
            oldestUnresolvedAgeMinutes: summary.oldestUnresolvedAgeMinutes as number | null,
            newTickets: summary.newTickets as number,
            resolvedTickets: summary.resolvedTickets as number,
            firstRespondedTickets: summary.firstRespondedTickets as number,
            averageFirstResponseMinutes: summary.averageFirstResponseMinutes as number | null,
            averageResolutionMinutes: summary.averageResolutionMinutes as number | null,
        },
        trend,
        statusDistribution,
        typeDistribution,
        priorityDistribution,
        priorityBacklog,
        responseResolutionByPriority,
        topCategories,
        backlogAging,
        categoryBacklog,
        assigneeBacklog,
        departmentCreated,
    };
}

export function formatITAnalyticsDuration(minutes: number | null): string {
    if (minutes === null) return "ยังไม่มีข้อมูล";

    const roundedMinutes = Math.round(minutes);
    const days = Math.floor(roundedMinutes / 1_440);
    const hours = Math.floor((roundedMinutes % 1_440) / 60);
    const remainderMinutes = roundedMinutes % 60;
    const parts: string[] = [];
    if (days > 0) parts.push(`${days} วัน`);
    if (hours > 0) parts.push(`${hours} ชม.`);
    if (remainderMinutes > 0 || parts.length === 0) {
        parts.push(`${remainderMinutes} นาที`);
    }
    return parts.join(" ");
}

export function formatITAnalyticsDateTime(value: string): string {
    return new Intl.DateTimeFormat("th-TH", {
        timeZone: IT_ANALYTICS_TIME_ZONE,
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(value));
}

export function readITAnalyticsError(status: number): string {
    if (status === 401) return "เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง";
    if (status === 403) return "คุณไม่มีสิทธิ์ดูรายงาน IT";
    if (status >= 500) return "ระบบรายงาน IT ขัดข้องชั่วคราว กรุณาลองอีกครั้ง";
    return "ไม่สามารถโหลดรายงาน IT ได้ กรุณาลองอีกครั้ง";
}
