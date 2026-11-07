"use client";

import { useEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, BarChart3, CircleAlert, Clock3, RotateCw, ShieldAlert, UserRoundX, type LucideIcon } from "lucide-react";
import type { ITTicketPriority } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { API_ROUTES } from "@/lib/ssot/routes";

import {
    IT_ANALYTICS_AGED_BACKLOG_MIN_DAYS,
    IT_ANALYTICS_PERIODS,
    IT_TICKET_PRIORITY_LABELS,
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
import { formatITAnalyticsCount } from "./analytics-view";
import {
    ITAnalyticsBacklogAgingPanel,
    ITAnalyticsEmptyState,
    ITAnalyticsPanel,
    ITAnalyticsPriorityBacklogPanel,
    ITAnalyticsScopeBadge,
    ITAnalyticsTopCategoriesPanel,
    ITAnalyticsWorkloadPanel,
    type ITAnalyticsScope,
} from "./ITAnalyticsCharts";
import { IT_TICKET_PRIORITY_STYLES } from "./ticket-presentation";
import { ITAnalyticsTrendChart } from "./ITAnalyticsTrendChart";

type RequestState =
    | { readonly key: string; readonly kind: "loaded"; readonly data: ITAnalyticsDashboardDTO }
    | { readonly key: string; readonly kind: "error"; readonly message: string };

class ITAnalyticsRequestError extends Error {}

/**
 * Optional operator-queue destinations. Supplied only when the viewer also
 * holds operator Ticket read; analytics access alone never links to Tickets.
 */
export interface ITAnalyticsNavigation {
    readonly getCategoryHref: (categoryId: number | null) => string;
    readonly getPriorityHref: (priority: ITTicketPriority) => string;
    readonly unassignedHref: string;
    readonly untriagedHref: string;
}

const PERIOD_LABELS: Readonly<Record<ITAnalyticsPeriod, string>> = {
    "7D": "7 วัน",
    "30D": "30 วัน",
    "90D": "90 วัน",
};

const BREAKDOWN_OPTIONS = [
    { value: "status", label: "สถานะ" },
    { value: "type", label: "ประเภท" },
    { value: "priority", label: "Priority" },
    { value: "category", label: "หมวดหมู่งานค้าง" },
    { value: "department", label: "หน่วยงาน" },
] as const;

type BreakdownDimension = typeof BREAKDOWN_OPTIONS[number]["value"];

const LINK_CLASS_NAME = "inline-flex min-h-11 items-center gap-1 rounded-md text-sm font-medium text-brand-strong underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-sky-300";

function ReportSkeleton(): ReactElement {
    return (
        <div role="status" aria-label="กำลังโหลดรายงาน IT" className="space-y-5">
            <span className="sr-only">กำลังโหลดรายงาน IT</span>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {Array.from({ length: 4 }, (_, index) => (
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
    value,
    detail,
    scope,
    marker,
}: {
    readonly label: string;
    readonly value: string;
    readonly detail: ReactNode;
    readonly scope: ITAnalyticsScope;
    readonly marker?: ReactNode;
}): ReactElement {
    return (
        <div className="flex min-w-0 flex-col rounded-xl border border-border-neutral bg-surface-raised p-4 sm:p-5">
            <dt className="flex min-w-0 flex-wrap items-center gap-2 text-sm font-medium leading-6 text-content-secondary">
                <span className="min-w-0 break-words">{label}</span>
                {marker ?? null}
            </dt>
            <dd className="mt-2 text-3xl font-bold tracking-tight tabular-nums text-content-heading sm:text-4xl">
                {value}
            </dd>
            <dd className="mt-2 flex min-w-0 flex-1 flex-col justify-end gap-2 text-xs leading-5 text-content-secondary">
                <span className="break-words">{detail}</span>
                <span><ITAnalyticsScopeBadge scope={scope} /></span>
            </dd>
        </div>
    );
}

function PriorityMarker({ priority }: { readonly priority: ITTicketPriority }): ReactElement {
    return (
        <span className={`inline-flex min-h-6 items-center rounded-full px-2 text-xs font-semibold ${IT_TICKET_PRIORITY_STYLES[priority]}`}>
            {priority}
        </span>
    );
}

function KpiSummary({ dashboard }: { readonly dashboard: ITAnalyticsDashboardDTO }): ReactElement {
    const { summary } = dashboard;
    const priorityCount = (priority: ITTicketPriority): number =>
        dashboard.priorityBacklog.find((row) => row.priority === priority)?.count ?? 0;
    return (
        <section aria-labelledby="it-analytics-overview-title" className="min-w-0 space-y-3">
            <h2 id="it-analytics-overview-title" className="sr-only">ภาพรวม</h2>
            <dl className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-4">
                <KpiCard
                    label="งานค้างปัจจุบัน"
                    value={formatITAnalyticsCount(summary.currentBacklog)}
                    scope="snapshot"
                    detail={summary.oldestUnresolvedAgeMinutes === null
                        ? "ไม่มีงานค้าง"
                        : "งานที่ค้างนานที่สุด " + formatITAnalyticsDuration(summary.oldestUnresolvedAgeMinutes)}
                />
                <KpiCard
                    label="Ticket ใหม่"
                    value={formatITAnalyticsCount(summary.newTickets)}
                    scope="period"
                    detail={`สร้างในช่วง ${PERIOD_LABELS[dashboard.period.key]}ล่าสุด`}
                />
                <KpiCard
                    label="แก้ไขแล้ว"
                    value={formatITAnalyticsCount(summary.resolvedTickets)}
                    scope="period"
                    detail="นับ Ticket ละครั้ง แม้เปิดใหม่และแก้ไขซ้ำในช่วงเดียวกัน"
                />
                <KpiCard
                    label="งานเร่งด่วน"
                    marker={<><PriorityMarker priority="P0" /><PriorityMarker priority="P1" /></>}
                    value={formatITAnalyticsCount(summary.highPriorityBacklog)}
                    scope="snapshot"
                    detail={`P0 ${formatITAnalyticsCount(priorityCount("P0"))} · P1 ${formatITAnalyticsCount(priorityCount("P1"))} ที่ยังไม่แก้ไข`}
                />
            </dl>
            <dl className="grid min-w-0 grid-cols-2 gap-x-5 gap-y-4 rounded-xl border border-border-neutral bg-surface-subtle px-4 py-4 sm:px-5 lg:grid-cols-4">
                <SecondaryMetric
                    label="ตอบกลับครั้งแรกเฉลี่ย"
                    value={formatITAnalyticsDuration(summary.averageFirstResponseMinutes)}
                    detail={`จาก ${formatITAnalyticsCount(summary.firstRespondedTickets)} Ticket ใหม่ที่ตอบแล้ว`}
                />
                <SecondaryMetric
                    label="เวลาแก้ไขเฉลี่ย"
                    value={formatITAnalyticsDuration(summary.averageResolutionMinutes)}
                    detail={`จาก ${formatITAnalyticsCount(summary.resolvedTickets)} Ticket ที่แก้ไขในช่วงนี้`}
                />
                <SecondaryMetric
                    label="ยังไม่มีผู้รับผิดชอบ"
                    value={formatITAnalyticsCount(summary.unassignedBacklog)}
                    detail="ในงานค้างปัจจุบัน"
                />
                <SecondaryMetric
                    label="ยังไม่ประเมิน Priority"
                    value={formatITAnalyticsCount(summary.untriagedBacklog)}
                    detail="ในงานค้างปัจจุบัน"
                />
            </dl>
        </section>
    );
}

function SecondaryMetric({
    label,
    value,
    detail,
}: {
    readonly label: string;
    readonly value: string;
    readonly detail: string;
}): ReactElement {
    return (
        <div className="min-w-0">
            <dt className="break-words text-xs font-medium leading-5 text-content-secondary">{label}</dt>
            <dd className="mt-0.5 break-words text-lg font-semibold tabular-nums text-content-heading">{value}</dd>
            <dd className="text-xs leading-5 text-content-muted">{detail}</dd>
        </div>
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
            description="งานค้างที่ควรตรวจสอบก่อน คำนวณจากสถานะล่าสุดของ Ticket"
        >
            <ul className="divide-y divide-border-neutral">
                {items.map((item) => {
                    const Icon = item.icon;
                    const needsAttention = item.count > 0;
                    return (
                        <li key={item.key} className="flex min-w-0 items-start gap-3 py-3 first:pt-0 last:pb-0">
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

function ServicePerformancePanel({ dashboard }: { readonly dashboard: ITAnalyticsDashboardDTO }): ReactElement {
    const { summary, responseResolutionByPriority: rows } = dashboard;
    return (
        <ITAnalyticsPanel
            title="ประสิทธิภาพการให้บริการ"
            scope="period"
            description="เวลาตามนาฬิกาจริง ไม่หักวันหยุดหรือนอกเวลาทำการ และไม่ใช่การวัด SLA"
        >
            <dl className="grid min-w-0 gap-4 sm:grid-cols-2">
                <div className="min-w-0 rounded-lg bg-surface-subtle p-4">
                    <dt className="text-sm font-medium text-content-secondary">ตอบกลับครั้งแรกเฉลี่ย</dt>
                    <dd className="mt-1 text-2xl font-semibold tabular-nums text-content-heading">
                        {formatITAnalyticsDuration(summary.averageFirstResponseMinutes)}
                    </dd>
                    <dd className="mt-1 text-xs leading-5 text-content-secondary">
                        จาก <span className="tabular-nums">{formatITAnalyticsCount(summary.firstRespondedTickets)}</span> Ticket ที่สร้างในช่วงรายงานและได้รับการตอบกลับแล้ว
                    </dd>
                </div>
                <div className="min-w-0 rounded-lg bg-surface-subtle p-4">
                    <dt className="text-sm font-medium text-content-secondary">เวลาแก้ไขเฉลี่ย</dt>
                    <dd className="mt-1 text-2xl font-semibold tabular-nums text-content-heading">
                        {formatITAnalyticsDuration(summary.averageResolutionMinutes)}
                    </dd>
                    <dd className="mt-1 text-xs leading-5 text-content-secondary">
                        จาก <span className="tabular-nums">{formatITAnalyticsCount(summary.resolvedTickets)}</span> Ticket ที่แก้ไขในช่วงรายงาน นับจากเวลาสร้างถึงการแก้ไขครั้งแรกในช่วง
                    </dd>
                </div>
            </dl>
            <h3 className="mt-6 text-base font-semibold text-content-heading">แยกตาม Priority ปัจจุบัน</h3>
            <p className="mt-1 text-sm leading-6 text-content-secondary">
                หากมีการเปลี่ยน Priority ภายหลัง ข้อมูลย้อนหลังของ Ticket นั้นจะย้ายไปอยู่ในกลุ่ม Priority ใหม่
            </p>
            <div className="mt-3 hidden overflow-x-auto rounded-lg border border-border-neutral sm:block">
                <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
                    <caption className="sr-only">เวลาตอบกลับและแก้ไขตาม Priority ปัจจุบัน</caption>
                    <thead className="bg-surface-subtle text-xs font-semibold text-content-secondary">
                        <tr>
                            <th scope="col" className="px-3 py-3">Priority</th>
                            <th scope="col" className="px-3 py-3 text-right">ตอบแล้ว</th>
                            <th scope="col" className="px-3 py-3">ตอบกลับครั้งแรกเฉลี่ย</th>
                            <th scope="col" className="px-3 py-3 text-right">แก้ไขแล้ว</th>
                            <th scope="col" className="px-3 py-3">เวลาแก้ไขเฉลี่ย</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border-neutral">
                        {rows.map((row) => (
                            <tr key={row.priority}>
                                <th scope="row" className="px-3 py-3 font-semibold text-content-heading">
                                    {IT_TICKET_PRIORITY_LABELS[row.priority]}
                                </th>
                                <td className="px-3 py-3 text-right tabular-nums">{formatITAnalyticsCount(row.firstRespondedTickets)}</td>
                                <td className="px-3 py-3">{formatITAnalyticsDuration(row.averageFirstResponseMinutes)}</td>
                                <td className="px-3 py-3 text-right tabular-nums">{formatITAnalyticsCount(row.resolvedTickets)}</td>
                                <td className="px-3 py-3">{formatITAnalyticsDuration(row.averageResolutionMinutes)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <ul aria-label="เวลาตอบกลับและแก้ไขตาม Priority ปัจจุบัน" className="mt-3 divide-y divide-border-neutral rounded-lg border border-border-neutral sm:hidden">
                {rows.map((row) => (
                    <li key={row.priority} className="px-3 py-3">
                        <p className="text-sm font-semibold text-content-heading">{IT_TICKET_PRIORITY_LABELS[row.priority]}</p>
                        <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-xs leading-5">
                            <dt className="text-content-secondary">ตอบกลับเฉลี่ย ({formatITAnalyticsCount(row.firstRespondedTickets)})</dt>
                            <dd className="text-right text-content-body">{formatITAnalyticsDuration(row.averageFirstResponseMinutes)}</dd>
                            <dt className="text-content-secondary">แก้ไขเฉลี่ย ({formatITAnalyticsCount(row.resolvedTickets)})</dt>
                            <dd className="text-right text-content-body">{formatITAnalyticsDuration(row.averageResolutionMinutes)}</dd>
                        </dl>
                    </li>
                ))}
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
        type: {
            title: "Ticket ใหม่แยกตามประเภท",
            description: "นับ Ticket ที่สร้างในช่วงรายงาน",
            scope: "period",
            rows: dashboard.typeDistribution.map((row) => ({
                label: IT_TICKET_TYPE_LABELS[row.type],
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
        department: {
            title: "Ticket ใหม่แยกตามหน่วยงาน",
            description: "ใช้ชื่อหน่วยงานที่บันทึกไว้เมื่อสร้าง Ticket",
            scope: "period",
            rows: dashboard.departmentCreated,
        },
    };
    const breakdown = breakdowns[selectedBreakdown];
    const maximum = Math.max(0, ...breakdown.rows.map((row) => row.count));
    const handleBreakdownChange = (value: string): void => {
        const option = BREAKDOWN_OPTIONS.find((item) => item.value === value);
        if (option) setSelectedBreakdown(option.value);
    };

    return (
        <ITAnalyticsPanel
            title={breakdown.title}
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
            {breakdown.rows.length === 0 ? (
                <ITAnalyticsEmptyState>ยังไม่มีข้อมูลตามตัวกรองที่เลือก</ITAnalyticsEmptyState>
            ) : (
                <ul className="grid gap-x-8 gap-y-4 md:grid-cols-2">
                    {breakdown.rows.map((row) => {
                        const percentage = maximum === 0 ? 0 : (row.count / maximum) * 100;
                        return (
                            <li key={row.label} className="min-w-0">
                                <div className="flex min-w-0 items-start justify-between gap-3">
                                    <span className="min-w-0 break-words text-sm leading-6 text-content-body">{row.label}</span>
                                    <strong className="shrink-0 text-sm tabular-nums text-content-heading">{formatITAnalyticsCount(row.count)}</strong>
                                </div>
                                <div
                                    role="meter"
                                    aria-label={`${row.label} ${formatITAnalyticsCount(row.count)} รายการ`}
                                    aria-valuemin={0}
                                    aria-valuemax={maximum || 1}
                                    aria-valuenow={row.count}
                                    className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-subtle"
                                >
                                    <div aria-hidden="true" className="h-full rounded-full bg-module-it-solid" style={{ width: `${percentage}%` }} />
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </ITAnalyticsPanel>
    );
}

export function ITAnalyticsReport({
    dashboard,
    navigation,
}: {
    readonly dashboard: ITAnalyticsDashboardDTO;
    readonly navigation?: ITAnalyticsNavigation;
}): ReactElement {
    return (
        <div className="min-w-0 space-y-5">
            <KpiSummary dashboard={dashboard} />
            <ITAnalyticsTopCategoriesPanel
                topCategories={dashboard.topCategories}
                selectedCategory={dashboard.filters.category}
                getCategoryHref={navigation?.getCategoryHref}
            />
            <div className="grid min-w-0 gap-5 lg:grid-cols-2">
                <ITAnalyticsPriorityBacklogPanel
                    rows={dashboard.priorityBacklog}
                    getPriorityHref={navigation?.getPriorityHref}
                />
                <ITAnalyticsBacklogAgingPanel rows={dashboard.backlogAging} />
            </div>
            <div className="grid min-w-0 gap-5 lg:grid-cols-2">
                <AttentionPanel dashboard={dashboard} navigation={navigation} />
                <ITAnalyticsWorkloadPanel
                    rows={dashboard.assigneeBacklog}
                    unassignedHref={navigation?.unassignedHref}
                />
            </div>
            <ServicePerformancePanel dashboard={dashboard} />
            <ITAnalyticsTrendChart trend={dashboard.trend} period={dashboard.period.key} />
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

export function ITAnalyticsDashboard({
    embedded = false,
    navigation,
}: {
    readonly embedded?: boolean;
    readonly navigation?: ITAnalyticsNavigation;
} = {}): ReactElement {
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
                <div className="min-w-0 space-y-2">
                    {!embedded ? <>
                        <h1 data-page-heading tabIndex={-1} className="flex items-center gap-2 text-2xl font-bold tracking-tight text-content-heading [overflow-wrap:anywhere] md:text-3xl">
                            <BarChart3 aria-hidden="true" className="size-7 shrink-0 text-sky-700" />
                            รายงาน IT
                        </h1>
                        <p className="max-w-[70ch] text-sm leading-6 text-content-secondary">
                            ภาพรวมงานค้างและผลการให้บริการ IT ตามช่วงเวลาที่เลือก
                        </p>
                    </> : null}
                    {reportState?.kind === "loaded" ? <ReportingWindow dashboard={reportState.data} /> : null}
                </div>
                <label className="flex w-full min-w-0 flex-col gap-1.5 text-sm font-medium text-content-secondary sm:w-48">
                    ช่วงเวลารายงาน
                    <Select value={period} onValueChange={handlePeriodChange}>
                        <SelectTrigger aria-label="เลือกช่วงเวลารายงาน" className="min-h-11 w-full">
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
                <ITAnalyticsReport dashboard={reportState.data} navigation={navigation} />
            )}
        </section>
    );
}
