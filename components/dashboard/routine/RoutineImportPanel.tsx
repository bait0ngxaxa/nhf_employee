"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
    Check,
    CheckCircle2,
    FileSpreadsheet,
    Pencil,
    RefreshCw,
    Trash2,
    UploadCloud,
} from "lucide-react";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state";
import { Input } from "@/components/ui/input";
import { API_ROUTES } from "@/lib/ssot/routes";
import {
    ROUTINE_IMPORT_MAX_FILE_BYTES,
    ROUTINE_IMPORT_TARGET_SHEET,
} from "@/lib/services/routine-import/sheet-config";

import { RoutineImportRowEditor } from "./RoutineImportRowEditor";
import { formatRoutineScheduleSummary } from "./labels";
import type {
    RoutineImportBatchView,
    RoutineImportReference,
    RoutineImportRowEdit,
    RoutineImportRowView,
    RoutineImportRowsPage,
    RoutineImportRowStatus,
} from "./import-types";

type ImportFilter = RoutineImportRowStatus | "";
type ImportIssue = "" | "UNRESOLVED_OWNER" | "AMBIGUOUS_SCHEDULE" | "EXPIRED_CONTRACT";

const STATUS_LABELS: Record<RoutineImportRowStatus, string> = {
    VALID: "พร้อมนำเข้า",
    REQUIRES_REVIEW: "ต้องตรวจสอบ",
    EXCLUDED: "ถูกข้าม",
    ALREADY_IMPORTED: "เคยนำเข้าแล้ว",
    CONFLICT: "conflict",
    APPLIED: "นำเข้าแล้ว",
    FAILED: "ล้มเหลว",
};

const STATUS_CLASSES: Record<RoutineImportRowStatus, string> = {
    VALID: "border-emerald-200 bg-emerald-50 text-emerald-700",
    REQUIRES_REVIEW: "border-amber-200 bg-amber-50 text-amber-800",
    EXCLUDED: "border-slate-200 bg-slate-100 text-slate-700",
    ALREADY_IMPORTED: "border-sky-200 bg-sky-50 text-sky-700",
    CONFLICT: "border-rose-200 bg-rose-50 text-rose-700",
    APPLIED: "border-emerald-200 bg-emerald-50 text-emerald-700",
    FAILED: "border-rose-200 bg-rose-50 text-rose-700",
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function responseError(value: unknown, fallback: string): string {
    if (isRecord(value) && typeof value.error === "string") return value.error;
    return fallback;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, { cache: "no-store", ...init });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new Error(responseError(body, "ดำเนินการไม่สำเร็จ"));
    return body as T;
}

function formatDate(value: string | null): string {
    if (!value) return "-";
    return value.slice(0, 10);
}

function scheduleLabel(row: RoutineImportRowView): string {
    const schedule = row.data.normalizedSchedule;
    if (!schedule) return "ยังไม่กำหนด";
    return formatRoutineScheduleSummary(schedule);
}

function reviewLabel(reason: string): string {
    const [code, detail] = reason.split(":", 2);
    const labels: Record<string, string> = {
        AMBIGUOUS_SCHEDULE: "กำหนดการคลุมเครือ",
        UNSUPPORTED_EVENT_SCHEDULE: "กำหนดการขึ้นกับเหตุการณ์",
        MISSING_OWNER: "ไม่มีผู้รับผิดชอบ",
        OWNER_MAPPING_EMPLOYEE_NOT_FOUND: "ยังจับคู่พนักงานไม่ได้",
        OWNER_MAPPING_EMPLOYEE_INACTIVE: "พนักงานไม่พร้อมใช้งาน",
        EXPIRED_CONTRACT: "สัญญาหมดอายุ",
        FORMULA_CELL: "พบเซลล์สูตร ต้องตรวจสอบค่า",
        HOLIDAY_CALENDAR_NOT_SUPPORTED: "ยังไม่รวมวันหยุดนักขัตฤกษ์",
        INVALID_CONTRACT_DATE_RANGE: "ช่วงสัญญาไม่ถูกต้อง",
        MISSING_CATEGORY: "ไม่มีหมวดงาน",
        INACTIVE_CATEGORY: "หมวดงานไม่พร้อมใช้งาน",
        PLACEHOLDER_ROW: "รายการอ้างอิงหรือ placeholder",
    };
    return `${labels[code] ?? code}${detail ? ` (${detail})` : ""}`;
}

function rowToEditPayload(row: RoutineImportRowView, selected: boolean): RoutineImportRowEdit {
    const schedule = row.data.normalizedSchedule;
    return {
        version: row.version,
        categoryName: row.data.categoryName,
        title: row.data.title,
        mappedAssignees: row.data.mappedAssignees ?? row.data.mappedEmployeeIds.map((employeeId, index) => ({
            employeeId,
            role: index === 0 ? "OWNER" : "CO_OWNER",
        })),
        scheduleText: row.data.scheduleText,
        scheduleType: schedule?.scheduleType ?? "MANUAL",
        scheduleConfig: schedule?.scheduleConfig ?? {},
        businessDayPolicy: schedule?.businessDayPolicy ?? "NONE",
        contractStartDate: row.data.contractStartDate,
        contractEndDate: row.data.contractEndDate,
        contractText: row.data.contractText,
        extraDetails: row.data.extraDetails,
        proposedActivation: row.data.proposedActivation === "ACTIVE" ? "ACTIVE" : "INACTIVE",
        selected,
        reminderRules: row.data.reminderRules ?? [],
    };
}

function SummaryItem({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "warning" | "success" | "danger" }) {
    const toneClass = tone === "warning"
        ? "text-status-warning-foreground"
        : tone === "success"
            ? "text-status-success-foreground"
            : tone === "danger"
                ? "text-status-danger-foreground"
                : "text-content-heading";
    return <div className="rounded-lg border border-border-subtle bg-surface-raised px-3 py-3"><p className="text-xs text-content-secondary">{label}</p><p className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</p></div>;
}

export function RoutineImportPanel() {
    const inputRef = useRef<HTMLInputElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const [batchId, setBatchId] = useState<number | null>(null);
    const [batch, setBatch] = useState<RoutineImportBatchView | null>(null);
    const [rowsPage, setRowsPage] = useState<RoutineImportRowsPage | null>(null);
    const [reference, setReference] = useState<RoutineImportReference | null>(null);
    const [filter, setFilter] = useState<ImportFilter>("");
    const [issue, setIssue] = useState<ImportIssue>("");
    const [selectedOnly, setSelectedOnly] = useState(false);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [applying, setApplying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [editorRow, setEditorRow] = useState<RoutineImportRowView | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);

    const loadReference = useCallback(async (): Promise<void> => {
        try {
            const body = await fetchJson<{ units: RoutineImportReference["units"]; categories: RoutineImportReference["categories"]; employees: RoutineImportReference["employees"] }>(API_ROUTES.routines.reference);
            setReference(body);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : "โหลดข้อมูลอ้างอิงไม่สำเร็จ");
        }
    }, []);

    const loadBatch = useCallback(async (): Promise<void> => {
        if (batchId === null) return;
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), limit: "25" });
            if (filter) params.set("status", filter);
            if (issue) params.set("issue", issue);
            if (selectedOnly) params.set("selected", "1");
            if (search.trim()) params.set("search", search.trim());
            const [batchBody, rowsBody] = await Promise.all([
                fetchJson<{ batch: RoutineImportBatchView }>(API_ROUTES.routines.imports.batchById(batchId)),
                fetchJson<RoutineImportRowsPage>(`${API_ROUTES.routines.imports.rows(batchId)}?${params.toString()}`),
            ]);
            setBatch(batchBody.batch);
            setRowsPage(rowsBody);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : "โหลดข้อมูลนำเข้าไม่สำเร็จ");
        } finally {
            setLoading(false);
        }
    }, [batchId, filter, issue, page, search, selectedOnly]);

    useEffect(() => { void loadReference(); }, [loadReference]);
    useEffect(() => { void loadBatch(); }, [loadBatch]);

    function reset(): void {
        setFile(null);
        setBatchId(null);
        setBatch(null);
        setRowsPage(null);
        setError(null);
        setFilter("");
        setIssue("");
        setSelectedOnly(false);
        setSearch("");
        setPage(1);
        if (inputRef.current) inputRef.current.value = "";
    }

    async function upload(): Promise<void> {
        if (!file) return;
        if (file.size > ROUTINE_IMPORT_MAX_FILE_BYTES) {
            setError("ไฟล์ต้องมีขนาดไม่เกิน 10 MB");
            return;
        }
        setUploading(true);
        setError(null);
        try {
            const formData = new FormData();
            formData.append("file", file);
            const body = await fetchJson<{ batch: RoutineImportBatchView; reusedExisting: boolean }>(API_ROUTES.routines.imports.preview, { method: "POST", body: formData });
            setBatchId(body.batch.id);
            setBatch(body.batch);
            setPage(1);
        } catch (uploadError) {
            setError(uploadError instanceof Error ? uploadError.message : "อัปโหลดไฟล์ไม่สำเร็จ");
        } finally {
            setUploading(false);
        }
    }

    async function updateSelection(row: RoutineImportRowView, selected: boolean): Promise<void> {
        if (row.status !== "VALID" && row.status !== "EXCLUDED") return;
        setError(null);
        try {
            await fetchJson<{ row: RoutineImportRowView }>(API_ROUTES.routines.imports.rowById(batchId ?? 0, row.id), {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(rowToEditPayload(row, selected)),
            });
            await loadBatch();
        } catch (updateError) {
            setError(updateError instanceof Error ? updateError.message : "อัปเดตการเลือกไม่สำเร็จ");
        }
    }

    async function apply(): Promise<void> {
        if (!batch || batchId === null) return;
        setConfirmOpen(false);
        setApplying(true);
        setError(null);
        try {
            const result = await fetchJson<{ batch: RoutineImportBatchView }>(API_ROUTES.routines.imports.apply(batchId), {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ confirm: true }),
            });
            setBatch(result.batch);
            await loadBatch();
        } catch (applyError) {
            setError(applyError instanceof Error ? applyError.message : "นำเข้าข้อมูลไม่สำเร็จ");
            await loadBatch();
        } finally {
            setApplying(false);
        }
    }

    async function cancelBatch(): Promise<void> {
        if (batchId === null || !window.confirm("ยกเลิกชุดข้อมูลนำเข้านี้หรือไม่")) return;
        try {
            const result = await fetchJson<{ batch: RoutineImportBatchView }>(API_ROUTES.routines.imports.cancel(batchId), { method: "POST" });
            setBatch(result.batch);
            await loadBatch();
        } catch (cancelError) {
            setError(cancelError instanceof Error ? cancelError.message : "ยกเลิกชุดข้อมูลไม่สำเร็จ");
        }
    }

    const canApply = Boolean(batch && (batch.status === "READY" || batch.status === "PREVIEW") && batch.selectedRows > 0 && !applying);
    const currentPage = rowsPage?.pagination;

    if (!batchId) {
        return (
            <div className="space-y-5">
                <div className="rounded-xl border border-border-subtle bg-surface-raised p-5">
                    <div className="flex items-start gap-3">
                        <div className="rounded-lg bg-brand-surface p-2 text-brand-foreground"><FileSpreadsheet className="h-5 w-5" /></div>
                        <div><h3 className="font-semibold text-content-heading">นำเข้าข้อมูลจาก Excel</h3><p className="mt-1 max-w-2xl text-sm leading-6 text-content-secondary">ระบบจะอ่านเฉพาะชีต มสช. แสดงตัวอย่างให้ตรวจสอบก่อนสร้างแม่แบบงาน ชีตอื่นในไฟล์จะไม่ถูกนำเข้า</p></div>
                    </div>
                    <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                        <label className="grid gap-1 text-sm font-medium text-content-body">ไฟล์ Excel (.xls หรือ .xlsx)<Input ref={inputRef} type="file" accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setError(null); }} /></label>
                        <Button type="button" onClick={() => void upload()} disabled={!file || uploading}>{uploading ? "กำลังอ่านไฟล์..." : <><UploadCloud /> อัปโหลดและดูตัวอย่าง</>}</Button>
                    </div>
                    <p className="mt-3 text-xs text-content-secondary">ขนาดไฟล์ไม่เกิน 10 MB · ไม่ประเมินสูตรหรือ macro · ข้อมูลจริงจะยังไม่ถูกสร้างจนกว่าจะกดยืนยัน</p>
                </div>
                {error ? <p className="rounded-lg border border-status-danger-border bg-status-danger-surface px-4 py-3 text-sm text-status-danger-foreground" role="alert">{error}</p> : null}
            </div>
        );
    }

    if (loading && !batch) return <LoadingState label="กำลังโหลดตัวอย่างข้อมูลนำเข้า..." />;
    if (error && !batch) return <ErrorState action={{ label: "ลองใหม่", onClick: () => void loadBatch(), icon: <RefreshCw /> }} description={error} />;
    if (!batch) return null;

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h3 className="text-lg font-semibold text-content-heading">ตัวอย่างการนำเข้า · ชีต {ROUTINE_IMPORT_TARGET_SHEET}</h3><p className="mt-1 text-sm text-content-secondary">{batch.originalFileName} · hash {batch.fileHashPrefix} · อ้างอิงวันที่ {formatDate(batch.asOfDate)}</p></div>
                <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => void loadBatch()} disabled={loading || applying}><RefreshCw /> รีเฟรช</Button>{batch.status === "READY" || batch.status === "PREVIEW" ? <Button type="button" variant="outline" onClick={() => void cancelBatch()} disabled={applying}><Trash2 /> ยกเลิกชุดนี้</Button> : null}<Button type="button" variant="outline" onClick={reset} disabled={applying}>อัปโหลดไฟล์ใหม่</Button></div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
                <SummaryItem label="อ่านได้ทั้งหมด" value={batch.totalRows} />
                <SummaryItem label="พร้อมนำเข้า" value={batch.validRows} tone="success" />
                <SummaryItem label="ต้องตรวจสอบ" value={batch.reviewRows} tone="warning" />
                <SummaryItem label="ถูกข้าม" value={batch.excludedRows} />
                <SummaryItem label="เคยนำเข้าแล้ว" value={batch.alreadyImportedRows} />
                <SummaryItem label="conflict" value={batch.conflictRows} tone="danger" />
                <SummaryItem label="สัญญาหมดอายุ" value={batch.expiredRows} tone="warning" />
                <SummaryItem label="ไม่มีผู้รับผิดชอบ" value={batch.unresolvedOwnerRows} tone="warning" />
                <SummaryItem label="นำเข้าแล้ว" value={batch.appliedRows} tone="success" />
            </div>

            {batch.ignoredSheetNames.length > 0 ? <div className="rounded-lg border border-status-warning-border bg-status-warning-surface px-4 py-3 text-sm text-status-warning-foreground"><p className="font-semibold">ชีตที่พบแต่ยังไม่เปิดใช้งาน</p><p className="mt-1">{batch.ignoredSheetNames.join(" · ")}</p></div> : null}
            {error ? <p className="rounded-lg border border-status-danger-border bg-status-danger-surface px-4 py-3 text-sm text-status-danger-foreground" role="alert">{error}</p> : null}
            {batch.status === "COMPLETED" ? <div className="flex items-start gap-3 rounded-lg border border-status-success-border bg-status-success-surface px-4 py-3 text-sm text-status-success-foreground"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-semibold">นำเข้าชุดข้อมูลนี้เสร็จแล้ว</p><p className="mt-1">สร้าง Task แล้ว {batch.appliedRows} รายการ, เปิดใช้งาน {batch.activeRows} รายการ และไม่เปิดใช้งาน {batch.inactiveRows} รายการ</p></div></div> : null}

            <div className="grid gap-3 rounded-xl border border-border-subtle bg-surface-raised p-4 lg:grid-cols-[1fr_180px_220px_auto_auto] lg:items-end">
                <label className="grid gap-1 text-sm font-medium text-content-body">ค้นหา<Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="รายการ หมวดงาน หรือผู้รับผิดชอบ" /></label>
                <label className="grid gap-1 text-sm font-medium text-content-body">สถานะ<select className="h-11 rounded-md border border-input bg-background px-3 text-sm" value={filter} onChange={(event) => { setFilter(event.target.value as ImportFilter); setPage(1); }}><option value="">ทุกสถานะ</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label className="grid gap-1 text-sm font-medium text-content-body">ประเด็น<select className="h-11 rounded-md border border-input bg-background px-3 text-sm" value={issue} onChange={(event) => { setIssue(event.target.value as ImportIssue); setPage(1); }}><option value="">ทุกประเด็น</option><option value="UNRESOLVED_OWNER">ไม่มีผู้รับผิดชอบ / ยัง map ไม่ได้</option><option value="AMBIGUOUS_SCHEDULE">กำหนดการคลุมเครือ</option><option value="EXPIRED_CONTRACT">สัญญาหมดอายุ</option></select></label>
                <label className="flex h-11 items-center gap-2 text-sm font-medium text-content-body"><input type="checkbox" checked={selectedOnly} onChange={(event) => { setSelectedOnly(event.target.checked); setPage(1); }} /> เฉพาะที่เลือก</label>
                <p className="text-xs text-content-secondary">ผู้รับผิดชอบระบบ: {batch.uploadedBy.name}</p>
            </div>

            {loading ? <LoadingState label="กำลังโหลดแถวข้อมูล..." compact /> : rowsPage && rowsPage.rows.length === 0 ? <EmptyState compact title="ไม่พบแถวตามตัวกรอง" description="ลองเปลี่ยนตัวกรองหรือค้นหาคำอื่น" /> : rowsPage ? (
                <div className="overflow-hidden rounded-xl border border-border-subtle bg-surface-raised">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[1100px] text-sm">
                            <thead className="bg-surface-subtle text-left text-xs text-content-secondary"><tr><th className="w-12 px-3 py-3">เลือก</th><th className="px-3 py-3">แถว</th><th className="px-3 py-3">หมวด / รายการ</th><th className="px-3 py-3">ผู้รับผิดชอบ</th><th className="px-3 py-3">กำหนดการ</th><th className="px-3 py-3">สัญญา</th><th className="px-3 py-3">สถานะ</th><th className="px-3 py-3">จัดการ</th></tr></thead>
                            <tbody>{rowsPage.rows.map((row) => {
                                const terminal = row.status === "ALREADY_IMPORTED" || row.status === "CONFLICT" || row.status === "APPLIED";
                                return <tr key={row.id} className="border-t border-border-subtle align-top"><td className="px-3 py-3"><input type="checkbox" checked={row.selected} disabled={terminal || row.status === "REQUIRES_REVIEW" || applying} onChange={(event) => void updateSelection(row, event.target.checked)} aria-label={`เลือกแถว ${row.sourceRow}`} /></td><td className="px-3 py-3 text-content-secondary">{row.sourceRow}</td><td className="max-w-xs px-3 py-3"><p className="font-medium text-content-heading">{row.data.title}</p><p className="mt-1 text-xs text-content-secondary">{row.data.categoryName || "ไม่มีหมวด"}</p></td><td className="max-w-xs px-3 py-3"><p className="text-content-body">{row.data.ownerNames.join(", ") || "ไม่พบชื่อ"}</p><p className="mt-1 text-xs text-content-secondary">{row.data.mappedEmployeeNames.join(", ") || "ยังไม่ map"}</p></td><td className="max-w-xs px-3 py-3"><p className="text-xs text-content-secondary">{row.data.scheduleText || "-"}</p><p className="mt-1 break-all text-xs text-content-body">{scheduleLabel(row)}</p></td><td className="max-w-xs px-3 py-3"><p className="text-xs text-content-body">{row.data.contractText || "-"}</p><p className="mt-1 text-xs text-content-secondary">{formatDate(row.data.contractStartDate)} – {formatDate(row.data.contractEndDate)}</p></td><td className="px-3 py-3"><Badge variant="outline" className={STATUS_CLASSES[row.status]}>{STATUS_LABELS[row.status]}</Badge>{row.reviewReasons.length > 0 ? <ul className="mt-2 max-w-52 space-y-1 text-xs text-status-warning-foreground">{row.reviewReasons.slice(0, 2).map((reason) => <li key={reason}>• {reviewLabel(reason)}</li>)}</ul> : null}</td><td className="px-3 py-3"><Button type="button" variant="outline" size="sm" disabled={terminal || applying || !reference} onClick={() => setEditorRow(row)}><Pencil /> แก้ไข</Button></td></tr>;
                            })}</tbody>
                        </table>
                    </div>
                    {currentPage ? <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle px-4 py-3 text-sm"><span className="text-content-secondary">หน้า {currentPage.page} / {currentPage.pages} · ทั้งหมด {currentPage.total} แถว</span><div className="flex gap-2"><Button type="button" variant="outline" size="sm" disabled={currentPage.page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>ก่อนหน้า</Button><Button type="button" variant="outline" size="sm" disabled={currentPage.page >= currentPage.pages || loading} onClick={() => setPage((value) => value + 1)}>ถัดไป</Button></div></div> : null}
                </div>
            ) : null}

            <div className="sticky bottom-3 z-10 flex flex-col gap-3 rounded-xl border border-border-subtle bg-surface-raised/95 p-4 shadow-md backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm"><p className="font-semibold text-content-heading">รายการที่เลือก {batch.selectedRows} รายการ</p><p className="mt-1 text-xs text-content-secondary">เปิดใช้งาน {batch.activeRows} · ไม่เปิดใช้งาน {batch.inactiveRows} · รายการที่ต้องตรวจสอบ {batch.reviewRows}</p></div>
                <Button type="button" onClick={() => setConfirmOpen(true)} disabled={!canApply}><Check /> ยืนยันและนำเข้า</Button>
            </div>

            {reference ? <RoutineImportRowEditor batchId={batch.id} row={editorRow} reference={reference} open={editorRow !== null} disabled={applying || batch.status === "COMPLETED"} onOpenChange={(open) => { if (!open) setEditorRow(null); }} onSaved={() => { setEditorRow(null); void loadBatch(); }} /> : null}

            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>ยืนยันการนำเข้าข้อมูล</AlertDialogTitle><AlertDialogDescription>กำลังจะนำเข้าข้อมูลจากชีต {ROUTINE_IMPORT_TARGET_SHEET}</AlertDialogDescription></AlertDialogHeader>
                    <div className="rounded-lg bg-surface-subtle p-4 text-sm text-content-body"><p>รายการที่เลือก: <strong>{batch.selectedRows}</strong></p><p>เปิดใช้งานทันที: <strong>{batch.activeRows}</strong></p><p>นำเข้าแบบไม่เปิดใช้งาน: <strong>{batch.inactiveRows}</strong></p><p>รอบปัจจุบันที่อาจสร้าง: ระบบจะสร้างเฉพาะรอบปัจจุบัน/อนาคตที่ยังไม่เลยกำหนด</p></div>
                    <AlertDialogFooter><AlertDialogCancel disabled={applying}>กลับไปตรวจสอบ</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); void apply(); }} disabled={applying}>ยืนยันการนำเข้า</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
