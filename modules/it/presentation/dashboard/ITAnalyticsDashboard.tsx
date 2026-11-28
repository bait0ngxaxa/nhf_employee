"use client";

import { useEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, CircleAlert, Clock3, RotateCcw, RotateCw, ShieldAlert, UserRoundX, type LucideIcon } from "lucide-react";
import type { ITTicketPriority } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { API_ROUTES } from "@/lib/ssot/routes";

import {
    IT_ANALYTICS_AGED_BACKLOG_MIN_DAYS,
    IT_ANALYTICS_PERIODS,
    IT_ANALYTICS_UNCATEGORIZED_FILTER,
    IT_ANALYTICS_UNCATEGORIZED_LABEL,
    IT_TICKET_PRIORITY_LABELS,
    IT_TICKET_STATUS_LABELS,
    IT_TICKET_TYPE_LABELS,
    IT_TICKET_TYPE_OPTIONS,
    type ITAnalyticsDashboard as ITAnalyticsDashboardDTO,
    type ITAnalyticsCategoryFilter,
    type ITAnalyticsPeriod,
} from "../../contracts";
import { IT_TICKET_ACTIVE_WORK_STATUSES } from "../../domain/ticket-workflow";
import {
    formatITAnalyticsDateTime,
    formatITAnalyticsDuration,
    parseITAnalyticsDashboardResponse,
    readITAnalyticsError,
} from "./analytics-presentation";
import {
    buildITAnalyticsQueueDestinations,
    getITAnalyticsReportStateKey,
    IT_ANALYTICS_DEFAULT_REPORT_STATE,
    isDefaultITAnalyticsReportState,
    parseITAnalyticsCategoryFilter,
    toITAnalyticsApiQuery,
    type ITAnalyticsQueueDestinations,
    type ITAnalyticsReportState,
} from "./analytics-url-state";
import { formatITAnalyticsComparison, formatITAnalyticsCount } from "./analytics-view";
import {
    ITAnalyticsBacklogAgingPanel,
    ITAnalyticsCountBars,
    ITAnalyticsPanel,
    ITAnalyticsPriorityBacklogPanel,
    ITAnalyticsScopeBadge,
    ITAnalyticsTopCategoriesPanel,
    ITAnalyticsWorkloadPanel,
    type ITAnalyticsScope,
} from "./ITAnalyticsCharts";
import { ITAnalyticsTrendChart } from "./ITAnalyticsTrendChart";

type RequestState =
    | { readonly key: string; readonly kind: "loaded"; readonly data: ITAnalyticsDashboardDTO }
    | { readonly key: string; readonly kind: "error"; readonly message: string };

class ITAnalyticsRequestError extends Error {}

/**
 * Optional operator-queue destinations. Supplied only when the viewer also
 * holds operator Ticket read; analytics access alone never links to Tickets.
 */
export type ITAnalyticsNavigation = ITAnalyticsQueueDestinations;

const PERIOD_LABELS: Readonly<Record<ITAnalyticsPeriod, string>> = {
    "7D": "7 วัน",
    "30D": "30 วัน",
    "90D": "90 วัน",
};

const BREAKDOWN_OPTIONS = [
    { value: "status", label: "สถานะ" },
    { value: "priority", label: "Priority" },
    { value: "category", label: "หมวดหมู่งานค้าง" },
] as const;

type BreakdownDimension = typeof BREAKDOWN_OPTIONS[number]["value"];

const LINK_CLASS_NAME = "inline-flex min-h-11 items-center gap-1 rounded-md text-sm font-medium text-brand-strong underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-sky-300";

function ReportSkeleton(): ReactElement {
    return (
        <div role="status" aria-label="กำลังโหลดรายงาน IT" className="space-y-5">
            <span className="sr-only">กำลังโหลดรายงาน IT</span>
            <Skeleton className="h-7 w-52" />
            <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 2 }, (_, index) => (
                    <Skeleton key={index} className="h-32 w-full rounded-xl" />
                ))}
            </div>
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-96 w-full rounded-xl" />
            <div className="grid gap-5 lg:grid-cols-2">
                <Skeleton className="h-72 w-full rounded-xl" />
                <Skeleton className="h-72 w-full rounded-xl" />
            </div>
        </div>
    );
}

function KpiCard({
    label,
    count,
    detail,
}: {
    readonly label: string;
    readonly count: number;
    readonly detail?: ReactNode;
}): ReactElement {
    return (
        <div className="min-w-0 rounded-xl border border-border-neutral bg-surface-raised p-3 sm:p-5">
            <dt className="text-sm font-medium leading-6 text-content-secondary [overflow-wrap:anywhere]">{label}</dt>
            <dd className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-content-heading [overflow-wrap:anywhere] sm:text-3xl">
                {formatITAnalyticsCount(count)}
            </dd>
            {detail ? <dd className="mt-1.5 text-xs leading-5 text-content-secondary">{detail}</dd> : null}
        </div>
    );
}

function PeriodOverview({ dashboard }: { readonly dashboard: ITAnalyticsDashboardDTO }): ReactElement {
    const { summary, previousPeriod } = dashboard;
    return (
        <section aria-labelledby="it-analytics-period-title" aria-describedby="it-analytics-period-description" className="min-w-0 space-y-3">
            <div className="space-y-1">
                <h2 id="it-analytics-period-title" className="text-lg font-semibold text-content-heading">ผลการดำเนินงานตามช่วงเวลา</h2>
                <p id="it-analytics-period-description" className="text-sm leading-6 text-content-secondary">
                    เปรียบเทียบกับช่วงก่อนหน้าที่มีระยะเวลาเท่ากัน ({formatITAnalyticsDateTime(previousPeriod.startAt)} ถึง {formatITAnalyticsDateTime(previousPeriod.endAt)} น.)
                </p>
            </div>
            <dl className="grid min-w-0 grid-cols-2 gap-3">
                <KpiCard
                    label="Ticket ใหม่"
                    count={summary.newTickets}
                    detail={formatITAnalyticsComparison(summary.newTickets, previousPeriod.newTickets)}
                />
                <KpiCard
                    label="แก้ไขแล้ว"
                    count={summary.resolvedTickets}
                    detail={formatITAnalyticsComparison(summary.resolvedTickets, previousPeriod.resolvedTickets)}
                />
            </dl>
            <div className="space-y-2 rounded-xl border border-border-neutral bg-surface-subtle px-3 py-3 sm:px-5">
                <dl className="grid grid-cols-3 gap-3">
                    {[
                        { label: "ปิดงานแล้ว", count: summary.closedTickets },
                        { label: "ยกเลิก", count: summary.cancelledTickets },
                        { label: "เปิดกลับมาแก้ไข", count: summary.reopenedTickets },
                    ].map(({ label, count }) => (
                        <div key={label} className="min-w-0">
                            <dt className="text-sm leading-5 text-content-secondary [overflow-wrap:anywhere]">{label}</dt>
                            <dd className="text-lg font-semibold tabular-nums text-content-heading [overflow-wrap:anywhere]">{formatITAnalyticsCount(count)}</dd>
                        </div>
                    ))}
                </dl>
                <p className="text-xs leading-5 text-content-secondary">
                    นับ Ticket หนึ่งครั้งต่อประเภทเหตุการณ์ในช่วงที่เลือก Ticket เดียวอาจอยู่หลายประเภทและมีสถานะล่าสุดต่างจากเหตุการณ์ที่นับ
                </p>
            </div>
        </section>
    );
}

interface AttentionItem {
    readonly key: string;
    readonly icon: LucideIcon;
    readonly label: string;
    readonly description: string;
    readonly count: number;
    readonly actions: readonly { readonly href: string; readonly label: string }[];
}

function AttentionPanel({
    dashboard,
    navigation,
}: {
    readonly dashboard: ITAnalyticsDashboardDTO;
    readonly navigation?: ITAnalyticsNavigation;
}): ReactElement {
    const { summary } = dashboard;
    const priorityCount = (priority: ITTicketPriority): number =>
        dashboard.priorityBacklog.find((row) => row.priority === priority)?.count ?? 0;
    const items: readonly AttentionItem[] = [
        {
            key: "high-priority",
            icon: ShieldAlert,
            label: "งานเร่งด่วน P0 / P1 ที่ยังไม่แก้ไข",
            description: "ใช้ Priority ปัจจุบันของ Ticket",
            count: summary.highPriorityBacklog,
            actions: navigation
                ? (["P0", "P1"] as const)
                    .filter((priority) => priorityCount(priority) > 0)
                    .map((priority) => ({
                        href: navigation.getPriorityHref(priority),
                        label: `ดู ${priority} ในคิวงาน`,
                    }))
                : [],
        },
        {
            key: "unassigned",
            icon: UserRoundX,
            label: "ยังไม่มีผู้รับผิดชอบ",
            description: "งานค้างที่ยังไม่ได้มอบหมายให้เจ้าหน้าที่",
            count: summary.unassignedBacklog,
            actions: navigation && summary.unassignedBacklog > 0
                ? [{ href: navigation.unassignedHref, label: "ดูในคิวงาน" }]
                : [],
        },
        {
            key: "untriaged",
            icon: CircleAlert,
            label: "ยังไม่ประเมิน Priority",
            description: "งานค้างที่ยังไม่ผ่านการประเมิน Priority",
            count: summary.untriagedBacklog,
            actions: navigation && summary.untriagedBacklog > 0
                ? [{ href: navigation.untriagedHref, label: "ดูในคิวงาน" }]
                : [],
        },
        {
            key: "aged",
            icon: Clock3,
            label: `ค้างเกิน ${IT_ANALYTICS_AGED_BACKLOG_MIN_DAYS - 1} วัน`,
            description: `สร้างมาแล้วอย่างน้อย ${IT_ANALYTICS_AGED_BACKLOG_MIN_DAYS} วันเต็มและยังไม่แก้ไข`,
            count: summary.agedBacklog,
            actions: [],
        },
    ];

    return (
        <ITAnalyticsPanel
            title="สิ่งที่ต้องติดตาม"
            scope="snapshot"
            description="งานค้างที่ควรตรวจสอบก่อน Ticket เดียวอาจอยู่ได้หลายรายการติดตาม"
        >
            <ul className="divide-y divide-border-neutral lg:grid lg:grid-cols-2 lg:gap-x-6 lg:gap-y-5 lg:divide-y-0">
                {items.map((item) => {
                    const Icon = item.icon;
                    const needsAttention = item.count > 0;
                    return (
                        <li key={item.key} className="flex min-w-0 items-start gap-3 py-3 first:pt-0 last:pb-0 lg:py-0">
                            <span
                                aria-hidden="true"
                                className={"mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg "
                                    + (needsAttention
                                        ? "bg-status-warning-surface text-status-warning-strong"
                                        : "bg-surface-subtle text-content-muted")}
                            >
                                <Icon className="size-4.5" />
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="break-words text-sm font-medium leading-6 text-content-heading">{item.label}</p>
                                <p className="break-words text-xs leading-5 text-content-secondary">{item.description}</p>
                                {item.actions.length > 0 ? (
                                    <div className="mt-0.5 flex flex-wrap gap-x-4">
                                        {item.actions.map((action) => (
                                            <Link key={action.href} href={action.href} className={LINK_CLASS_NAME + " min-h-9 text-xs"}>
                                                {action.label}
                                                <ArrowUpRight aria-hidden="true" className="size-3.5" />
                                            </Link>
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                            <span className="shrink-0 text-right">
                                <strong className="block text-xl font-semibold tabular-nums text-content-heading">
                                    {formatITAnalyticsCount(item.count)}
                                </strong>
                                <span className="text-xs text-content-muted">{needsAttention ? "รายการ" : "ไม่มีรายการ"}</span>
                            </span>
                        </li>
                    );
                })}
            </ul>
        </ITAnalyticsPanel>
    );
}

function BreakdownPanel({ dashboard }: { readonly dashboard: ITAnalyticsDashboardDTO }): ReactElement {
    const [selectedBreakdown, setSelectedBreakdown] = useState<BreakdownDimension>("status");
    const breakdowns: Readonly<Record<BreakdownDimension, {
        readonly title: string;
        readonly description: string;
        readonly scope: ITAnalyticsScope;
        readonly rows: readonly { readonly label: string; readonly count: number }[];
    }>> = {
        status: {
            title: "สถานะ Ticket ปัจจุบัน",
            description: "Ticket ทั้งหมดตามตัวกรอง แยกตามสถานะล่าสุด",
            scope: "snapshot",
            rows: dashboard.statusDistribution.map((row) => ({
                label: IT_TICKET_STATUS_LABELS[row.status],
                count: row.count,
            })),
        },
        priority: {
            title: "Ticket ปัจจุบันแยกตาม Priority",
            description: "รวมทุกสถานะและจัดกลุ่มตาม Priority ปัจจุบัน",
            scope: "snapshot",
            rows: dashboard.priorityDistribution.map((row) => ({
                label: IT_TICKET_PRIORITY_LABELS[row.priority],
                count: row.count,
            })),
        },
        category: {
            title: "งานค้างแยกตามหมวดหมู่",
            description: "รวมเฉพาะ Ticket ที่ยังไม่แก้ไข จัดกลุ่มตามหมวดหมู่ปัจจุบัน",
            scope: "snapshot",
            rows: dashboard.categoryBacklog,
        },
    };
    const breakdown = breakdowns[selectedBreakdown];
    const handleBreakdownChange = (value: string): void => {
        const option = BREAKDOWN_OPTIONS.find((item) => item.value === value);
        if (option) setSelectedBreakdown(option.value);
    };

    return (
        <ITAnalyticsPanel
            title={breakdown.title}
            headingLevel={2}
            scope={breakdown.scope}
            description={breakdown.description}
            action={(
                <label className="flex w-full min-w-0 flex-col gap-1.5 text-sm font-medium text-content-secondary sm:w-56">
                    <span>รายละเอียดเพิ่มเติม</span>
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
            )}
        >
            <ITAnalyticsCountBars rows={breakdown.rows} className="md:grid-cols-2" />
        </ITAnalyticsPanel>
    );
}

export function ITAnalyticsReport({
    dashboard,
    navigation,
    onCategorySelect,
}: {
    readonly dashboard: ITAnalyticsDashboardDTO;
    readonly navigation?: ITAnalyticsNavigation;
    readonly onCategorySelect?: (category: ITAnalyticsCategoryFilter) => void;
}): ReactElement {
    const { summary } = dashboard;
    const countByStatus = new Map(dashboard.statusDistribution.map(({ status, count }) => [status, count]));
    const backlogStatuses = IT_TICKET_ACTIVE_WORK_STATUSES.map((status) => ({
        label: IT_TICKET_STATUS_LABELS[status],
        count: countByStatus.get(status) ?? 0,
    }));
    const scrollDepartments = dashboard.departmentCreated.length > 5;
    const priorityCount = (priority: "P0" | "P1"): number =>
        dashboard.priorityBacklog.find((row) => row.priority === priority)?.count ?? 0;

    return (
        <div className="min-w-0 space-y-7">
            <PeriodOverview dashboard={dashboard} />
            <section aria-labelledby="it-analytics-demand-title" className="min-w-0 space-y-3">
                <h2 id="it-analytics-demand-title" className="text-lg font-semibold text-content-heading">ปริมาณงานและแนวโน้ม</h2>
                <ITAnalyticsTrendChart trend={dashboard.trend} period={dashboard.period.key} />
                <ITAnalyticsTopCategoriesPanel
                    topCategories={dashboard.topCategories}
                    selectedCategory={dashboard.filters.category}
                    onCategorySelect={onCategorySelect}
                />
                <div className="grid min-w-0 items-start gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                    <ITAnalyticsPanel
                        title="Ticket ใหม่แยกตามหน่วยงาน"
                        scope="period"
                        description={`ใช้ชื่อหน่วยงานที่บันทึกเมื่อสร้าง Ticket สัดส่วนเทียบกับ Ticket ใหม่ทั้งหมดตามตัวกรอง${scrollDepartments
                            ? ` เลื่อนรายการเพื่อดูครบ ${formatITAnalyticsCount(dashboard.departmentCreated.length)} หน่วยงาน`
                            : ""}`}
                    >
                        <div
                            role="region"
                            aria-label="รายการหน่วยงานทั้งหมด"
                            tabIndex={scrollDepartments ? 0 : undefined}
                            className={scrollDepartments
                                ? "max-h-96 overflow-y-auto rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                : undefined}
                        >
                            <ITAnalyticsCountBars rows={dashboard.departmentCreated} shareTotal={summary.newTickets} />
                        </div>
                    </ITAnalyticsPanel>
                    <ITAnalyticsPanel title="Ticket ใหม่แยกตามประเภท" scope="period">
                        <ITAnalyticsCountBars
                            rows={summary.newTickets === 0 ? [] : dashboard.typeDistribution.map(({ type, count }) => ({
                                label: IT_TICKET_TYPE_LABELS[type],
                                count,
                            }))}
                            shareTotal={summary.newTickets}
                        />
                    </ITAnalyticsPanel>
                </div>
            </section>
            <section aria-labelledby="it-analytics-snapshot-title" aria-describedby="it-analytics-snapshot-description" className="min-w-0 space-y-3">
                <div className="space-y-1">
                    <h2 id="it-analytics-snapshot-title" className="text-lg font-semibold text-content-heading">สถานะงานปัจจุบัน</h2>
                    <p id="it-analytics-snapshot-description" className="text-sm leading-6 text-content-secondary">แสดงงานค้างตามสถานะล่าสุดของ Ticket โดยใช้ตัวกรองประเภทและหมวดหมู่</p>
                </div>
                <dl className="grid min-w-0 grid-cols-2 gap-3 xl:grid-cols-4">
                    <KpiCard
                        label="งานค้างทั้งหมด"
                        count={summary.currentBacklog}
                        detail={summary.oldestUnresolvedAgeMinutes === null
                            ? "ไม่มีงานค้าง"
                            : "งานที่ค้างนานที่สุด " + formatITAnalyticsDuration(summary.oldestUnresolvedAgeMinutes)}
                    />
                    <KpiCard label="กำลังดำเนินการ" count={countByStatus.get("IN_PROGRESS") ?? 0} />
                    <KpiCard label="รอข้อมูลจากผู้แจ้ง" count={summary.waitingRequester} />
                    <KpiCard
                        label="งานเร่งด่วน P0 / P1"
                        count={summary.highPriorityBacklog}
                        detail={`P0 ${formatITAnalyticsCount(priorityCount("P0"))} · P1 ${formatITAnalyticsCount(priorityCount("P1"))}`}
                    />
                </dl>
                <div className="grid min-w-0 gap-3 lg:grid-cols-2">
                    <ITAnalyticsPanel title="งานค้างแยกตามสถานะ" scope="snapshot">
                        <ITAnalyticsCountBars rows={summary.currentBacklog === 0 ? [] : backlogStatuses} />
                    </ITAnalyticsPanel>
                    <ITAnalyticsPriorityBacklogPanel
                        rows={dashboard.priorityBacklog}
                        getPriorityHref={navigation?.getPriorityHref}
                    />
                </div>
                <AttentionPanel dashboard={dashboard} navigation={navigation} />
                <div className="grid min-w-0 gap-3 lg:grid-cols-2">
                    <ITAnalyticsBacklogAgingPanel rows={dashboard.backlogAging} />
                    <ITAnalyticsWorkloadPanel
                        rows={dashboard.assigneeBacklog}
                        unassignedHref={navigation?.unassignedHref}
                    />
                </div>
            </section>
            <BreakdownPanel dashboard={dashboard} />
        </div>
    );
}

function ReportingWindow({ dashboard }: { readonly dashboard: ITAnalyticsDashboardDTO }): ReactElement {
    return (
        <div className="min-w-0 space-y-1 text-xs leading-5 text-content-secondary">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <ITAnalyticsScopeBadge scope="period" />
                <span>
                    {formatITAnalyticsDateTime(dashboard.period.startAt)} – {formatITAnalyticsDateTime(dashboard.period.endAt)} น.
                    <span className="mx-1" aria-hidden="true">·</span>
                    เวลาเอเชีย/กรุงเทพฯ
                </span>
            </p>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <ITAnalyticsScopeBadge scope="snapshot" />
                <span>สถานะล่าสุด ไม่ขึ้นกับช่วงเวลา · อัปเดตข้อมูล {formatITAnalyticsDateTime(dashboard.generatedAt)} น.</span>
            </p>
        </div>
    );
}

const ALL_FILTER_VALUE = "ALL";

type CategoryOption = ITAnalyticsDashboardDTO["filterOptions"]["categories"][number];

function categoryOptionLabel(option: CategoryOption, options: readonly CategoryOption[]): string {
    const duplicateName = options.some((other) => other.id !== option.id && other.name === option.name);
    const name = duplicateName ? `${option.name} (${option.key})` : option.name;
    return option.isActive ? name : `${name} · ปิดใช้งาน`;
}

function ReportFilters({
    state,
    categoryOptions,
    onChange,
}: {
    readonly state: ITAnalyticsReportState;
    readonly categoryOptions: readonly CategoryOption[];
    readonly onChange: (state: ITAnalyticsReportState) => void;
}): ReactElement {
    const fieldClassName = "flex min-w-0 flex-col gap-1.5 text-sm font-medium text-content-secondary";
    const categoryValue = state.category === null ? ALL_FILTER_VALUE : String(state.category);
    const selectedCategoryMissing = typeof state.category === "number"
        && !categoryOptions.some((option) => option.id === state.category);
    const filtered = !isDefaultITAnalyticsReportState(state);

    return (
        <div role="group" aria-label="ตัวกรองรายงาน" className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto] lg:items-end">
            <label className={fieldClassName}>
                ช่วงเวลารายงาน
                <Select
                    value={state.period}
                    onValueChange={(value) => {
                        if ((IT_ANALYTICS_PERIODS as readonly string[]).includes(value)) {
                            onChange({ ...state, period: value as ITAnalyticsPeriod });
                        }
                    }}
                >
                    <SelectTrigger aria-label="เลือกช่วงเวลารายงาน" className="min-h-11 w-full">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {IT_ANALYTICS_PERIODS.map((value) => (
                            <SelectItem key={value} value={value}>{PERIOD_LABELS[value]}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </label>
            <label className={fieldClassName}>
                ประเภท Ticket
                <Select
                    value={state.type ?? ALL_FILTER_VALUE}
                    onValueChange={(value) => {
                        const option = IT_TICKET_TYPE_OPTIONS.find((item) => item.value === value);
                        onChange({ ...state, type: option?.value ?? null });
                    }}
                >
                    <SelectTrigger aria-label="กรองตามประเภท Ticket" className="min-h-11 w-full">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL_FILTER_VALUE}>ทุกประเภท</SelectItem>
                        {IT_TICKET_TYPE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {IT_TICKET_TYPE_LABELS[option.value]}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </label>
            <label className={fieldClassName}>
                หมวดหมู่
                <Select
                    value={categoryValue}
                    onValueChange={(value) => {
                        onChange({
                            ...state,
                            category: value === ALL_FILTER_VALUE ? null : parseITAnalyticsCategoryFilter(value),
                        });
                    }}
                >
                    <SelectTrigger aria-label="กรองตามหมวดหมู่" className="min-h-11 w-full">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL_FILTER_VALUE}>ทุกหมวดหมู่</SelectItem>
                        <SelectItem value={IT_ANALYTICS_UNCATEGORIZED_FILTER}>{IT_ANALYTICS_UNCATEGORIZED_LABEL}</SelectItem>
                        {categoryOptions.map((option) => (
                            <SelectItem key={option.id} value={String(option.id)}>
                                {categoryOptionLabel(option, categoryOptions)}
                            </SelectItem>
                        ))}
                        {selectedCategoryMissing ? (
                            <SelectItem value={categoryValue}>หมวดหมู่ที่เลือก (ไม่พบในรายการ)</SelectItem>
                        ) : null}
                    </SelectContent>
                </Select>
            </label>
            <Button
                type="button"
                variant="outline"
                className="min-h-11 gap-2"
                disabled={!filtered}
                onClick={() => onChange(IT_ANALYTICS_DEFAULT_REPORT_STATE)}
            >
                <RotateCcw aria-hidden="true" className="size-4" />
                ล้างตัวกรอง
            </Button>
        </div>
    );
}

function ActiveFilterSummary({
    state,
    categoryOptions,
}: {
    readonly state: ITAnalyticsReportState;
    readonly categoryOptions: readonly CategoryOption[];
}): ReactElement | null {
    if (state.type === null && state.category === null) return null;
    const parts: string[] = [];
    if (state.type !== null) parts.push(`ประเภท ${IT_TICKET_TYPE_LABELS[state.type]}`);
    if (state.category === IT_ANALYTICS_UNCATEGORIZED_FILTER) {
        parts.push(`หมวดหมู่ ${IT_ANALYTICS_UNCATEGORIZED_LABEL}`);
    } else if (state.category !== null) {
        const option = categoryOptions.find((item) => item.id === state.category);
        parts.push(`หมวดหมู่ ${option ? categoryOptionLabel(option, categoryOptions) : "ที่เลือก"}`);
    }
    return (
        <p role="note" className="rounded-lg border border-brand-border-strong/30 bg-brand-surface px-3 py-2 text-sm leading-6 text-brand-strong">
            กำลังกรอง: {parts.join(" · ")} — ตัวกรองนี้มีผลกับทั้งข้อมูลตามช่วงรายงานและข้อมูล ณ ปัจจุบัน
            โดยใช้ประเภทและหมวดหมู่ปัจจุบันของ Ticket
        </p>
    );
}

/**
 * Report filters may be controlled by the workspace URL (`reportState` +
 * `onReportStateChange`) or kept locally when rendered standalone.
 * `canOpenOperatorQueue` reflects the server-derived Ticket read ALL
 * projection; the queue API still authorizes every request itself.
 */
export function ITAnalyticsDashboard({
    embedded = false,
    canOpenOperatorQueue = false,
    reportState: controlledState,
    onReportStateChange,
}: {
    readonly embedded?: boolean;
    readonly canOpenOperatorQueue?: boolean;
    readonly reportState?: ITAnalyticsReportState;
    readonly onReportStateChange?: (state: ITAnalyticsReportState) => void;
} = {}): ReactElement {
    const [localState, setLocalState] = useState<ITAnalyticsReportState>(IT_ANALYTICS_DEFAULT_REPORT_STATE);
    const state = controlledState ?? localState;
    const [refreshCount, setRefreshCount] = useState(0);
    const [requestState, setRequestState] = useState<RequestState | null>(null);
    const [categoryOptions, setCategoryOptions] = useState<readonly CategoryOption[]>([]);
    const latestRequestId = useRef(0);
    const stateKey = getITAnalyticsReportStateKey(state);
    const requestKey = `${stateKey}:${refreshCount}`;
    const visibleState = requestState?.key === requestKey ? requestState : null;
    const apiQuery = toITAnalyticsApiQuery(state);

    useEffect(() => {
        const controller = new AbortController();
        const requestId = ++latestRequestId.current;
        const url = `${API_ROUTES.itAnalytics.dashboard}?${apiQuery}`;

        void fetch(url, { signal: controller.signal, cache: "no-store" })
            .then(async (response) => {
                const payload: unknown = await response.json().catch(() => null);
                if (!response.ok) throw new ITAnalyticsRequestError(readITAnalyticsError(response.status));
                const parsed = parseITAnalyticsDashboardResponse(payload);
                if (parsed === null) {
                    throw new ITAnalyticsRequestError("ข้อมูลรายงาน IT ไม่ถูกต้อง กรุณาลองอีกครั้ง");
                }
                if (!controller.signal.aborted && requestId === latestRequestId.current) {
                    setCategoryOptions(parsed.filterOptions.categories);
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
    }, [apiQuery, requestKey]);

    const handleStateChange = (next: ITAnalyticsReportState): void => {
        if (getITAnalyticsReportStateKey(next) === stateKey) return;
        if (onReportStateChange) onReportStateChange(next);
        else setLocalState(next);
    };

    const reportState = visibleState;
    const refreshReport = (): void => setRefreshCount((current) => current + 1);
    const Heading = embedded ? "h2" : "h1";
    const navigation = canOpenOperatorQueue && reportState?.kind === "loaded"
        ? buildITAnalyticsQueueDestinations(reportState.data.filters)
        : undefined;
    return (
        <section className="mx-auto w-full max-w-7xl min-w-0 space-y-5">
            <header className={`min-w-0 space-y-4 ${embedded ? "" : "border-b border-border-neutral pb-5"}`}>
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                        <Heading
                            data-page-heading={embedded ? undefined : true}
                            tabIndex={embedded ? undefined : -1}
                            className="text-xl font-semibold tracking-tight text-content-heading [overflow-wrap:anywhere] md:text-2xl"
                        >
                            รายงานการให้บริการ IT
                        </Heading>
                        <p className="text-sm leading-6 text-content-secondary">
                            ติดตาม Ticket ที่รับเข้าและแก้ไข พร้อมงานค้างที่ต้องติดตาม
                        </p>
                    </div>
                    {reportState?.kind !== "error" ? (
                        <Button type="button" variant="outline" className="min-h-11 gap-2" disabled={reportState === null} onClick={refreshReport}>
                            <RotateCw aria-hidden="true" className="size-4" />
                            อัปเดตรายงาน
                        </Button>
                    ) : null}
                </div>
                <ReportFilters state={state} categoryOptions={categoryOptions} onChange={handleStateChange} />
                <ActiveFilterSummary state={state} categoryOptions={categoryOptions} />
                {reportState?.kind === "loaded" ? <ReportingWindow dashboard={reportState.data} /> : null}
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
                        onClick={refreshReport}
                    >
                        <RotateCw aria-hidden="true" className="size-4" />
                        ลองอีกครั้ง
                    </Button>
                </div>
            ) : (
                <ITAnalyticsReport
                    dashboard={reportState.data}
                    navigation={navigation}
                    onCategorySelect={(category) => handleStateChange({ ...state, category })}
                />
            )}
        </section>
    );
}
