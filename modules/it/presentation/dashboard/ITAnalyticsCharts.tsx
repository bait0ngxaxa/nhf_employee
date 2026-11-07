"use client";

import { useId, useState, type PointerEvent, type ReactElement, type ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

import {
    IT_ANALYTICS_UNASSIGNED_LABEL,
    type ITAnalyticsCategoryFilter,
    type ITAnalyticsDashboard,
} from "../../contracts";
import type { ITTicketPriority } from "@prisma/client";
import {
    buildITAnalyticsAgingRows,
    buildITAnalyticsPrioritySlices,
    buildITAnalyticsWorkloadRows,
    formatITAnalyticsCount,
    formatITAnalyticsShare,
    truncateITAnalyticsLabel,
} from "./analytics-view";

export type ITAnalyticsScope = "period" | "snapshot";

const SCOPE_LABELS: Readonly<Record<ITAnalyticsScope, string>> = {
    period: "ตามช่วงรายงาน",
    snapshot: "ข้อมูล ณ ปัจจุบัน",
};

const LINK_CLASS_NAME = "inline-flex min-h-11 items-center gap-1 rounded-md text-sm font-medium text-brand-strong underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-sky-300";

export function ITAnalyticsScopeBadge({ scope }: { readonly scope: ITAnalyticsScope }): ReactElement {
    return (
        <span className={"inline-flex min-h-6 shrink-0 items-center rounded-full border px-2.5 text-xs font-medium "
            + (scope === "snapshot"
                ? "border-brand-border-strong/40 bg-brand-surface text-brand-strong"
                : "border-border-neutral bg-surface-subtle text-content-secondary")}
        >
            {SCOPE_LABELS[scope]}
        </span>
    );
}

export function ITAnalyticsPanel({
    title,
    description,
    scope,
    action,
    className = "",
    children,
}: {
    readonly title: string;
    readonly description?: ReactNode;
    readonly scope: ITAnalyticsScope;
    readonly action?: ReactNode;
    readonly className?: string;
    readonly children: ReactNode;
}): ReactElement {
    const headingId = useId();
    return (
        <section
            aria-labelledby={headingId}
            className={"flex min-w-0 flex-col rounded-xl border border-border-neutral bg-surface-raised p-4 sm:p-6 " + className}
        >
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <div className="min-w-0 flex-1 basis-60">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
                        <h2 id={headingId} className="text-lg font-semibold text-content-heading [text-wrap:balance]">
                            {title}
                        </h2>
                        <ITAnalyticsScopeBadge scope={scope} />
                    </div>
                    {description ? (
                        <p className="mt-1 max-w-[70ch] text-sm leading-6 text-content-secondary">{description}</p>
                    ) : null}
                </div>
                {action ?? null}
            </div>
            <div className="mt-4 min-w-0 flex-1">{children}</div>
        </section>
    );
}

export function ITAnalyticsEmptyState({ children }: { readonly children: ReactNode }): ReactElement {
    return (
        <p role="status" className="rounded-lg bg-surface-subtle px-4 py-6 text-center text-sm leading-6 text-content-secondary">
            {children}
        </p>
    );
}

/** Touch taps pin the tooltip; mouse movement restores hover behavior. */
function useTouchFriendlyTooltip(): {
    readonly trigger: "hover" | "click";
    readonly onPointerDownCapture: (event: PointerEvent<HTMLDivElement>) => void;
    readonly onPointerMoveCapture: (event: PointerEvent<HTMLDivElement>) => void;
} {
    const [trigger, setTrigger] = useState<"hover" | "click">("hover");
    return {
        trigger,
        onPointerDownCapture: (event) => {
            if (event.pointerType !== "mouse") setTrigger("click");
        },
        onPointerMoveCapture: (event) => {
            if (event.pointerType === "mouse") setTrigger("hover");
        },
    };
}

const TOOLTIP_CLASS_NAME = "max-w-[min(80vw,20rem)] whitespace-normal";
const AXIS_CLASS_NAME = "[&_.recharts-cartesian-axis-tick_text]:fill-content-secondary";

const categoryChartConfig = {
    count: { label: "Ticket ที่สร้าง", color: "var(--module-it-solid)" },
} satisfies ChartConfig;

export function ITAnalyticsTopCategoriesPanel({
    topCategories,
    selectedCategory,
    getCategoryHref,
}: {
    readonly topCategories: ITAnalyticsDashboard["topCategories"];
    readonly selectedCategory: ITAnalyticsCategoryFilter | null;
    /** Present only when the viewer may also open the operator queue. */
    readonly getCategoryHref?: (categoryId: number | null) => string;
}): ReactElement {
    const descriptionId = useId();
    const tooltip = useTouchFriendlyTooltip();
    const rows = topCategories.rows;
    const total = rows.reduce((sum, row) => sum + row.count, 0) + topCategories.otherTicketCount;
    const maximum = Math.max(0, ...rows.map((row) => row.count));
    const chartData = rows.map((row, index) => ({
        key: row.categoryId === null ? "uncategorized" : String(row.categoryId),
        axisLabel: `${index + 1}. ${truncateITAnalyticsLabel(row.label, 12)}`,
        label: row.label,
        count: row.count,
    }));
    const description = selectedCategory === null
        ? `Ticket ที่สร้างในช่วงรายงาน จัดกลุ่มตามหมวดหมู่ปัจจุบันของแต่ละ Ticket แสดงสูงสุด ${formatITAnalyticsCount(topCategories.limit)} อันดับ`
        : "แสดงเฉพาะหมวดหมู่ที่เลือกในตัวกรอง จัดกลุ่มตามหมวดหมู่ปัจจุบันของแต่ละ Ticket";

    return (
        <ITAnalyticsPanel title="หมวดปัญหาที่มีการแจ้งมากที่สุด" scope="period" description={description}>
            {rows.length === 0 ? (
                <ITAnalyticsEmptyState>
                    ยังไม่มี Ticket ที่สร้างในช่วงเวลานี้ตามตัวกรองที่เลือก ลองเลือกช่วงเวลาที่ยาวขึ้นหรือล้างตัวกรอง
                </ITAnalyticsEmptyState>
            ) : (
                <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                    <div
                        role="region"
                        aria-label="กราฟแท่งหมวดปัญหา เรียงจากมากไปน้อย"
                        aria-describedby={descriptionId}
                        tabIndex={0}
                        onPointerDownCapture={tooltip.onPointerDownCapture}
                        onPointerMoveCapture={tooltip.onPointerMoveCapture}
                        className="hidden min-w-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:block"
                    >
                        <p id={descriptionId} className="sr-only">
                            {rows.map((row, index) => `อันดับ ${index + 1} ${row.label} ${formatITAnalyticsCount(row.count)} Ticket`).join(", ")}
                        </p>
                        <ChartContainer
                            config={categoryChartConfig}
                            className={"aspect-auto w-full " + AXIS_CLASS_NAME}
                            style={{ height: `${Math.max(9, rows.length * 2.75 + 2)}rem` }}
                        >
                            <BarChart
                                accessibilityLayer
                                layout="vertical"
                                data={chartData}
                                margin={{ top: 4, right: 40, bottom: 4, left: 0 }}
                                barCategoryGap="22%"
                            >
                                <CartesianGrid horizontal={false} />
                                <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false}
                                    tickFormatter={formatITAnalyticsCount} />
                                <YAxis type="category" dataKey="axisLabel" width={164} tickLine={false} axisLine={false}
                                    tick={{ fontSize: 12 }} interval={0} />
                                <ChartTooltip
                                    isAnimationActive={false}
                                    trigger={tooltip.trigger}
                                    cursor={{ fill: "var(--surface-subtle)" }}
                                    content={<ChartTooltipContent
                                        className={TOOLTIP_CLASS_NAME}
                                        hideIndicator
                                        labelFormatter={(_label, payload) => {
                                            const item: unknown = payload[0]?.payload;
                                            return typeof item === "object" && item !== null && "label" in item
                                                ? String(item.label)
                                                : "";
                                        }}
                                        formatter={(value) => {
                                            const count = typeof value === "number" ? value : 0;
                                            return (
                                                <span className="tabular-nums">
                                                    {formatITAnalyticsCount(count)} Ticket · {formatITAnalyticsShare(count, total)} ของ Ticket ใหม่
                                                </span>
                                            );
                                        }}
                                    />}
                                />
                                <Bar dataKey="count" fill="var(--color-count)" radius={[0, 4, 4, 0]} maxBarSize={28}
                                    isAnimationActive={false}>
                                    <LabelList dataKey="count" position="right" className="fill-content-heading text-xs tabular-nums"
                                        formatter={(value: unknown) => typeof value === "number" ? formatITAnalyticsCount(value) : ""} />
                                </Bar>
                            </BarChart>
                        </ChartContainer>
                    </div>
                    <div className="min-w-0">
                        <ol aria-label="อันดับหมวดปัญหาและจำนวน Ticket" className="divide-y divide-border-neutral">
                            {rows.map((row, index) => (
                                <li key={row.categoryId ?? "uncategorized"} className="flex min-w-0 items-start gap-3 py-2.5">
                                    <span className="w-6 shrink-0 pt-0.5 text-right text-sm tabular-nums text-content-muted">{index + 1}</span>
                                    <div className="min-w-0 flex-1">
                                        <p className="break-words text-sm font-medium leading-6 text-content-heading">{row.label}</p>
                                        <p className="text-xs leading-5 text-content-secondary">
                                            <span className="tabular-nums">{formatITAnalyticsCount(row.count)}</span> Ticket
                                            {" · "}
                                            <span className="tabular-nums">{formatITAnalyticsShare(row.count, total)}</span>
                                        </p>
                                        {/* Below `sm` the list is the bar chart; wider screens use the chart beside it. */}
                                        <div aria-hidden="true" className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-subtle sm:hidden">
                                            <div className="h-full rounded-full bg-module-it-solid" style={{ width: `${maximum === 0 ? 0 : (row.count / maximum) * 100}%` }} />
                                        </div>
                                        {getCategoryHref ? (
                                            <Link href={getCategoryHref(row.categoryId)} className={LINK_CLASS_NAME + " min-h-9 text-xs"}>
                                                ดูงานค้างของหมวดนี้ในคิวงาน
                                                <ArrowUpRight aria-hidden="true" className="size-3.5" />
                                            </Link>
                                        ) : null}
                                    </div>
                                </li>
                            ))}
                        </ol>
                        {topCategories.otherCategoryCount > 0 ? (
                            <p className="mt-2 border-t border-border-neutral pt-3 text-xs leading-5 text-content-secondary">
                                หมวดอื่นอีก <span className="tabular-nums">{formatITAnalyticsCount(topCategories.otherCategoryCount)}</span> หมวด
                                รวม <span className="tabular-nums">{formatITAnalyticsCount(topCategories.otherTicketCount)}</span> Ticket
                            </p>
                        ) : null}
                    </div>
                </div>
            )}
            <p className="mt-4 text-xs leading-5 text-content-muted">
                ใช้หมวดหมู่ปัจจุบันของ Ticket หากมีการเปลี่ยนหมวดหมู่ภายหลัง Ticket จะย้ายไปนับในหมวดใหม่
            </p>
        </ITAnalyticsPanel>
    );
}

export function ITAnalyticsPriorityBacklogPanel({
    rows,
    getPriorityHref,
}: {
    readonly rows: ITAnalyticsDashboard["priorityBacklog"];
    readonly getPriorityHref?: (priority: ITTicketPriority) => string;
}): ReactElement {
    const { total, slices } = buildITAnalyticsPrioritySlices(rows);
    const tooltip = useTouchFriendlyTooltip();
    const chartConfig = Object.fromEntries(slices.map((slice) => [
        slice.priority,
        { label: slice.label, color: slice.color },
    ])) satisfies ChartConfig;

    return (
        <ITAnalyticsPanel
            title="งานค้างตาม Priority"
            scope="snapshot"
            description="งานที่ยังไม่แก้ไข แยกตาม Priority ปัจจุบัน ไม่รวม Ticket ที่แก้ไขแล้ว ปิดงาน หรือยกเลิก"
        >
            {total === 0 ? (
                <ITAnalyticsEmptyState>ไม่มีงานค้างในขณะนี้</ITAnalyticsEmptyState>
            ) : (
                <div className="flex min-w-0 flex-col items-center gap-5 sm:flex-row sm:items-center">
                    <div
                        className="relative size-44 shrink-0"
                        onPointerDownCapture={tooltip.onPointerDownCapture}
                        onPointerMoveCapture={tooltip.onPointerMoveCapture}
                    >
                        <ChartContainer config={chartConfig} className="aspect-square size-44">
                            <PieChart accessibilityLayer aria-label={`งานค้าง ${formatITAnalyticsCount(total)} รายการ แยกตาม Priority`}>
                                <ChartTooltip
                                    isAnimationActive={false}
                                    trigger={tooltip.trigger}
                                    content={<ChartTooltipContent
                                        className={TOOLTIP_CLASS_NAME}
                                        nameKey="priority"
                                        formatter={(value, _name, item) => {
                                            const count = typeof value === "number" ? value : 0;
                                            const payload: unknown = item.payload;
                                            const label = typeof payload === "object" && payload !== null && "label" in payload
                                                ? String(payload.label)
                                                : "";
                                            return (
                                                <span className="flex w-full justify-between gap-3">
                                                    <span>{label}</span>
                                                    <span className="tabular-nums">{formatITAnalyticsCount(count)} · {formatITAnalyticsShare(count, total)}</span>
                                                </span>
                                            );
                                        }}
                                    />}
                                />
                                <Pie
                                    data={slices.filter((slice) => slice.count > 0)}
                                    dataKey="count"
                                    nameKey="priority"
                                    innerRadius="62%"
                                    outerRadius="96%"
                                    paddingAngle={slices.filter((slice) => slice.count > 0).length > 1 ? 2 : 0}
                                    stroke="var(--surface-raised)"
                                    isAnimationActive={false}
                                >
                                    {slices.filter((slice) => slice.count > 0).map((slice) => (
                                        <Cell key={slice.priority} fill={slice.color} />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ChartContainer>
                        <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-2xl font-bold tabular-nums text-content-heading">{formatITAnalyticsCount(total)}</span>
                            <span className="text-xs text-content-secondary">งานค้าง</span>
                        </div>
                    </div>
                    <ul aria-label="งานค้างแยกตาม Priority" className="w-full min-w-0 divide-y divide-border-neutral">
                        {slices.map((slice) => (
                            <li key={slice.priority} className="flex min-h-11 min-w-0 items-center gap-3 py-1.5">
                                <span aria-hidden="true" className="size-3 shrink-0 rounded-sm" style={{ background: slice.color }} />
                                {getPriorityHref && slice.count > 0 ? (
                                    <Link href={getPriorityHref(slice.priority)} className={LINK_CLASS_NAME + " min-w-0 flex-1 font-normal text-content-body"}>
                                        {slice.label}
                                    </Link>
                                ) : (
                                    <span className="min-w-0 flex-1 text-sm text-content-body">{slice.label}</span>
                                )}
                                <span className="shrink-0 text-sm tabular-nums text-content-heading">
                                    <strong className="font-semibold">{formatITAnalyticsCount(slice.count)}</strong>
                                    <span className="ml-2 inline-block w-14 text-right text-content-secondary">{slice.share}</span>
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </ITAnalyticsPanel>
    );
}

const agingChartConfig = {
    count: { label: "งานค้าง", color: "var(--brand-foreground)" },
} satisfies ChartConfig;

export function ITAnalyticsBacklogAgingPanel({
    rows,
}: {
    readonly rows: ITAnalyticsDashboard["backlogAging"];
}): ReactElement {
    const descriptionId = useId();
    const tooltip = useTouchFriendlyTooltip();
    const agingRows = buildITAnalyticsAgingRows(rows);
    const total = agingRows.reduce((sum, row) => sum + row.count, 0);

    return (
        <ITAnalyticsPanel
            title="อายุงานค้าง"
            scope="snapshot"
            description="นับวันเต็มตั้งแต่สร้าง Ticket จนถึงเวลาที่อัปเดตรายงาน ใช้เพื่อประกอบการติดตามงาน ไม่ใช่การวัด SLA"
        >
            {total === 0 ? (
                <ITAnalyticsEmptyState>ไม่มีงานค้างในขณะนี้</ITAnalyticsEmptyState>
            ) : (
                <>
                    <div
                        role="region"
                        aria-label="กราฟอายุงานค้าง"
                        aria-describedby={descriptionId}
                        tabIndex={0}
                        onPointerDownCapture={tooltip.onPointerDownCapture}
                        onPointerMoveCapture={tooltip.onPointerMoveCapture}
                        className="min-w-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        <p id={descriptionId} className="sr-only">
                            {agingRows.map((row) => `${row.label} ${formatITAnalyticsCount(row.count)} รายการ`).join(", ")}
                        </p>
                        <ChartContainer config={agingChartConfig} className={"aspect-auto h-52 w-full " + AXIS_CLASS_NAME}>
                            <BarChart accessibilityLayer data={agingRows} margin={{ top: 20, right: 8, bottom: 0, left: 0 }}>
                                <CartesianGrid vertical={false} />
                                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval={0}
                                    tick={{ fontSize: 12 }} />
                                <YAxis allowDecimals={false} width="auto" tickLine={false} axisLine={false}
                                    tickFormatter={formatITAnalyticsCount} />
                                <ChartTooltip
                                    isAnimationActive={false}
                                    trigger={tooltip.trigger}
                                    cursor={{ fill: "var(--surface-subtle)" }}
                                    content={<ChartTooltipContent
                                        className={TOOLTIP_CLASS_NAME}
                                        hideIndicator
                                        formatter={(value) => {
                                            const count = typeof value === "number" ? value : 0;
                                            return (
                                                <span className="tabular-nums">
                                                    {formatITAnalyticsCount(count)} รายการ · {formatITAnalyticsShare(count, total)} ของงานค้าง
                                                </span>
                                            );
                                        }}
                                    />}
                                />
                                <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} maxBarSize={48}
                                    isAnimationActive={false}>
                                    <LabelList dataKey="count" position="top" className="fill-content-heading text-xs tabular-nums"
                                        formatter={(value: unknown) => typeof value === "number" ? formatITAnalyticsCount(value) : ""} />
                                </Bar>
                            </BarChart>
                        </ChartContainer>
                    </div>
                </>
            )}
        </ITAnalyticsPanel>
    );
}

export function ITAnalyticsWorkloadPanel({
    rows,
    unassignedHref,
}: {
    readonly rows: ITAnalyticsDashboard["assigneeBacklog"];
    readonly unassignedHref?: string;
}): ReactElement {
    const workload = buildITAnalyticsWorkloadRows(rows);
    const maximum = Math.max(0, ...rows.map((row) => row.count));

    return (
        <ITAnalyticsPanel
            title="งานค้างตามผู้รับผิดชอบ"
            scope="snapshot"
            description="จำนวนงานที่ยังไม่แก้ไขของแต่ละคน ใช้เพื่อกระจายงาน ไม่ใช่ตัวชี้วัดผลการทำงาน"
        >
            {rows.length === 0 ? (
                <ITAnalyticsEmptyState>ไม่มีงานค้างในขณะนี้</ITAnalyticsEmptyState>
            ) : (
                <>
                    <ul aria-label="งานค้างแยกตามผู้รับผิดชอบ" className="space-y-3.5">
                        {workload.rows.map((row) => {
                            const unassigned = row.label === IT_ANALYTICS_UNASSIGNED_LABEL;
                            const width = maximum === 0 ? 0 : (row.count / maximum) * 100;
                            return (
                                <li key={row.label} className="min-w-0">
                                    <div className="flex min-w-0 items-start justify-between gap-3">
                                        {unassigned && unassignedHref ? (
                                            <Link href={unassignedHref} className={LINK_CLASS_NAME + " min-h-0 min-w-0 break-words"}>
                                                {row.label}
                                            </Link>
                                        ) : (
                                            <span className={"min-w-0 break-words text-sm leading-6 " + (unassigned ? "font-medium text-status-warning-strong" : "text-content-body")}>
                                                {row.label}
                                            </span>
                                        )}
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
                                        <div
                                            aria-hidden="true"
                                            className={"h-full rounded-full " + (unassigned ? "bg-status-warning-solid" : "bg-module-it-solid")}
                                            style={{ width: `${width}%` }}
                                        />
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                    {workload.otherPeople > 0 ? (
                        <p className="mt-4 border-t border-border-neutral pt-3 text-xs leading-5 text-content-secondary">
                            ผู้รับผิดชอบอื่นอีก <span className="tabular-nums">{formatITAnalyticsCount(workload.otherPeople)}</span> คน
                            รวม <span className="tabular-nums">{formatITAnalyticsCount(workload.otherTickets)}</span> รายการ
                        </p>
                    ) : null}
                </>
            )}
        </ITAnalyticsPanel>
    );
}
