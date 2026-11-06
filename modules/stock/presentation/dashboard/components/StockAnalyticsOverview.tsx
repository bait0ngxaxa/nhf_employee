"use client";

import { useState, type ReactElement, type FormEvent } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getBangkokYear } from "@/lib/helpers/bangkok-time";
import { useStockAnalytics } from "./useStockAnalytics";
import { StockPopularityChart, StockDistributionChart } from "./StockAnalyticsCharts";
import { StockAnalyticsDetails } from "./StockAnalyticsDetails";
import { StockReportsSkeleton } from "./StockSkeletons";

const selectClass = "h-11 w-full min-w-0 rounded-md border border-input bg-surface-raised px-3 text-sm text-content-strong focus-visible:outline-2 focus-visible:outline-ring";
const initialFilters = (): string => `year=${getBangkokYear(new Date())}&fromMonth=1&toMonth=12&metric=frequency`;

export function StockAnalyticsOverview({ onInventory }: { onInventory?: (sku: string) => void }): ReactElement {
    const [filters, setFilters] = useState(initialFilters);
    const [formVersion, setFormVersion] = useState(0);
    const [detail, setDetail] = useState<{ id: number; name?: string; page: number } | null>(null);
    const params = new URLSearchParams(filters);
    if (detail) { params.set("itemId", String(detail.id)); params.set("page", String(detail.page)); }
    const { data, error, isLoading, isValidating, mutate } = useStockAnalytics(params);

    function applyFilters(event: FormEvent<HTMLFormElement>): void {
        event.preventDefault();
        const next = new URLSearchParams();
        for (const [key, value] of new FormData(event.currentTarget)) if (typeof value === "string" && value.trim()) next.set(key, value.trim());
        setDetail(null);
        setFilters(next.toString());
    }
    function reset(): void { setDetail(null); setFilters(initialFilters()); setFormVersion((v) => v + 1); }
    function selectMaterial(id: number): void {
        setDetail({ id, name: data?.topMaterials.find((m) => m.id === id)?.name, page: 1 });
    }
    return <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold text-content-strong">ภาพรวมการใช้วัสดุ</h2><p className="mt-1 text-sm text-content-muted">วัสดุยอดนิยมจากการจ่ายจริง และสถานะคลังพร้อมดำเนินการ</p></div><Button variant="outline" disabled={isValidating} aria-busy={isValidating} onClick={() => void mutate()}><RefreshCw className="mr-2 size-4" aria-hidden="true" />รีเฟรชข้อมูล</Button></div>
        <form key={formVersion} onSubmit={applyFilters} className="rounded-2xl border border-border-subtle bg-surface-raised p-5" aria-label="ตัวกรองการจ่ายวัสดุย้อนหลัง">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <label className="space-y-2 text-sm text-content-secondary"><span>ปี ค.ศ. (ปฏิทินไทย)</span><Input name="year" type="number" min={2000} max={9998} defaultValue={getBangkokYear(new Date())} required className="h-11" /></label>
                <label className="space-y-2 text-sm text-content-secondary"><span>เดือนเริ่มต้น</span><select name="fromMonth" defaultValue="1" className={selectClass}>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select></label>
                <label className="space-y-2 text-sm text-content-secondary"><span>เดือนสิ้นสุด</span><select name="toMonth" defaultValue="12" className={selectClass}>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select></label>
                <label className="space-y-2 text-sm text-content-secondary"><span>หมวดวัสดุ</span><select name="categoryId" defaultValue="" className={selectClass}><option value="">ทุกหมวด</option>{data?.options.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
                <label className="space-y-2 text-sm text-content-secondary"><span>รหัสโครงการ (ตรงทั้งหมด)</span><Input name="projectCode" maxLength={100} placeholder="ทุกโครงการ" className="h-11" /></label>
            </div>
            <div className="mt-4 grid items-end gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <label className="space-y-2 text-sm text-content-secondary"><span>จัดอันดับตาม</span><select name="metric" defaultValue="frequency" className={selectClass}><option value="frequency">ความถี่คำขอที่จ่ายแล้ว</option><option value="quantity">ปริมาณที่จ่าย (เลือกหน่วย)</option></select></label>
                <label className="space-y-2 text-sm text-content-secondary"><span>หน่วยสำหรับอันดับปริมาณ</span><select name="unit" defaultValue="" className={selectClass}><option value="">เลือกหน่วย</option>{data?.options.units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select></label>
                <div className="flex flex-wrap gap-2"><Button type="submit" disabled={isValidating} className="bg-module-stock-solid text-content-on-brand hover:bg-module-stock-solid-hover">ใช้ตัวกรอง</Button><Button type="button" variant="outline" onClick={reset}>ล้างตัวกรอง</Button></div>
            </div>
            <p className="mt-4 text-xs leading-5 text-content-muted">ช่วงเวลาอ้างอิงวันที่จ่ายจริงตามเวลาไทย · หมวดและโครงการใช้กับสถิติย้อนหลังเท่านั้น · หน่วยใช้เฉพาะการจัดอันดับตามปริมาณ</p>
        </form>
        {error ? <div role="alert" className="rounded-2xl border border-status-danger-border bg-surface-raised p-5"><p className="font-semibold text-content-strong">โหลดภาพรวมไม่สำเร็จ</p><p className="mt-1 text-sm text-content-muted">{error.message}</p><Button className="mt-3" variant="outline" onClick={() => void mutate()}>ลองใหม่</Button></div> : isLoading || !data ? <StockReportsSkeleton /> : <>
            <p className="text-xs text-content-muted" aria-live="polite">อัปเดตล่าสุด {new Date(data.freshness.generatedAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })} · รายงานปี {data.filters.year} เดือน {data.filters.fromMonth}–{data.filters.toMonth}{data.filters.projectCode ? ` · โครงการ ${data.filters.projectCode}` : ""}</p>
            <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                    ["จำนวนคำขอที่จ่ายแล้ว", data.kpis.issuedRequests, "คำขอไม่ซ้ำที่จ่ายแล้วและมีรายการตรงตัวกรอง"],
                    ["จำนวนรายการที่จ่าย", data.kpis.issuedLines, "จำนวนบรรทัด StockRequestItem ไม่ใช่ปริมาณหรือจำนวนชนิด"],
                    ["คำขอรอจ่าย · ปัจจุบัน", data.kpis.pendingRequests, "ทุกคำขอสถานะรอจ่าย ไม่ใช้ตัวกรองย้อนหลัง"],
                    ["วัสดุที่ต้องเติม · ปัจจุบัน", data.kpis.attentionVariants, "variant ที่ใช้งานอยู่ของวัสดุที่ใช้งานและพร้อมใช้ ≤ จุดสั่งซื้อ หรือหมด"],
                ].map(([label, value, description]) => <div key={label} className="rounded-2xl border border-border-subtle bg-surface-raised p-4"><dt className="text-sm font-medium text-content-secondary">{label}</dt><dd className="mt-2 text-2xl font-bold tabular-nums text-content-strong">{Number(value).toLocaleString("th-TH")}</dd><dd className="mt-2 text-xs leading-5 text-content-muted">{description}</dd></div>)}
            </dl>
            <section className="min-w-0 rounded-2xl border border-border-subtle bg-surface-raised p-5"><h3 className="text-lg font-bold text-content-strong">10 อันดับวัสดุยอดนิยม</h3><p className="mt-1 text-sm leading-6 text-content-muted">{data.filters.metric === "frequency" ? "นับคำขอที่จ่ายแล้วไม่ซ้ำต่อวัสดุ หลาย variant ในคำขอเดียวกันนับครั้งเดียว" : `เปรียบเทียบปริมาณเฉพาะหน่วย ${data.filters.unit}`} · ค่าเท่ากันเรียงตามรหัสวัสดุจากน้อยไปมาก</p>{data.topMaterials.length ? <StockPopularityChart data={data} onSelect={selectMaterial} /> : <p className="py-12 text-center text-sm text-content-muted">ไม่มีข้อมูลการจ่ายในช่วงที่เลือก ลองเปลี่ยนปี เดือน หรือโครงการ</p>}</section>
            <div className="grid gap-5 lg:grid-cols-2">
                <StockDistributionChart title="สัดส่วนรายการที่จ่ายตามหมวด" description="นับบรรทัดรายการที่จ่ายแล้วตามตัวกรอง คำขอหนึ่งอาจอยู่หลายหมวด" rows={data.categories.map((c) => ({ name: c.name, value: c.lines }))} />
                <StockDistributionChart title="สุขภาพสต็อก · ปัจจุบัน" description="ทุก variant ที่ใช้งานของวัสดุที่ใช้งาน · พร้อมใช้ = ยอดจริงหักจอง (ขั้นต่ำ 0) · จุดสั่งซื้อ 0 ไม่แจ้งใกล้หมด แต่พร้อมใช้ 0 ถือว่าหมด" rows={[
                    { name: "ปกติ", value: data.stockHealth.healthy, color: "var(--status-success-solid)" },
                    { name: "ใกล้หมด (0 < พร้อมใช้ ≤ จุดสั่งซื้อ)", value: data.stockHealth.low, color: "var(--status-warning-solid)" },
                    { name: "หมดสต็อก (พร้อมใช้ = 0)", value: data.stockHealth.out, color: "var(--status-danger-solid)" },
                ]} />
            </div>
            <StockAnalyticsDetails data={data} onSelect={selectMaterial} onInventory={onInventory} detailName={detail?.name} onClose={() => setDetail(null)} onPage={(page) => setDetail((previous) => previous ? { ...previous, page } : null)} />
        </>}
    </div>;
}
