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

type RequestState =
    | { readonly key: string; readonly kind: "loaded"; readonly data: ITAnalyticsDashboardDTO }
    | { readonly key: string; readonly kind: "error"; readonly message: string };

class ITAnalyticsRequestError extends Error {}

const PERIOD_LABELS: Readonly<Record<ITAnalyticsPeriod, string>> = {
    "7D": "7 วัน",
    "30D": "30 วัน",
    "90D": "90 วัน",
};

function countText(count: number): string {
    return count.toLocaleString("th-TH");
}

function ReportSkeleton(): ReactElement {
    return (
        <div role="status" aria-label="กำลังโหลดรายงาน IT" className="space-y-5">
            <span className="sr-only">กำลังโหลดรายงาน IT</span>
            <div className="grid gap-3 xl:grid-cols-[minmax(15rem,0.8fr)_minmax(0,2fr)]">
                <Skeleton className="h-40 w-full rounded-xl" />
                <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                    {Array.from({ length: 4 }, (_, index) => (
                        <Skeleton key={index} className="h-40 w-full rounded-xl" />
                    ))}
                </div>
            </div>
            <Skeleton className="h-80 w-full rounded-xl" />
            <div className="grid gap-4 xl:grid-cols-2">
                {Array.from({ length: 5 }, (_, index) => (
                    <Skeleton key={index} className="h-64 w-full rounded-xl" />
                ))}
            </div>
        </div>
    );
}

function BacklogOverview({ dashboard }: { readonly dashboard: ITAnalyticsDashboardDTO }): ReactElement {
    const { summary } = dashboard;
    return (
        <section
            aria-labelledby="it-analytics-backlog-title"
            className="grid min-w-0 gap-5 rounded-xl border border-sky-200 bg-sky-50/70 p-4 dark:border-sky-900 dark:bg-sky-950/30 sm:p-5 xl:grid-cols-[minmax(13rem,0.8fr)_minmax(0,2fr)]"
        >
            <div className="min-w-0">
                <h2 id="it-analytics-backlog-title" className="text-sm font-semibold text-sky-950 dark:text-sky-100">
                    งานค้างปัจจุบัน
                </h2>
                <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight text-content-heading">
                    {countText(summary.currentBacklog)}
                </p>
                <p className="mt-3 text-sm leading-6 text-content-secondary">
                    {summary.oldestUnresolvedAgeMinutes === null
                        ? "ยังไม่มีงานค้าง"
                        : `งานที่ค้างนานที่สุด ${formatITAnalyticsDuration(summary.oldestUnresolvedAgeMinutes)}`}
                </p>
            </div>
            <dl className="grid min-w-0 grid-cols-2 gap-3 self-stretch">
                <div className="flex min-w-0 flex-col justify-center rounded-lg border border-sky-200/80 bg-background/80 p-3 dark:border-sky-900 dark:bg-background/60 sm:p-4">
                    <dt className="text-sm leading-5 text-content-secondary">รอข้อมูลจากผู้แจ้ง</dt>
                    <dd className="mt-1 text-2xl font-semibold tabular-nums text-content-heading">
                        {countText(summary.waitingRequester)}
                    </dd>
                </div>
                <div className="flex min-w-0 flex-col justify-center rounded-lg border border-sky-200/80 bg-background/80 p-3 dark:border-sky-900 dark:bg-background/60 sm:p-4">
                    <dt className="text-sm leading-5 text-content-secondary">ยังไม่มีผู้รับผิดชอบ</dt>
                    <dd className="mt-1 text-2xl font-semibold tabular-nums text-content-heading">
                        {countText(summary.unassignedBacklog)}
                    </dd>
                </div>
            </dl>
        </section>
    );
}

function Metric({
    label,
    value,
    detail,
}: {
    readonly label: string;
    readonly value: string;
    readonly detail?: string;
}): ReactElement {
    return (
        <section className="min-w-0 rounded-xl border border-border-neutral bg-card p-4 sm:p-5">
            <h2 className="text-sm font-medium leading-6 text-content-secondary">{label}</h2>
            <p className="mt-2 break-words text-2xl font-semibold tabular-nums text-content-heading">
                {value}
            </p>
            {detail ? <p className="mt-2 text-xs leading-5 text-content-muted">{detail}</p> : null}
        </section>
    );
}

interface TrendChartProps {
    readonly trend: ITAnalyticsDashboardDTO["trend"];
}

function TrendChart({ trend }: TrendChartProps): ReactElement {
    const width = 960;
    const height = 300;
    const left = 46;
    const right = 12;
    const top = 16;
    const bottom = 40;
    const plotHeight = height - top - bottom;
    const plotWidth = width - left - right;
    const maxValue = Math.max(1, ...trend.flatMap((row) => [row.created, row.resolved]));
    const step = trend.length > 0 ? plotWidth / trend.length : plotWidth;
    const barWidth = Math.max(1, Math.min(9, step * 0.28));
    const gap = Math.max(1, Math.min(3, step * 0.08));
    const tickValues = [...new Set([0, Math.ceil(maxValue / 3), Math.ceil((maxValue * 2) / 3), maxValue])];
    const createdTotal = trend.reduce((total, row) => total + row.created, 0);
    const resolvedTotal = trend.reduce((total, row) => total + row.resolved, 0);
    const labelStride = Math.max(1, Math.ceil(trend.length / 8));
    const hasActivity = createdTotal > 0 || resolvedTotal > 0;

    return (
        <figure className="min-w-0 rounded-xl border border-border-neutral bg-card p-4 sm:p-5">
            <figcaption className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-content-heading">Ticket ใหม่และแก้ไขแล้ว</h2>
                    <p className="mt-1 text-sm leading-6 text-content-secondary">
                        เปรียบเทียบตามวันปฏิทินเวลา Asia/Bangkok
                    </p>
                </div>
                <ul aria-label="คำอธิบายกราฟ" className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                    <li className="inline-flex items-center gap-2 text-content-body">
                        <span aria-hidden="true" className="size-3 rounded-sm bg-sky-600" />
                        <span>Ticket ใหม่ <strong className="tabular-nums">{countText(createdTotal)}</strong></span>
                    </li>
                    <li className="inline-flex items-center gap-2 text-content-body">
                        <span aria-hidden="true" className="size-3 rounded-full border-2 border-teal-700 bg-teal-100 dark:bg-teal-950" />
                        <span>แก้ไขแล้ว <strong className="tabular-nums">{countText(resolvedTotal)}</strong></span>
                    </li>
                </ul>
            </figcaption>

            {!hasActivity ? (
                <p role="status" className="mt-5 rounded-lg bg-surface-subtle px-3 py-2 text-sm text-content-secondary">
                    ยังไม่มีข้อมูลในช่วงเวลานี้
                </p>
            ) : null}

            <div className="mt-3 min-w-0">
                <svg
                    role="img"
                    aria-labelledby="it-analytics-trend-title it-analytics-trend-description"
                    viewBox={`0 0 ${width} ${height}`}
                    className="block h-auto w-full overflow-visible text-content-muted"
                    preserveAspectRatio="xMinYMin meet"
                >
                    <title id="it-analytics-trend-title">แนวโน้ม Ticket ใหม่และแก้ไขแล้วรายวัน</title>
                    <desc id="it-analytics-trend-description">
                        กราฟแท่งเปรียบเทียบ Ticket ใหม่ {countText(createdTotal)} รายการ กับ Ticket ที่แก้ไขแล้ว {countText(resolvedTotal)} รายการ
                        รายละเอียดตัวเลขทุกวันอยู่ในตารางด้านล่าง
                    </desc>
                    <defs>
                        <pattern id="it-analytics-resolved-pattern" width="4" height="4" patternUnits="userSpaceOnUse">
                            <rect width="4" height="4" fill="#0f766e" />
                            <path d="M-1 1l2-2M0 4l4-4M3 5l2-2" stroke="#ffffff" strokeWidth="1" />
                        </pattern>
                    </defs>
                    {tickValues.map((tick) => {
                        const y = top + plotHeight - (tick / maxValue) * plotHeight;
                        return (
                            <g key={tick}>
                                <line x1={left} x2={width - right} y1={y} y2={y} className="stroke-border-neutral" strokeWidth="1" />
                                <text x={left - 8} y={y + 4} textAnchor="end" className="fill-content-muted" fontSize="11">
                                    {countText(tick)}
                                </text>
                            </g>
                        );
                    })}
                    {trend.map((row, index) => {
                        const center = left + index * step + step / 2;
                        const createdHeight = (row.created / maxValue) * plotHeight;
                        const resolvedHeight = (row.resolved / maxValue) * plotHeight;
                        const showDate = index === 0
                            || index === trend.length - 1
                            || index % labelStride === 0;
                        return (
                            <g key={row.date}>
                                <rect
                                    x={center - gap / 2 - barWidth}
                                    y={top + plotHeight - createdHeight}
                                    width={barWidth}
                                    height={createdHeight}
                                    rx="1.5"
                                    fill="#0284c7"
                                >
                                    <title>{`${row.date}: Ticket ใหม่ ${row.created}`}</title>
                                </rect>
                                <rect
                                    x={center + gap / 2}
                                    y={top + plotHeight - resolvedHeight}
                                    width={barWidth}
                                    height={resolvedHeight}
                                    rx="1.5"
                                    fill="url(#it-analytics-resolved-pattern)"
                                >
                                    <title>{`${row.date}: แก้ไขแล้ว ${row.resolved}`}</title>
                                </rect>
                                {showDate ? (
                                    <text
                                        x={center}
                                        y={height - 12}
                                        textAnchor="middle"
                                        className="fill-content-muted"
                                        fontSize="10"
                                    >
                                        {`${row.date.slice(8, 10)}/${row.date.slice(5, 7)}`}
                                    </text>
                                ) : null}
                            </g>
                        );
                    })}
                </svg>
            </div>

            <details className="mt-2 border-t border-border-neutral">
                <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-sky-800 underline underline-offset-4 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-sky-300">
                    ดูตัวเลขรายวัน
                </summary>
                <ol className="grid gap-2 pb-2 sm:grid-cols-2 xl:grid-cols-3">
                    {trend.map((row) => (
                        <li key={row.date} className="grid min-w-0 grid-cols-[1fr_auto_auto] items-center gap-2 rounded-lg bg-surface-subtle px-3 py-2 text-xs sm:text-sm">
                            <time dateTime={row.date} className="font-medium tabular-nums text-content-body">
                                {row.date}
                            </time>
                            <span className="text-content-secondary">ใหม่ <strong className="tabular-nums text-content-heading">{countText(row.created)}</strong></span>
                            <span className="text-content-secondary">แก้ไข <strong className="tabular-nums text-content-heading">{countText(row.resolved)}</strong></span>
                        </li>
                    ))}
                </ol>
            </details>
        </figure>
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
        <section className="min-w-0 rounded-xl border border-border-neutral bg-card p-4 sm:p-5">
            <div className="min-w-0">
                <h2 className="text-base font-semibold text-content-heading">{title}</h2>
                {description ? <p className="mt-1 text-sm leading-6 text-content-secondary">{description}</p> : null}
            </div>
            {rows.length === 0 ? (
                <p className="mt-5 rounded-lg bg-surface-subtle px-3 py-4 text-sm text-content-secondary">
                    ยังไม่มีข้อมูล
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
    const { summary } = dashboard;
    const statusRows = dashboard.statusDistribution.map((row) => ({
        label: IT_TICKET_STATUS_LABELS[row.status],
        count: row.count,
    }));
    const typeRows = dashboard.typeDistribution.map((row) => ({
        label: IT_TICKET_TYPE_LABELS[row.type],
        count: row.count,
    }));

    return (
        <div className="space-y-5">
            <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(15rem,0.8fr)_minmax(0,2fr)]">
                <BacklogOverview dashboard={dashboard} />
                <div className="grid min-w-0 grid-cols-2 gap-3 xl:grid-cols-4">
                    <Metric label="Ticket ใหม่" value={countText(summary.newTickets)} />
                    <Metric label="แก้ไขแล้ว" value={countText(summary.resolvedTickets)} />
                    <Metric
                        label="เวลาตอบกลับครั้งแรกเฉลี่ย"
                        value={formatITAnalyticsDuration(summary.averageFirstResponseMinutes)}
                        detail={`จาก ${countText(summary.firstRespondedTickets)} Ticket ที่มีการตอบกลับ`}
                    />
                    <Metric
                        label="เวลาแก้ไขเฉลี่ย"
                        value={formatITAnalyticsDuration(summary.averageResolutionMinutes)}
                        detail={`จาก ${countText(summary.resolvedTickets)} Ticket ที่มีการแก้ไข`}
                    />
                </div>
            </div>

            <TrendChart trend={dashboard.trend} />

            <div className="grid min-w-0 gap-4 xl:grid-cols-2">
                <DistributionPanel title="สถานะ Ticket ปัจจุบัน" rows={statusRows} />
                <DistributionPanel
                    title="งานค้างแยกตามหมวดหมู่"
                    description="รวมเฉพาะ Ticket ที่ยังไม่ปิดงาน"
                    rows={dashboard.categoryBacklog}
                />
                <DistributionPanel
                    title="งานค้างแยกตามผู้รับผิดชอบ"
                    description="รวม Ticket ที่ยังไม่ปิดงาน และแสดงงานที่ยังไม่มีผู้รับผิดชอบ"
                    rows={dashboard.assigneeBacklog}
                />
                <DistributionPanel
                    title="Ticket ใหม่แยกตามประเภท"
                    description="นับ Ticket ที่สร้างในช่วงรายงาน"
                    rows={typeRows}
                />
                <DistributionPanel
                    title="Ticket ใหม่แยกตามหน่วยงาน"
                    description="ใช้ชื่อหน่วยงานที่บันทึกไว้เมื่อสร้าง Ticket"
                    rows={dashboard.departmentCreated}
                />
            </div>
        </div>
    );
}

export function ITAnalyticsDashboard(): ReactElement {
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
        <section className="w-full min-w-0 space-y-5 p-4 sm:p-6 xl:p-8">
            <header className="flex min-w-0 flex-col gap-4 border-b border-border-neutral pb-5 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                    <h1 data-page-heading tabIndex={-1} className="flex items-center gap-2 text-2xl font-bold tracking-tight text-content-heading [overflow-wrap:anywhere] md:text-3xl">
                        <BarChart3 aria-hidden="true" className="size-7 shrink-0 text-sky-700" />
                        รายงาน IT
                    </h1>
                    <p className="mt-2 max-w-[70ch] text-sm leading-6 text-content-secondary">
                        ภาพรวมงานค้างและผลการให้บริการ IT ตามช่วงเวลาที่เลือก
                    </p>
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
