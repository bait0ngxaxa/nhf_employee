"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";
import { BarChart3, CircleAlert, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { API_ROUTES } from "@/lib/ssot/routes";

import {
    IT_ANALYTICS_PERIODS,
    IT_TICKET_STATUS_LABELS,
    IT_TICKET_TYPE_LABELS,
    type ITAnalyticsDashboard as ITAnalyticsDashboardDTO,
    type ITAnalyticsPeriod,
} from "../../contracts";
import {
    formatITAnalyticsDateTime,
    formatITAnalyticsDuration,
    parseITAnalyticsDashboardResponse,
    readITAnalyticsError,
} from "./analytics-presentation";

import { ITAnalyticsTrendChart } from "./ITAnalyticsTrendChart";

type RequestState =
    | { readonly key: string; readonly kind: "loaded"; readonly data: ITAnalyticsDashboardDTO }
    | { readonly key: string; readonly kind: "error"; readonly message: string };

class ITAnalyticsRequestError extends Error {}

const PERIOD_LABELS: Readonly<Record<ITAnalyticsPeriod, string>> = {
    "7D": "7 วัน",
    "30D": "30 วัน",
    "90D": "90 วัน",
};

const BREAKDOWN_OPTIONS = [
    { value: "status", label: "สถานะ" },
    { value: "type", label: "ประเภท" },
    { value: "category", label: "หมวดหมู่" },
    { value: "assignee", label: "ผู้รับผิดชอบ" },
    { value: "department", label: "หน่วยงาน" },
] as const;

type BreakdownDimension = typeof BREAKDOWN_OPTIONS[number]["value"];

function countText(count: number): string {
    return count.toLocaleString("th-TH");
}

function ReportSkeleton(): ReactElement {
    return (
        <div role="status" aria-label="กำลังโหลดรายงาน IT" className="space-y-6">
            <span className="sr-only">กำลังโหลดรายงาน IT</span>
            <section className="space-y-5">
                <Skeleton className="h-6 w-20" />
                <div className="grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-3">
                    {Array.from({ length: 3 }, (_, index) => (
                        <Skeleton
                            key={index}
                            className={"h-24 w-full " + (index === 0 ? "col-span-2 sm:col-span-1" : "")}
                        />
                    ))}
                </div>
                <div className="grid grid-cols-2 gap-5 border-t border-border-neutral pt-5 sm:grid-cols-2">
                    {Array.from({ length: 2 }, (_, index) => (
                        <Skeleton key={index} className="h-20 w-full" />
                    ))}
                </div>
            </section>
            <div className="border-y border-border-neutral py-5">
                <Skeleton className="h-80 w-full" />
            </div>
            <section className="space-y-4 pt-5">
                <Skeleton className="h-6 w-44" />
                <Skeleton className="h-11 w-full sm:w-56" />
                <Skeleton className="h-44 w-full" />
            </section>
        </div>
    );
}

function OverviewMetric({
    label,
    value,
    detail,
    emphasis = "standard",
}: {
    readonly label: string;
    readonly value: string;
    readonly detail?: string;
    readonly emphasis?: "primary" | "standard" | "secondary";
}): ReactElement {
    const valueClassName = emphasis === "primary"
        ? "text-4xl font-bold tracking-tight"
        : emphasis === "secondary"
            ? "text-lg font-semibold sm:text-xl"
            : "text-2xl font-semibold";

    return (
        <div className="min-w-0">
            <dt className="break-words text-sm leading-6 text-content-secondary">{label}</dt>
            <dd className={"mt-1 break-words tabular-nums text-content-heading " + valueClassName}>
                {value}
            </dd>
            {detail ? <p className="mt-1 text-xs leading-5 text-content-muted">{detail}</p> : null}
        </div>
    );
}

function SummaryOverview({ dashboard }: { readonly dashboard: ITAnalyticsDashboardDTO }): ReactElement {
    const { summary } = dashboard;
    return (
        <section aria-labelledby="it-analytics-overview-title" className="min-w-0 space-y-5 rounded-xl border border-border-neutral bg-surface-raised p-4 sm:p-6">
            <h2 id="it-analytics-overview-title" className="text-lg font-semibold text-content-heading">
                ภาพรวม
            </h2>
            <dl className="grid min-w-0 grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-3">
                <div className="col-span-2 min-w-0 border-b border-border-neutral pb-4 sm:col-span-1 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-5">
                    <OverviewMetric
                        label="งานค้าง"
                        value={countText(summary.currentBacklog)}
                        detail={summary.oldestUnresolvedAgeMinutes === null
                            ? "ยังไม่มีงานค้าง"
                            : "งานที่ค้างนานที่สุด " + formatITAnalyticsDuration(summary.oldestUnresolvedAgeMinutes)}
                        emphasis="primary"
                    />
                </div>
                <OverviewMetric label="รอข้อมูลจากผู้แจ้ง" value={countText(summary.waitingRequester)} />
                <OverviewMetric label="ยังไม่มีผู้รับผิดชอบ" value={countText(summary.unassignedBacklog)} />
            </dl>
            <dl className="grid min-w-0 grid-cols-2 gap-x-5 gap-y-5 border-t border-border-neutral pt-5 sm:grid-cols-2">
                <OverviewMetric label="Ticket ใหม่" value={countText(summary.newTickets)} />
                <OverviewMetric label="แก้ไขแล้ว" value={countText(summary.resolvedTickets)} />
            </dl>
        </section>
    );
}

function DistributionPanel({
    title,
    description,
    rows,
}: {
    readonly title: string;
    readonly description?: string;
    readonly rows: readonly { readonly label: string; readonly count: number }[];
}): ReactElement {
    const maximum = Math.max(0, ...rows.map((row) => row.count));
    return (
        <section aria-labelledby="it-analytics-breakdown-title" className="mt-5 min-w-0">
            <div className="min-w-0">
                <h3 id="it-analytics-breakdown-title" className="text-base font-semibold text-content-heading">{title}</h3>
                {description ? <p className="mt-1 text-sm leading-6 text-content-secondary">{description}</p> : null}
            </div>
            {rows.length === 0 ? (
                <p className="mt-4 text-sm text-content-secondary">
                    ยังไม่มีข้อมูลในช่วงเวลานี้
                </p>
            ) : (
                <ul className="mt-4 space-y-4">
                    {rows.map((row) => {
                        const percentage = maximum === 0 ? 0 : (row.count / maximum) * 100;
                        return (
                            <li key={row.label} className="min-w-0">
                                <div className="flex min-w-0 items-start justify-between gap-3">
                                    <span className="min-w-0 break-words text-sm leading-6 text-content-body">{row.label}</span>
                                    <strong className="shrink-0 text-sm tabular-nums text-content-heading">{countText(row.count)}</strong>
                                </div>
                                <div
                                    role="meter"
                                    aria-label={`${row.label} ${countText(row.count)} รายการ`}
                                    aria-valuemin={0}
                                    aria-valuemax={maximum || 1}
                                    aria-valuenow={row.count}
                                    className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-subtle"
                                >
                                    <div
                                        aria-hidden="true"
                                        className="h-full rounded-full bg-sky-600"
                                        style={{ width: `${percentage}%` }}
                                    />
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}

function DashboardReport({ dashboard }: { readonly dashboard: ITAnalyticsDashboardDTO }): ReactElement {
    const [selectedBreakdown, setSelectedBreakdown] = useState<BreakdownDimension>("status");
    const statusRows = dashboard.statusDistribution.map((row) => ({
        label: IT_TICKET_STATUS_LABELS[row.status],
        count: row.count,
    }));
    const typeRows = dashboard.typeDistribution.map((row) => ({
        label: IT_TICKET_TYPE_LABELS[row.type],
        count: row.count,
    }));
    const breakdowns: Readonly<Record<BreakdownDimension, {
        readonly title: string;
        readonly description?: string;
        readonly rows: readonly { readonly label: string; readonly count: number }[];
    }>> = {
        status: {
            title: "สถานะ Ticket ปัจจุบัน",
            rows: statusRows,
        },
        type: {
            title: "Ticket ใหม่แยกตามประเภท",
            description: "นับ Ticket ที่สร้างในช่วงรายงาน",
            rows: typeRows,
        },
        category: {
            title: "งานค้างแยกตามหมวดหมู่",
            description: "รวมเฉพาะ Ticket ที่ยังไม่ปิดงาน",
            rows: dashboard.categoryBacklog,
        },
        assignee: {
            title: "งานค้างแยกตามผู้รับผิดชอบ",
            description: "รวม Ticket ที่ยังไม่ปิดงาน และแสดงงานที่ยังไม่มีผู้รับผิดชอบ",
            rows: dashboard.assigneeBacklog,
        },
        department: {
            title: "Ticket ใหม่แยกตามหน่วยงาน",
            description: "ใช้ชื่อหน่วยงานที่บันทึกไว้เมื่อสร้าง Ticket",
            rows: dashboard.departmentCreated,
        },
    };
    const breakdown = breakdowns[selectedBreakdown];
    const handleBreakdownChange = (value: string): void => {
        const option = BREAKDOWN_OPTIONS.find((item) => item.value === value);
        if (option) setSelectedBreakdown(option.value);
    };

    return (
        <div className="space-y-6">
            <SummaryOverview dashboard={dashboard} />
            <ITAnalyticsTrendChart trend={dashboard.trend} period={dashboard.period.key} />

            <section aria-labelledby="it-analytics-breakdowns-heading" className="min-w-0 rounded-xl border border-border-neutral bg-surface-raised p-4 sm:p-6">
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <h2 id="it-analytics-breakdowns-heading" className="text-lg font-semibold text-content-heading">
                        รายละเอียดเพิ่มเติม
                    </h2>
                    <label className="flex w-full min-w-0 flex-col gap-1.5 text-sm font-medium text-content-secondary sm:w-56">
                        <span>แสดงตาม</span>
                        <Select value={selectedBreakdown} onValueChange={handleBreakdownChange}>
                            <SelectTrigger aria-label="เลือกมิติรายละเอียด" className="min-h-11 w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {BREAKDOWN_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </label>
                </div>
                <DistributionPanel
                    title={breakdown.title}
                    description={breakdown.description}
                    rows={breakdown.rows}
                />
            </section>
        </div>
    );
}

export function ITAnalyticsDashboard({ embedded = false }: { readonly embedded?: boolean } = {}): ReactElement {
    const [period, setPeriod] = useState<ITAnalyticsPeriod>("30D");
    const [retryCount, setRetryCount] = useState(0);
    const [requestState, setRequestState] = useState<RequestState | null>(null);
    const latestRequestId = useRef(0);
    const requestKey = `${period}:${retryCount}`;
    const visibleState = requestState?.key === requestKey ? requestState : null;

    useEffect(() => {
        const controller = new AbortController();
        const requestId = ++latestRequestId.current;
        const url = `${API_ROUTES.itAnalytics.dashboard}?period=${encodeURIComponent(period)}`;

        void fetch(url, { signal: controller.signal })
            .then(async (response) => {
                const payload: unknown = await response.json().catch(() => null);
                if (!response.ok) throw new ITAnalyticsRequestError(readITAnalyticsError(response.status));
                const parsed = parseITAnalyticsDashboardResponse(payload);
                if (parsed === null) {
                    throw new ITAnalyticsRequestError("ข้อมูลรายงาน IT ไม่ถูกต้อง กรุณาลองอีกครั้ง");
                }
                if (!controller.signal.aborted && requestId === latestRequestId.current) {
                    setRequestState({ key: requestKey, kind: "loaded", data: parsed });
                }
            })
            .catch((cause: unknown) => {
                if (controller.signal.aborted || requestId !== latestRequestId.current) return;
                setRequestState({
                    key: requestKey,
                    kind: "error",
                    message: cause instanceof ITAnalyticsRequestError
                        ? cause.message
                        : "ระบบรายงาน IT ขัดข้องชั่วคราว กรุณาลองอีกครั้ง",
                });
            });

        return () => controller.abort();
    }, [period, requestKey]);

    const handlePeriodChange = (value: string): void => {
        if ((IT_ANALYTICS_PERIODS as readonly string[]).includes(value)) {
            setPeriod(value as ITAnalyticsPeriod);
        }
    };

    const reportState = visibleState;
    return (
        <section className="mx-auto w-full max-w-7xl min-w-0 space-y-5">
            <header className={`flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between ${embedded ? "" : "border-b border-border-neutral pb-5"}`}>
                <div className="min-w-0">
                    {!embedded ? <>
                        <h1 data-page-heading tabIndex={-1} className="flex items-center gap-2 text-2xl font-bold tracking-tight text-content-heading [overflow-wrap:anywhere] md:text-3xl">
                            <BarChart3 aria-hidden="true" className="size-7 shrink-0 text-sky-700" />
                            รายงาน IT
                        </h1>
                        <p className="mt-2 max-w-[70ch] text-sm leading-6 text-content-secondary">
                            ภาพรวมงานค้างและผลการให้บริการ IT ตามช่วงเวลาที่เลือก
                        </p>
                    </> : null}
                    {reportState?.kind === "loaded" ? (
                        <p className="mt-1 text-xs leading-5 text-content-muted">
                            {formatITAnalyticsDateTime(reportState.data.period.startAt)} – {formatITAnalyticsDateTime(reportState.data.period.endAt)} น.
                            <span className="mx-1" aria-hidden="true">·</span>
                            เวลาเอเชีย/กรุงเทพฯ
                        </p>
                    ) : null}
                    {reportState?.kind === "loaded" ? (
                        <p className="mt-0.5 text-xs leading-5 text-content-muted">
                            อัปเดตข้อมูล {formatITAnalyticsDateTime(reportState.data.generatedAt)} น.
                        </p>
                    ) : null}
                </div>
                <label className="flex w-full min-w-0 flex-col gap-1.5 text-sm font-medium text-content-secondary sm:w-48">
                    ช่วงเวลารายงาน
                    <Select value={period} onValueChange={handlePeriodChange}>
                        <SelectTrigger aria-label="เลือกช่วงเวลารายงาน" className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {IT_ANALYTICS_PERIODS.map((value) => (
                                <SelectItem key={value} value={value}>
                                    {PERIOD_LABELS[value]}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </label>
            </header>

            {reportState === null ? (
                <ReportSkeleton />
            ) : reportState.kind === "error" ? (
                <div role="alert" className="flex flex-col gap-4 rounded-xl border border-status-danger-border bg-status-danger-surface p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                    <div className="flex min-w-0 items-start gap-3">
                        <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-status-danger-strong" />
                        <div className="min-w-0">
                            <h2 className="font-semibold text-status-danger-strong">โหลดรายงานไม่สำเร็จ</h2>
                            <p className="mt-1 text-sm leading-6 text-content-body">{reportState.message}</p>
                        </div>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        className="min-h-11 shrink-0 gap-2"
                        onClick={() => setRetryCount((current) => current + 1)}
                    >
                        <RotateCw aria-hidden="true" className="size-4" />
                        ลองอีกครั้ง
                    </Button>
                </div>
            ) : (
                <DashboardReport dashboard={reportState.data} />
            )}
        </section>
    );
}
