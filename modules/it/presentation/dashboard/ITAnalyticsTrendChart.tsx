"use client";

import { useId, useState, type ReactElement } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { ITAnalyticsDashboard, ITAnalyticsPeriod } from "../../contracts";
import { buildITTrendBuckets, formatITTrendDate, formatITTrendRange } from "./analytics-trend";

const chartConfig = {
    created: { label: "Ticket ใหม่", color: "var(--brand-foreground)" },
    resolved: { label: "แก้ไขแล้ว", color: "var(--chart-2)" },
} satisfies ChartConfig;

function countText(count: number): string {
    return count.toLocaleString("th-TH");
}

export function ITAnalyticsTrendChart({ trend, period }: {
    readonly trend: ITAnalyticsDashboard["trend"];
    readonly period: ITAnalyticsPeriod;
}): ReactElement {
    const descriptionId = useId();
    const [tooltipPortal, setTooltipPortal] = useState<HTMLDivElement | null>(null);
    const [tooltipTrigger, setTooltipTrigger] = useState<"hover" | "click">("hover");
    const buckets = buildITTrendBuckets(trend, period);
    const weekly = period === "90D";
    const createdTotal = trend.reduce((total, row) => total + row.created, 0);
    const resolvedTotal = trend.reduce((total, row) => total + row.resolved, 0);
    const chartData = buckets.map((bucket) => ({
        ...bucket,
        label: formatITTrendRange(bucket, true),
        fullLabel: formatITTrendRange(bucket),
    }));

    return (
        <figure className="min-w-0 rounded-xl border border-border-neutral bg-surface-raised p-4 sm:p-6">
            <figcaption className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-content-heading">Ticket ใหม่และแก้ไขแล้ว</h2>
                    <p className="mt-1 text-sm leading-6 text-content-secondary">
                        {weekly ? "เปรียบเทียบรายสัปดาห์ เริ่มวันจันทร์ เวลา Asia/Bangkok" : "เปรียบเทียบตามวันปฏิทินเวลา Asia/Bangkok"}
                    </p>
                </div>
                <ul aria-label="คำอธิบายกราฟ" className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                    <li className="inline-flex items-center gap-2 text-content-body">
                        <span aria-hidden="true" className="size-3 rounded-sm bg-brand-foreground" />
                        <span>Ticket ใหม่ <strong className="tabular-nums">{countText(createdTotal)}</strong></span>
                    </li>
                    <li className="inline-flex items-center gap-2 text-content-body">
                        <span aria-hidden="true" className="size-3 rounded-full bg-chart-2" />
                        <span>แก้ไขแล้ว <strong className="tabular-nums">{countText(resolvedTotal)}</strong></span>
                    </li>
                </ul>
            </figcaption>
            <p id={descriptionId} className="sr-only">
                กราฟแท่งเปรียบเทียบ{weekly ? "รายสัปดาห์ ตามวันที่ที่อยู่ในช่วงรายงาน" : "รายวัน"}
                {" "}Ticket ใหม่ {countText(createdTotal)} รายการ กับ Ticket ที่แก้ไขแล้ว {countText(resolvedTotal)} รายการ
                ใช้ปุ่มลูกศรซ้ายและขวาเพื่อดูแต่ละช่วง รายละเอียดตัวเลขทุกวันอยู่ในหัวข้อ ดูตัวเลขรายวัน
            </p>
            {createdTotal === 0 && resolvedTotal === 0 ? (
                <p role="status" className="mt-5 rounded-lg bg-surface-subtle px-3 py-2 text-sm text-content-secondary">
                    ยังไม่มีข้อมูลในช่วงเวลานี้
                </p>
            ) : null}
            {buckets.length > 0 ? <div>
                <div
                    role="region"
                    aria-label="กราฟ Ticket ใหม่และแก้ไขแล้ว เลื่อนแนวนอนเพื่อดูข้อมูลทั้งหมด"
                    aria-describedby={descriptionId}
                    tabIndex={0}
                    onPointerDownCapture={(event) => {
                        if (event.pointerType !== "mouse") setTooltipTrigger("click");
                    }}
                    onPointerMoveCapture={(event) => {
                        if (event.pointerType === "mouse") setTooltipTrigger("hover");
                    }}
                    className="mt-3 min-w-0 overflow-x-auto overscroll-x-contain focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <ChartContainer
                        config={chartConfig}
                        className="h-80 w-full aspect-auto [&_.recharts-cartesian-axis-tick_text]:fill-content-secondary [&_.recharts-surface:focus-visible]:outline-2 [&_.recharts-surface:focus-visible]:outline-ring"
                        style={{ minWidth: `${Math.max(20, buckets.length * (weekly ? 3 : 2.5))}rem` }}
                    >
                        <BarChart accessibilityLayer data={chartData} margin={{ top: 16, right: 16, bottom: 8 }}
                            aria-label={`แนวโน้ม Ticket ใหม่และแก้ไขแล้ว${weekly ? "รายสัปดาห์" : "รายวัน"}`}
                            aria-describedby={descriptionId}
                        >
                            <CartesianGrid vertical={false} />
                            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10}
                                minTickGap={weekly ? 20 : 16} interval="preserveStartEnd" />
                            <YAxis allowDecimals={false} domain={[0, "auto"]} width="auto" tickCount={5}
                                tickLine={false} axisLine={false} tickFormatter={countText} />
                            <ChartTooltip
                                isAnimationActive={false}
                                trigger={tooltipTrigger}
                                portal={tooltipPortal}
                                content={<ChartTooltipContent
                                    role="tooltip"
                                    className="w-full border-0 bg-transparent px-0 py-2 text-content-body shadow-none"
                                    labelFormatter={(label) => chartData.find((row) => row.label === label)?.fullLabel ?? label}
                                    formatter={(value, name) => <>
                                        <span className="flex-1">{name === "created" ? chartConfig.created.label : chartConfig.resolved.label}</span>
                                        <span className="font-medium tabular-nums">{typeof value === "number" ? countText(value) : String(value)}</span>
                                    </>}
                                />}
                            />
                            <Bar dataKey="created" fill="var(--color-created)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
                            <Bar dataKey="resolved" fill="var(--color-resolved)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
                        </BarChart>
                    </ChartContainer>
                </div>
                <p className="mt-2 text-xs leading-5 text-content-muted">
                    เลื่อนกราฟไปด้านข้างเพื่อดูข้อมูล แตะกราฟหรือใช้ปุ่มลูกศรเพื่อดูตัวเลข
                </p>
                <section aria-label="ตัวเลขช่วงที่เลือก" className="mt-3 rounded-lg bg-surface-subtle px-3 py-2">
                    <h3 className="text-sm font-medium text-content-heading">ตัวเลขช่วงที่เลือก</h3>
                    <p className="text-xs leading-5 text-content-secondary">ชี้หรือแตะแท่งกราฟ หรือใช้ปุ่มลูกศรเพื่อเลือกช่วง</p>
                    {/* The portal uses normal document flow, outside the scrollable plot. */}
                    <div ref={setTooltipPortal} aria-live="polite" aria-atomic="true" className="min-h-20" />
                </section>
            </div> : null}
            <details className="mt-2 border-t border-border-neutral">
                <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-sky-800 underline underline-offset-4 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-sky-300">
                    ดูตัวเลขรายวัน
                </summary>
                <ol className="grid gap-2 pb-2 sm:grid-cols-2 xl:grid-cols-3">
                    {trend.map((row) => (
                        <li key={row.date} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-subtle px-3 py-2 text-xs sm:text-sm">
                            <time dateTime={row.date} className="font-medium tabular-nums text-content-body">
                                {formatITTrendDate(row.date)}
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
