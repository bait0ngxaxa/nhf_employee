"use client";

import { useRef, useState, type FormEvent, type ReactElement } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { downloadXlsx } from "@/lib/client/xlsx-download";
import { getBangkokYear } from "@/lib/helpers/bangkok-time";
import { StockLegacyReports } from "./StockLegacyReports";
import useSWR from "swr";
import { apiGet } from "@/lib/client/api-client";

async function fetchCategories(url: string): Promise<{ categories: { id: number; name: string }[] }> {
    const response = await apiGet<{ categories: { id: number; name: string }[] }>(url);
    if (!response.success) throw new Error("โหลดหมวดวัสดุไม่สำเร็จ");
    return response.data;
}

export function StockRawDataExport({ canExportReports }: { canExportReports: boolean }): ReactElement {
    const [busy, setBusy] = useState<"raw-issued" | "raw-inventory" | null>(null);
    const lock = useRef(false);
    const { data: options, error: optionsError, mutate: reloadOptions } = useSWR(canExportReports ? "/api/stock/reports/export?reportType=raw-issued&metaOnly=1" : null, fetchCategories, { revalidateOnFocus: false, shouldRetryOnError: false });
    async function download(mode: "raw-issued" | "raw-inventory", form?: HTMLFormElement): Promise<void> {
        if (!canExportReports || lock.current) return;
        lock.current = true;
        setBusy(mode);
        try {
            const params = new URLSearchParams({ reportType: mode, format: "xlsx" });
            if (form) for (const [key, value] of new FormData(form)) if (typeof value === "string" && value.trim()) params.set(key, value.trim());
            await downloadXlsx(`/api/stock/reports/export?${params}`);
            toast.info("เริ่มดาวน์โหลดข้อมูลดิบ Excel แล้ว");
        } catch (error) {
            toast.error("ส่งออกข้อมูลดิบไม่สำเร็จ", { description: error instanceof Error ? error.message : "กรุณาลองใหม่อีกครั้ง" });
        } finally { lock.current = false; setBusy(null); }
    }
    function submit(event: FormEvent<HTMLFormElement>): void { event.preventDefault(); void download("raw-issued", event.currentTarget); }
    return <div className="space-y-5">
        <section className="rounded-2xl border border-border-subtle bg-surface-raised p-5">
            <h2 className="text-xl font-bold text-content-strong">ส่งออกข้อมูลดิบ</h2><p className="mt-2 text-sm leading-6 text-content-muted">ข้อมูลจริงสำหรับตรวจสอบและวิเคราะห์ภายนอก · สูงสุด 5,000 แถวต่อไฟล์ · ส่งออกเมื่อกดปุ่มเท่านั้น</p>
            <form onSubmit={submit} className="mt-5 space-y-4" aria-label="ส่งออกข้อมูลดิบการจ่ายวัสดุ">
                <h3 className="font-semibold text-content-strong">รายการวัสดุที่จ่ายแล้ว</h3><p className="text-sm text-content-muted">หนึ่งแถวต่อรายการคำขอ พร้อมรหัสวัสดุและ variant · อ้างอิงวันที่จ่ายจริงตามเวลาไทย · ตัวกรองแยกจากหน้าภาพรวม</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <label className="space-y-2 text-sm text-content-secondary"><span>ปีข้อมูลดิบ ค.ศ.</span><Input name="year" type="number" min={2000} max={2100} required defaultValue={getBangkokYear(new Date())} className="h-11" /></label>
                    <label className="space-y-2 text-sm text-content-secondary"><span>ตั้งแต่เดือน</span><Input name="fromMonth" type="number" min={1} max={12} required defaultValue={1} className="h-11" /></label>
                    <label className="space-y-2 text-sm text-content-secondary"><span>ถึงเดือน</span><Input name="toMonth" type="number" min={1} max={12} required defaultValue={12} className="h-11" /></label>
                    <label className="space-y-2 text-sm text-content-secondary"><span>หมวดข้อมูลดิบ</span><select name="categoryId" className="h-11 w-full rounded-md border border-input bg-surface-raised px-3 text-content-strong focus-visible:outline-2 focus-visible:outline-ring"><option value="">ทุกหมวด</option>{options?.categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
                    <label className="space-y-2 text-sm text-content-secondary"><span>โครงการข้อมูลดิบ</span><Input name="projectCode" maxLength={100} placeholder="ทุกโครงการ" className="h-11" /></label>
                </div>
                {optionsError ? <p role="alert" className="text-sm text-content-muted">โหลดหมวดไม่สำเร็จ <button type="button" className="min-h-11 underline" onClick={() => void reloadOptions()}>ลองโหลดหมวดใหม่</button></p> : null}
                <Button type="submit" disabled={!canExportReports || busy !== null} aria-busy={busy === "raw-issued"} className="bg-module-stock-solid text-content-on-brand hover:bg-module-stock-solid-hover">{busy === "raw-issued" ? "กำลังเตรียมข้อมูลดิบ" : "ดาวน์โหลดข้อมูลดิบการจ่าย"}</Button>
            </form>
            <div className="mt-6 border-t border-border-subtle pt-5"><h3 className="font-semibold text-content-strong">คลังปัจจุบันระดับ variant</h3><p className="mt-2 text-sm text-content-muted">หนึ่งแถวต่อ variant ที่ใช้งานของวัสดุที่ใช้งาน พร้อมยอดจริง จอง พร้อมใช้ และจุดสั่งซื้อ · ไม่ใช้ตัวกรองย้อนหลัง</p><Button type="button" variant="outline" className="mt-4" disabled={!canExportReports || busy !== null} aria-busy={busy === "raw-inventory"} onClick={() => void download("raw-inventory")}>{busy === "raw-inventory" ? "กำลังเตรียมข้อมูลดิบคลัง" : "ดาวน์โหลดข้อมูลดิบคลังปัจจุบัน"}</Button></div>
        </section>
        <div><h2 className="mb-3 text-lg font-bold text-content-strong">รายงาน Excel รูปแบบเดิม</h2><StockLegacyReports canExportReports={canExportReports} /></div>
    </div>;
}
