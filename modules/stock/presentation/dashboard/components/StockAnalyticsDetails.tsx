"use client";

import type { ReactElement } from "react";
import { Button } from "@/components/ui/button";
import type { StockAnalyticsResponse, UnitQuantity } from "../../../domain/analytics";

const statusLabels = { healthy: "ปกติ", low: "ใกล้หมด", out: "หมดสต็อก" };
const th = "px-3 py-3 text-left font-medium text-content-muted";
const td = "px-3 py-3 align-top text-content-strong";

function quantities(values: UnitQuantity[]): string {
    return values.map((q) => `${q.quantity.toLocaleString("th-TH")} ${q.unit}`).join(" / ") || "ไม่มีรายการที่ใช้งาน";
}

export function StockAnalyticsDetails({ data, onSelect, onInventory, detailName, onClose, onPage }: { data: StockAnalyticsResponse; onSelect: (id: number) => void; onInventory?: (sku: string) => void; detailName?: string; onClose: () => void; onPage: (page: number) => void }): ReactElement {
    return <div className="space-y-5">
        {data.detail ? <section className="rounded-2xl border border-module-stock-badge-border bg-surface-raised p-5" aria-label="รายละเอียดวัสดุ">
            <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-bold text-content-strong">รายการย่อย: {detailName ?? "วัสดุที่เลือก"}</h3><Button variant="outline" onClick={onClose}>ปิดรายละเอียด</Button></div>
            <p className="mt-2 text-sm text-content-muted">จำนวนคำขอและปริมาณแยกตาม variant ในช่วงที่เลือก รวม variant ที่ปิดใช้งานแล้ว</p>
            <div className="mt-3 overflow-x-auto"><table className="w-full text-sm"><caption className="sr-only">การใช้รายการย่อย หน้า {data.detail.page}</caption><thead><tr><th className={th}>SKU / คุณลักษณะ</th><th className={th}>คำขอ</th><th className={th}>ปริมาณที่จ่าย</th></tr></thead><tbody>
                {data.detail.rows.map((r) => <tr key={r.variantId ?? "legacy"} className="border-t border-border-subtle"><td className={td}>{r.sku}<span className="block text-content-muted">{r.attributes || "รายการมาตรฐาน"}</span></td><td className={td}>{r.requests}</td><td className={td}>{r.quantity} {r.unit}</td></tr>)}
            </tbody></table></div>
            {!data.detail.rows.length ? <p className="py-4 text-sm text-content-muted">ไม่พบรายการย่อยในช่วงที่เลือก</p> : null}
            <div className="mt-3 flex items-center justify-end gap-3"><Button variant="outline" disabled={data.detail.page <= 1} onClick={() => onPage((data.detail?.page ?? 1) - 1)}>ก่อนหน้า</Button><span className="text-sm text-content-muted">หน้า {data.detail.page}</span><Button variant="outline" disabled={!data.detail.hasMore} onClick={() => onPage((data.detail?.page ?? 1) + 1)}>ถัดไป</Button></div>
        </section> : null}
        <section className="rounded-2xl border border-border-subtle bg-surface-raised p-5">
            <h3 className="text-lg font-bold text-content-strong">5 อันดับวัสดุ · รายละเอียดปฏิบัติการ</h3>
            <p className="mt-1 text-sm text-content-muted">อันดับตามกราฟ · พร้อมใช้และสถานะเป็นข้อมูลปัจจุบัน แยกปริมาณตามหน่วยเสมอ</p>
            <div className="mt-3 overflow-x-auto"><table className="w-full min-w-2xl text-sm"><caption className="sr-only">วัสดุ 5 อันดับแรกและสถานะคลังปัจจุบัน</caption><thead><tr>{["อันดับ", "วัสดุ / SKU", "หมวด", "คำขอที่จ่าย", "ปริมาณที่จ่าย", "พร้อมใช้ปัจจุบัน", "สถานะ variant"].map((s) => <th key={s} className={th}>{s}</th>)}</tr></thead><tbody>
                {data.topMaterials.slice(0, 5).map((m, index) => <tr key={m.id} className="border-t border-border-subtle"><td className={td}>{index + 1}</td><td className={td}><button className="min-h-11 text-left font-medium underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring" onClick={() => onSelect(m.id)}>{m.name}</button><span className="block text-xs text-content-muted">{m.sku}</span></td><td className={td}>{m.category}</td><td className={`${td} tabular-nums`}>{m.requestCount}</td><td className={td}>{quantities(m.quantities)}</td><td className={td}>{quantities(m.available)}</td><td className={td}>{Object.entries(m.health).filter(([, count]) => count > 0).map(([status, count]) => `${statusLabels[status as keyof typeof statusLabels]} ${count}`).join(" / ") || "ไม่มี variant ที่ใช้งาน"}</td></tr>)}
            </tbody></table></div>
            {!data.topMaterials.length ? <p className="py-5 text-sm text-content-muted">ไม่มีการจ่ายวัสดุในช่วงที่เลือก ลองปรับตัวกรอง</p> : null}
        </section>
        <section className="rounded-2xl border border-border-subtle bg-surface-raised p-5">
            <h3 className="text-lg font-bold text-content-strong">วัสดุที่ต้องเติมสต็อก</h3><p className="mt-1 text-sm text-content-muted">ข้อมูลปัจจุบันทุกหมวด · แสดง {data.lowStock.length} จาก {data.lowStockTotal} variants เรียงหมดสต็อกก่อน แล้วตามรหัส variant</p>
            {!data.lowStock.length ? <p className="py-6 text-sm text-status-success-foreground">ไม่มี variant ที่ต้องเติมสต็อก</p> : <ul className="mt-3 divide-y divide-border-subtle">
                {data.lowStock.map((v) => <li key={v.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="break-words font-medium text-content-strong">{v.name}</p><p className="text-sm text-content-muted">{v.sku} · {v.attributes || "รายการมาตรฐาน"}</p><p className="mt-1 text-sm text-content-secondary">พร้อมใช้ {v.available} {v.unit} · จุดสั่งซื้อ {v.minimum} {v.unit}</p></div><div className="flex shrink-0 flex-wrap items-center gap-3"><span className={v.status === "out" ? "text-sm font-semibold text-status-danger-foreground" : "text-sm font-semibold text-status-warning-foreground"}>{statusLabels[v.status]}</span>{onInventory ? <Button variant="outline" onClick={() => onInventory(v.sku)}>จัดการสต็อก</Button> : null}</div></li>)}
            </ul>}
        </section>
    </div>;
}
