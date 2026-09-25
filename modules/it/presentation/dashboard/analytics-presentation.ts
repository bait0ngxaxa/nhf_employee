import {
    IT_ANALYTICS_PERIODS,
    IT_ANALYTICS_TIME_ZONE,
    IT_TICKET_STATUS_OPTIONS,
    IT_TICKET_TYPE_OPTIONS,
    type ITAnalyticsDashboard as ITAnalyticsDashboardDTO,
} from "../../contracts";
import type { ITTicketStatus, ITTicketType } from "@prisma/client";

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
        "summary",
        "trend",
        "statusDistribution",
        "typeDistribution",
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
    if (categoryBacklog === null || assigneeBacklog === null || departmentCreated === null) {
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
        summary: {
            currentBacklog: summary.currentBacklog as number,
            waitingRequester: summary.waitingRequester as number,
            unassignedBacklog: summary.unassignedBacklog as number,
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
