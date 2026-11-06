"use client";

import type { ReactElement } from "react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { StockAnalyticsResponse } from "../../../domain/analytics";

const tooltipStyle = { background: "var(--surface-raised)", borderColor: "var(--border-subtle)", color: "var(--content-strong)", borderRadius: "var(--radius-lg)", maxWidth: "min(80vw, 320px)", whiteSpace: "normal" };
const categoryColors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

export function StockPopularityChart({ data, onSelect }: { data: StockAnalyticsResponse; onSelect: (id: number) => void }): ReactElement {
    const rows = data.topMaterials.map((m, index) => ({ ...m, rank: `${index + 1}. ${m.name.length > 16 ? `${m.name.slice(0, 16)}…` : m.name}`, value: data.filters.metric === "frequency" ? m.requestCount : m.quantities.find((q) => q.unit === data.filters.unit)?.quantity ?? 0 }));
    return <>
        <div className="h-96 w-full min-w-0" aria-label="กราฟแท่งวัสดุยอดนิยม เรียงจากมากไปน้อย">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart layout="vertical" data={rows} margin={{ left: 0, right: 24, top: 8, bottom: 8 }} accessibilityLayer>
                    <XAxis type="number" allowDecimals={false} tick={{ fill: "var(--content-muted)", fontSize: 12 }} />
                    <YAxis dataKey="rank" type="category" width={135} tick={{ fill: "var(--content-strong)", fontSize: 12 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipStyle} labelFormatter={(_label, payload) => payload[0]?.payload?.name ?? ""} formatter={(value) => [value, data.filters.metric === "frequency" ? "คำขอที่จ่ายแล้ว" : `ปริมาณ (${data.filters.unit})`]} />
                    <Bar dataKey="value" fill="var(--module-stock-solid)" isAnimationActive={false} radius={[0, 4, 4, 0]} onClick={(row) => { if (typeof row.id === "number") onSelect(row.id); }} />
                </BarChart>
            </ResponsiveContainer>
        </div>
        <ol className="grid gap-x-6 divide-y divide-border-subtle text-sm md:grid-cols-2" aria-label="อันดับวัสดุและรายละเอียด">
            {rows.map((row, index) => <li key={row.id} className="flex min-w-0 items-start gap-3 py-2">
                <span className="pt-3 tabular-nums text-content-muted">{index + 1}</span>
                <button type="button" className="min-h-11 min-w-0 flex-1 rounded-md py-2 text-left text-content-strong underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring" onClick={() => onSelect(row.id)}>
                    <span className="block break-words font-medium">{row.name}</span><span className="text-xs text-content-muted">{row.value.toLocaleString("th-TH")} {data.filters.metric === "frequency" ? "คำขอ" : data.filters.unit} · ดูรายการย่อย</span>
                </button>
            </li>)}
        </ol>
    </>;
}

export function StockDistributionChart({ title, description, rows }: { title: string; description: string; rows: { name: string; value: number; color?: string }[] }): ReactElement {
    const total = rows.reduce((sum, row) => sum + row.value, 0);
    return <section className="min-w-0 rounded-2xl border border-border-subtle bg-surface-raised p-5">
        <h3 className="text-lg font-bold text-content-strong">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-content-muted">{description}</p>
        {total === 0 ? <p className="py-12 text-center text-sm text-content-muted">ไม่มีข้อมูลสำหรับแสดงสัดส่วน</p> : <div className="h-56" aria-label={`${title}: ${total.toLocaleString("th-TH")} รายการ`}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0}><PieChart accessibilityLayer>
                <Pie data={rows} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" isAnimationActive={false}>
                    {rows.map((row, index) => <Cell key={row.name} fill={row.color ?? categoryColors[index % categoryColors.length]} stroke="var(--surface-raised)" />)}
                </Pie><Tooltip contentStyle={tooltipStyle} />
            </PieChart></ResponsiveContainer>
        </div>}
        <ul className="space-y-2 text-sm" aria-label={`${title} ค่าข้อมูล`}>
            {rows.map((row, index) => <li key={row.name} className="flex items-start gap-2">
                <span className="mt-1 size-3 shrink-0 rounded-sm" style={{ background: row.color ?? categoryColors[index % categoryColors.length] }} aria-hidden="true" />
                <span className="min-w-0 flex-1 break-words text-content-secondary">{row.name}</span>
                <span className="shrink-0 tabular-nums text-content-strong">{row.value.toLocaleString("th-TH")} · {total ? (row.value / total * 100).toFixed(1) : "0.0"}%</span>
            </li>)}
        </ul>
    </section>;
}
