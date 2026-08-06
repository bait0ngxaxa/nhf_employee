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
import { toast } from "sonner";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
type ImportIssue = "" | "UNRESOLVED_OWNER";

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

const BATCH_STATUS_LABELS: Record<RoutineImportBatchView["status"], string> = {
    PREVIEW: "กำลังตรวจสอบตัวอย่าง",
    READY: "พร้อมตรวจสอบและนำเข้า",
    APPLYING: "กำลังนำเข้า",
    COMPLETED: "นำเข้าเสร็จแล้ว",
    FAILED: "นำเข้าไม่สำเร็จ",
    CANCELLED: "ยกเลิกแล้ว",
    EXPIRED: "หมดอายุแล้ว",
};

function isEditableBatchStatus(
    status: RoutineImportBatchView["status"],
): boolean {
    return status === "READY" || status === "PREVIEW";
}

function batchReadOnlyReason(status: RoutineImportBatchView["status"]): string {
    const label = BATCH_STATUS_LABELS[status];
    if (status === "APPLYING")
        return `ชุดข้อมูลอยู่ในสถานะ “${label}” จึงยังแก้ไขไม่ได้ กรุณารอให้ระบบดำเนินการเสร็จ`;
    if (status === "EXPIRED")
        return `ชุดข้อมูล “${label}” จึงแก้ไขหรือนำเข้าไม่ได้ กรุณาอัปโหลดไฟล์ใหม่`;
    return `ชุดข้อมูลอยู่ในสถานะ “${label}” จึงแก้ไขข้อมูล staging ไม่ได้`;
}

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
    if (!response.ok)
        throw new Error(responseError(body, "ดำเนินการไม่สำเร็จ"));
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
        MISSING_OWNER: "ไม่มีผู้รับผิดชอบ",
        OWNER_MAPPING_EMPLOYEE_NOT_FOUND: "ยังจับคู่พนักงานไม่ได้",
        OWNER_MAPPING_EMPLOYEE_INACTIVE: "พนักงานไม่พร้อมใช้งาน",
        DUPLICATE_OWNER: "ผู้รับผิดชอบซ้ำกันไม่ได้",
        INVALID_CONTRACT_DATE_RANGE: "ช่วงสัญญาไม่ถูกต้อง",
        INVALID_OWNER_ROLE: "ต้องมีผู้รับผิดชอบหลัก 1 คน",
        MISSING_CATEGORY: "ไม่มีหมวดงาน",
        MISSING_TITLE: "ไม่มีชื่อรายการ",
        MISSING_UNIT: "ไม่มีหน่วยงาน",
        INACTIVE_UNIT: "หน่วยงานไม่พร้อมใช้งาน",
        INACTIVE_CATEGORY: "หมวดงานไม่พร้อมใช้งาน",
        PLACEHOLDER_ROW: "รายการอ้างอิงหรือ placeholder",
    };
    return `${labels[code] ?? code}${detail ? ` (${detail})` : ""}`;
}

function rowStatusLabel(row: RoutineImportRowView): string {
    if (
        row.status === "REQUIRES_REVIEW" &&
        row.reviewReasons.some((reason) =>
            [
                "MISSING_OWNER",
                "OWNER_MAPPING_EMPLOYEE_NOT_FOUND",
                "OWNER_MAPPING_EMPLOYEE_INACTIVE",
                "DUPLICATE_OWNER",
                "INVALID_OWNER_ROLE",
            ].includes(reason.split(":", 1)[0]),
        )
    ) {
        return "ต้องเลือกผู้รับผิดชอบ";
    }
    return STATUS_LABELS[row.status];
}

function rowToEditPayload(
    row: RoutineImportRowView,
    selected: boolean,
): RoutineImportRowEdit {
    const schedule = row.data.normalizedSchedule;
    return {
        version: row.version,
        categoryName: row.data.categoryName,
        title: row.data.title,
        mappedAssignees:
            row.data.mappedAssignees ??
            row.data.mappedEmployeeIds.map((employeeId, index) => ({
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
        selected,
        reminderRules: row.data.reminderRules ?? [],
    };
}

function SummaryItem({
    label,
    value,
    tone = "default",
}: {
    label: string;
    value: number;
    tone?: "default" | "warning" | "success" | "danger";
}) {
    const toneClass =
        tone === "warning"
            ? "text-status-warning-foreground"
            : tone === "success"
              ? "text-status-success-foreground"
              : tone === "danger"
                ? "text-status-danger-foreground"
                : "text-content-heading";
    return (
        <div className="rounded-lg border border-border-subtle bg-surface-raised px-4 py-4">
            <p className="text-sm font-medium leading-5 text-content-secondary">
                {label}
            </p>
            <p
                className={`mt-2 text-3xl font-bold tracking-tight tabular-nums ${toneClass}`}
            >
                {value}
            </p>
        </div>
    );
}

export function RoutineImportPanel() {
    const inputRef = useRef<HTMLInputElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const [batchId, setBatchId] = useState<number | null>(null);
    const [batch, setBatch] = useState<RoutineImportBatchView | null>(null);
    const [rowsPage, setRowsPage] = useState<RoutineImportRowsPage | null>(
        null,
    );
    const [reference, setReference] = useState<RoutineImportReference | null>(
        null,
    );
    const [filter, setFilter] = useState<ImportFilter>("");
    const [issue, setIssue] = useState<ImportIssue>("");
    const [selectedOnly, setSelectedOnly] = useState(false);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [applying, setApplying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [referenceLoading, setReferenceLoading] = useState(false);
    const [referenceError, setReferenceError] = useState<string | null>(null);
    const [editorRow, setEditorRow] = useState<RoutineImportRowView | null>(
        null,
    );
    const [confirmOpen, setConfirmOpen] = useState(false);
    const uploadLockRef = useRef(false);
    const uploadToastBatchIdRef = useRef<number | null>(null);
    const applyLockRef = useRef(false);
    const cancelLockRef = useRef(false);
    const selectionLocksRef = useRef<Set<number>>(new Set());
    const referenceLockRef = useRef(false);

    const loadReference = useCallback(async (): Promise<void> => {
        if (referenceLockRef.current) return;
        referenceLockRef.current = true;
        setReferenceLoading(true);
        setReferenceError(null);
        try {
            const body = await fetchJson<RoutineImportReference>(
                API_ROUTES.routines.imports.reference,
            );
            setReference(body);
        } catch (loadError) {
            setReferenceError(
                loadError instanceof Error
                    ? loadError.message
                    : "โหลดข้อมูลพนักงานไม่สำเร็จ",
            );
        } finally {
            setReferenceLoading(false);
            referenceLockRef.current = false;
        }
    }, []);

    const loadBatch = useCallback(async (): Promise<void> => {
        if (batchId === null) return;
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                page: String(page),
                limit: "25",
            });
            if (filter) params.set("status", filter);
            if (issue) params.set("issue", issue);
            if (selectedOnly) params.set("selected", "1");
            if (search.trim()) params.set("search", search.trim());
            const [batchBody, rowsBody] = await Promise.all([
                fetchJson<{ batch: RoutineImportBatchView }>(
                    API_ROUTES.routines.imports.batchById(batchId),
                ),
                fetchJson<RoutineImportRowsPage>(
                    `${API_ROUTES.routines.imports.rows(batchId)}?${params.toString()}`,
                ),
            ]);
            setBatch(batchBody.batch);
            setRowsPage(rowsBody);
            if (uploadToastBatchIdRef.current === batchId) {
                uploadToastBatchIdRef.current = null;
                toast.success("อ่านไฟล์และสร้างตัวอย่างข้อมูลสำเร็จ");
            }
        } catch (loadError) {
            setError(
                loadError instanceof Error
                    ? loadError.message
                    : "โหลดข้อมูลนำเข้าไม่สำเร็จ",
            );
        } finally {
            setLoading(false);
        }
    }, [batchId, filter, issue, page, search, selectedOnly]);

    useEffect(() => {
        if (batchId !== null && !reference) void loadReference();
    }, [batchId, loadReference, reference]);
    useEffect(() => {
        void loadBatch();
    }, [loadBatch]);

    function reset(): void {
        setFile(null);
        setBatchId(null);
        setBatch(null);
        setRowsPage(null);
        setError(null);
        uploadToastBatchIdRef.current = null;
        setFilter("");
        setIssue("");
        setSelectedOnly(false);
        setSearch("");
        setPage(1);
        if (inputRef.current) inputRef.current.value = "";
    }

    async function upload(): Promise<void> {
        if (!file || uploadLockRef.current) return;
        uploadLockRef.current = true;
        if (file.size > ROUTINE_IMPORT_MAX_FILE_BYTES) {
            setError("ไฟล์ต้องมีขนาดไม่เกิน 10 MB");
            uploadLockRef.current = false;
            return;
        }
        setUploading(true);
        setError(null);
        try {
            const formData = new FormData();
            formData.append("file", file);
            const body = await fetchJson<{
                batch: RoutineImportBatchView;
                reusedExisting: boolean;
            }>(API_ROUTES.routines.imports.preview, {
                method: "POST",
                body: formData,
            });
            uploadToastBatchIdRef.current = body.batch.id;
            setBatchId(body.batch.id);
            setPage(1);
        } catch (uploadError) {
            const message =
                uploadError instanceof Error
                    ? uploadError.message
                    : "อัปโหลดไฟล์ไม่สำเร็จ";
            setError(message);
            toast.error(message);
        } finally {
            setUploading(false);
            uploadLockRef.current = false;
        }
    }

    async function updateSelection(
        row: RoutineImportRowView,
        selected: boolean,
    ): Promise<void> {
        if (
            !batch ||
            !isEditableBatchStatus(batch.status) ||
            (row.status !== "VALID" && row.status !== "EXCLUDED") ||
            selectionLocksRef.current.has(row.id)
        )
            return;
        selectionLocksRef.current.add(row.id);
        setError(null);
        try {
            await fetchJson<{ row: RoutineImportRowView }>(
                API_ROUTES.routines.imports.rowById(batchId ?? 0, row.id),
                {
                    method: "PATCH",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify(rowToEditPayload(row, selected)),
                },
            );
            await loadBatch();
            toast.success("อัปเดตการเลือกแถวสำเร็จ");
        } catch (updateError) {
            const message =
                updateError instanceof Error
                    ? updateError.message
                    : "อัปเดตการเลือกไม่สำเร็จ";
            setError(message);
            toast.error(message);
        } finally {
            selectionLocksRef.current.delete(row.id);
        }
    }

    async function apply(): Promise<void> {
        if (!batch || batchId === null || applyLockRef.current) return;
        applyLockRef.current = true;
        setConfirmOpen(false);
        setApplying(true);
        setError(null);
        try {
            const result = await fetchJson<{ batch: RoutineImportBatchView }>(
                API_ROUTES.routines.imports.apply(batchId),
                {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ confirm: true }),
                },
            );
            setBatch(result.batch);
            await loadBatch();
            toast.success("นำเข้าข้อมูล Routine สำเร็จ");
        } catch (applyError) {
            const message =
                applyError instanceof Error
                    ? applyError.message
                    : "นำเข้าข้อมูลไม่สำเร็จ";
            setError(message);
            toast.error(message);
            await loadBatch();
        } finally {
            setApplying(false);
            applyLockRef.current = false;
        }
    }

    async function cancelBatch(): Promise<void> {
        if (
            batchId === null ||
            cancelLockRef.current ||
            !window.confirm("ยกเลิกชุดข้อมูลนำเข้านี้หรือไม่")
        )
            return;
        cancelLockRef.current = true;
        try {
            const result = await fetchJson<{ batch: RoutineImportBatchView }>(
                API_ROUTES.routines.imports.cancel(batchId),
                { method: "POST" },
            );
            setBatch(result.batch);
            await loadBatch();
            toast.success("ยกเลิกชุดข้อมูลนำเข้าสำเร็จ");
        } catch (cancelError) {
            const message =
                cancelError instanceof Error
                    ? cancelError.message
                    : "ยกเลิกชุดข้อมูลไม่สำเร็จ";
            setError(message);
            toast.error(message);
        } finally {
            cancelLockRef.current = false;
        }
    }

    const canApply = Boolean(
        batch &&
        isEditableBatchStatus(batch.status) &&
        batch.validRows > 0 &&
        batch.selectedRows === batch.validRows &&
        !applying,
    );
    const currentPage = rowsPage?.pagination;

    if (!batchId) {
        return (
            <div className="space-y-5">
                <div className="rounded-xl border border-border-subtle bg-surface-raised p-5 sm:p-6">
                    <div className="flex items-start gap-3">
                        <div className="rounded-lg bg-brand-surface p-2 text-brand-foreground">
                            <FileSpreadsheet className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold tracking-tight text-content-heading">
                                นำเข้าข้อมูลจาก Excel
                            </h3>
                            <p className="mt-1 max-w-2xl text-sm leading-6 text-content-secondary">
                                ระบบจะอ่านเฉพาะชีต มสช.
                                แสดงตัวอย่างให้ตรวจสอบก่อนสร้างแม่แบบงาน
                                ชีตอื่นในไฟล์จะไม่ถูกนำเข้า
                            </p>
                        </div>
                    </div>
                    <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                        <label className="grid gap-1 text-sm font-medium text-content-body">
                            ไฟล์ Excel (.xls หรือ .xlsx)
                            <Input
                                ref={inputRef}
                                type="file"
                                accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                                onChange={(event) => {
                                    setFile(event.target.files?.[0] ?? null);
                                    setError(null);
                                }}
                            />
                        </label>
                        <Button
                            type="button"
                            onClick={() => void upload()}
                            disabled={!file || uploading}
                        >
                            {uploading ? (
                                "กำลังอ่านไฟล์..."
                            ) : (
                                <>
                                    <UploadCloud /> อัปโหลดและดูตัวอย่าง
                                </>
                            )}
                        </Button>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-content-secondary">
                        ขนาดไฟล์ไม่เกิน 10 MB · ไม่ประเมินสูตรหรือ macro ·
                        ข้อมูลจริงจะยังไม่ถูกสร้างจนกว่าจะกดยืนยัน
                    </p>
                </div>
                {error ? (
                    <p
                        className="rounded-lg border border-status-danger-border bg-status-danger-surface px-4 py-3 text-sm text-status-danger-foreground"
                        role="alert"
                    >
                        {error}
                    </p>
                ) : null}
            </div>
        );
    }

    if (loading && !batch)
        return <LoadingState label="กำลังโหลดตัวอย่างข้อมูลนำเข้า..." />;
    if (error && !batch)
        return (
            <ErrorState
                action={{
                    label: "ลองใหม่",
                    onClick: () => void loadBatch(),
                    icon: <RefreshCw />,
                }}
                description={error}
            />
        );
    if (!batch) return null;

    const batchEditable = isEditableBatchStatus(batch.status);
    const completedWithReviewRows =
        batch.status === "COMPLETED" && batch.reviewRows > 0;
    const readOnlyReason = batchEditable
        ? applying
            ? "กำลังนำเข้าข้อมูล จึงยังแก้ไขแถวไม่ได้"
            : undefined
        : batchReadOnlyReason(batch.status);
    const applyDisabledReason = !batchEditable
        ? readOnlyReason
        : applying
            ? "กำลังนำเข้าข้อมูล..."
            : batch.selectedRows !== batch.validRows
                ? "กรุณาแก้ไขรายการที่ต้องตรวจสอบ หรือยกเลิกการเลือกแถวนั้นก่อนนำเข้า"
                : batch.validRows === 0
                    ? "ยังไม่มีแถวที่ผ่านการตรวจสอบ"
                    : undefined;

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 className="text-xl font-semibold tracking-tight text-content-heading">
                        ตัวอย่างการนำเข้า · ชีต {ROUTINE_IMPORT_TARGET_SHEET}
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-content-secondary">
                        {batch.originalFileName} · hash {batch.fileHashPrefix} ·
                        อ้างอิงวันที่ {formatDate(batch.asOfDate)}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => void loadBatch()}
                        disabled={loading || applying}
                    >
                        <RefreshCw /> รีเฟรช
                    </Button>
                    {batch.status === "READY" || batch.status === "PREVIEW" ? (
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => void cancelBatch()}
                            disabled={applying}
                        >
                            <Trash2 /> ยกเลิกชุดนี้
                        </Button>
                    ) : null}
                    <Button
                        type="button"
                        variant="outline"
                        onClick={reset}
                        disabled={applying}
                    >
                        อัปโหลดไฟล์ใหม่
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-7">
                <SummaryItem label="อ่านได้ทั้งหมด" value={batch.totalRows} />
                <SummaryItem
                    label="พร้อมนำเข้า"
                    value={batch.validRows}
                    tone="success"
                />
                <SummaryItem
                    label="ต้อง map ผู้รับผิดชอบ"
                    value={batch.unresolvedOwnerRows}
                    tone="warning"
                />
                <SummaryItem
                    label="เคยนำเข้าแล้ว"
                    value={batch.alreadyImportedRows}
                />
                <SummaryItem
                    label="conflict"
                    value={batch.conflictRows}
                    tone="danger"
                />
                <SummaryItem
                    label="เลือกไว้สำหรับนำเข้า"
                    value={batch.selectedRows}
                    tone="success"
                />
                <SummaryItem label="ข้าม" value={batch.excludedRows} />
            </div>

            {batch.ignoredSheetNames.length > 0 ? (
                <div className="rounded-lg border border-status-warning-border bg-status-warning-surface px-4 py-3 text-sm leading-6 text-status-warning-foreground">
                    <p className="font-semibold">ชีตที่พบแต่ยังไม่เปิดใช้งาน</p>
                    <p className="mt-1">
                        {batch.ignoredSheetNames.join(" · ")}
                    </p>
                </div>
            ) : null}
            {error ? (
                <p
                    className="rounded-lg border border-status-danger-border bg-status-danger-surface px-4 py-3 text-sm leading-6 text-status-danger-foreground"
                    role="alert"
                >
                    {error}
                </p>
            ) : null}
            {completedWithReviewRows ? (
                <div
                    className="flex items-start gap-3 rounded-lg border border-status-warning-border bg-status-warning-surface px-4 py-3 text-sm leading-6 text-status-warning-foreground"
                    role="status"
                >
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                    <div className="min-w-0 flex-1">
                        <p className="font-semibold">
                            นำเข้ารายการที่พร้อมแล้ว แต่ยังมีรายการต้อง map
                        </p>
                        <p className="mt-1">
                            สร้างรายการ Routine แล้ว {batch.appliedRows} รายการ
                            และยังเหลือ {batch.reviewRows} รายการที่ต้องตรวจสอบ
                            ชุดเดิมปิดแล้วจึงแก้ไขต่อไม่ได้
                        </p>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-3"
                            onClick={reset}
                        >
                            <UploadCloud /> อัปโหลดไฟล์เดิมเพื่อ map ต่อ
                        </Button>
                    </div>
                </div>
            ) : batch.status === "COMPLETED" ? (
                <div className="flex items-start gap-3 rounded-lg border border-status-success-border bg-status-success-surface px-4 py-3 text-sm leading-6 text-status-success-foreground">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                    <div>
                        <p className="font-semibold">
                            นำเข้าชุดข้อมูลนี้เสร็จแล้ว
                        </p>
                        <p className="mt-1">
                            สร้างรายการ Routine แล้ว {batch.appliedRows} รายการ
                        </p>
                    </div>
                </div>
            ) : null}
            {!batchEditable && !completedWithReviewRows ? (
                <div
                    className="rounded-lg border border-status-warning-border bg-status-warning-surface px-4 py-3 text-sm leading-6 text-status-warning-foreground"
                    role="status"
                >
                    {readOnlyReason}
                </div>
            ) : null}
            {referenceError ? (
                <div
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-status-danger-border bg-status-danger-surface px-4 py-3 text-sm leading-6 text-status-danger-foreground"
                    role="alert"
                >
                    <span>
                        โหลดข้อมูลพนักงานสำหรับ map ไม่สำเร็จ: {referenceError}
                    </span>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void loadReference()}
                        disabled={referenceLoading}
                    >
                        <RefreshCw /> ลองโหลดข้อมูลพนักงานใหม่
                    </Button>
                </div>
            ) : null}

            <div className="grid gap-4 rounded-xl border border-border-subtle bg-surface-raised p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_180px_220px_auto_auto] lg:items-end">
                <label className="grid gap-1 text-sm font-medium text-content-body">
                    ค้นหา
                    <Input
                        value={search}
                        onChange={(event) => {
                            setSearch(event.target.value);
                            setPage(1);
                        }}
                        placeholder="รายการ หมวดงาน หรือผู้รับผิดชอบ"
                    />
                </label>
                <label className="grid gap-1 text-sm font-medium text-content-body">
                    สถานะ
                    <select
                        className="h-11 rounded-md border border-input bg-background px-3 text-sm"
                        value={filter}
                        onChange={(event) => {
                            setFilter(event.target.value as ImportFilter);
                            setPage(1);
                        }}
                    >
                        <option value="">ทุกสถานะ</option>
                        {Object.entries(STATUS_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="grid gap-1 text-sm font-medium text-content-body">
                    ประเด็น
                    <select
                        className="h-11 rounded-md border border-input bg-background px-3 text-sm"
                        value={issue}
                        onChange={(event) => {
                            setIssue(event.target.value as ImportIssue);
                            setPage(1);
                        }}
                    >
                        <option value="">ทุกประเด็น</option>
                        <option value="UNRESOLVED_OWNER">
                            ไม่มีผู้รับผิดชอบ / ยัง map ไม่ได้
                        </option>
                    </select>
                </label>
                <label className="flex h-11 items-center gap-2 text-sm font-medium text-content-body">
                    <input
                        type="checkbox"
                        checked={selectedOnly}
                        onChange={(event) => {
                            setSelectedOnly(event.target.checked);
                            setPage(1);
                        }}
                    />{" "}
                    เฉพาะที่เลือก
                </label>
                <p className="text-sm leading-6 text-content-secondary">
                    ผู้รับผิดชอบระบบ: {batch.uploadedBy.name}
                </p>
            </div>

            {loading ? (
                <LoadingState label="กำลังโหลดแถวข้อมูล..." compact />
            ) : rowsPage && rowsPage.rows.length === 0 ? (
                <EmptyState
                    compact
                    title="ไม่พบแถวตามตัวกรอง"
                    description="ลองเปลี่ยนตัวกรองหรือค้นหาคำอื่น"
                />
            ) : rowsPage ? (
                <div className="overflow-hidden rounded-xl border border-border-subtle bg-surface-raised">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[1100px] text-sm">
                            <thead className="bg-surface-subtle text-left text-sm text-content-secondary">
                                <tr>
                                    <th className="w-12 px-4 py-3 font-semibold">
                                        เลือก
                                    </th>
                                    <th className="px-4 py-3 font-semibold">
                                        แถว
                                    </th>
                                    <th className="px-4 py-3 font-semibold">
                                        หมวด / รายการ
                                    </th>
                                    <th className="px-4 py-3 font-semibold">
                                        ผู้รับผิดชอบ
                                    </th>
                                    <th className="px-4 py-3 font-semibold">
                                        กำหนดการ
                                    </th>
                                    <th className="px-4 py-3 font-semibold">
                                        สัญญา
                                    </th>
                                    <th className="px-4 py-3 font-semibold">
                                        สถานะ
                                    </th>
                                    <th className="px-4 py-3 font-semibold">
                                        จัดการ
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {rowsPage.rows.map((row) => {
                                    const terminal =
                                        row.status === "ALREADY_IMPORTED" ||
                                        row.status === "CONFLICT" ||
                                        row.status === "APPLIED";
                                    const editDisabled =
                                        terminal || !batchEditable || applying;
                                    const openingEditor =
                                        editorRow?.id === row.id &&
                                        !reference &&
                                        referenceLoading;
                                    return (
                                        <tr
                                            key={row.id}
                                            className="border-t border-border-subtle align-top"
                                        >
                                            <td className="px-4 py-4">
                                                <input
                                                    type="checkbox"
                                                    checked={row.selected}
                                                    disabled={
                                                        terminal ||
                                                        !batchEditable ||
                                                        row.status ===
                                                            "REQUIRES_REVIEW" ||
                                                        applying
                                                    }
                                                    onChange={(event) =>
                                                        void updateSelection(
                                                            row,
                                                            event.target
                                                                .checked,
                                                        )
                                                    }
                                                    aria-label={`เลือกแถว ${row.sourceRow}`}
                                                />
                                            </td>
                                            <td className="px-4 py-4 text-content-secondary">
                                                {row.sourceRow}
                                            </td>
                                            <td className="max-w-xs px-4 py-4">
                                                <p className="text-base font-semibold leading-6 text-content-heading">
                                                    {row.data.title}
                                                </p>
                                                <p className="mt-1 text-sm text-content-secondary">
                                                    {row.data.categoryName ||
                                                        "ไม่มีหมวด"}
                                                </p>
                                            </td>
                                            <td className="max-w-xs px-4 py-4">
                                                <p className="text-sm leading-6 text-content-body">
                                                    {row.data.ownerNames.join(
                                                        ", ",
                                                    ) || "ไม่พบชื่อ"}
                                                </p>
                                                <p className="mt-1 text-sm text-content-secondary">
                                                    {row.data.mappedEmployeeNames.join(
                                                        ", ",
                                                    ) || "ยังไม่ map"}
                                                </p>
                                            </td>
                                            <td className="max-w-xs px-4 py-4">
                                                <p className="text-sm text-content-secondary">
                                                    {row.data.scheduleText ||
                                                        "-"}
                                                </p>
                                                <p className="mt-1 break-all text-sm text-content-body">
                                                    {scheduleLabel(row)}
                                                </p>
                                            </td>
                                            <td className="max-w-xs px-4 py-4">
                                                <p className="text-sm text-content-body">
                                                    {row.data.contractText ||
                                                        "-"}
                                                </p>
                                                <p className="mt-1 text-sm text-content-secondary">
                                                    {formatDate(
                                                        row.data
                                                            .contractStartDate,
                                                    )}{" "}
                                                    –{" "}
                                                    {formatDate(
                                                        row.data
                                                            .contractEndDate,
                                                    )}
                                                </p>
                                            </td>
                                            <td className="px-4 py-4">
                                                <Badge
                                                    variant="outline"
                                                    className={
                                                        STATUS_CLASSES[
                                                            row.status
                                                        ]
                                                    }
                                                >
                                                    {rowStatusLabel(row)}
                                                </Badge>
                                                {row.reviewReasons.length >
                                                0 ? (
                                                    <ul className="mt-2 max-w-52 space-y-1 text-sm text-status-warning-foreground">
                                                        {row.reviewReasons
                                                            .slice(0, 2)
                                                            .map((reason) => (
                                                                <li
                                                                    key={reason}
                                                                >
                                                                    •{" "}
                                                                    {reviewLabel(
                                                                        reason,
                                                                    )}
                                                                </li>
                                                            ))}
                                                    </ul>
                                                ) : null}
                                            </td>
                                            <td className="px-4 py-4">
                                                <Button
                                                    type="button"
                                                    variant={
                                                        row.status === "REQUIRES_REVIEW"
                                                            ? "default"
                                                            : "outline"
                                                    }
                                                    size="sm"
                                                    disabled={editDisabled}
                                                    aria-busy={openingEditor}
                                                    title={
                                                        terminal
                                                            ? `แถวนี้อยู่ในสถานะ “${rowStatusLabel(row)}” จึงแก้ไขไม่ได้`
                                                            : !batchEditable || applying
                                                            ? readOnlyReason
                                                            : "แก้ไขข้อมูลและ map ผู้รับผิดชอบ"
                                                    }
                                                    onClick={() => {
                                                        setEditorRow(row);
                                                        if (!reference) void loadReference();
                                                    }}
                                                >
                                                    {openingEditor ? (
                                                        <>
                                                            <RefreshCw className="animate-spin" />
                                                            กำลังเปิดตัวแก้ไข...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Pencil /> แก้ไขและ map ผู้รับผิดชอบ
                                                        </>
                                                    )}
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {currentPage ? (
                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle px-4 py-3 text-sm">
                            <span className="text-content-secondary">
                                หน้า {currentPage.page} / {currentPage.pages} ·
                                ทั้งหมด {currentPage.total} แถว
                            </span>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={currentPage.page <= 1 || loading}
                                    onClick={() =>
                                        setPage((value) => value - 1)
                                    }
                                >
                                    ก่อนหน้า
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={
                                        currentPage.page >= currentPage.pages ||
                                        loading
                                    }
                                    onClick={() =>
                                        setPage((value) => value + 1)
                                    }
                                >
                                    ถัดไป
                                </Button>
                            </div>
                        </div>
                    ) : null}
                </div>
            ) : null}

            <div className="sticky bottom-3 z-10 flex flex-col gap-3 rounded-xl border border-border-subtle bg-surface-raised/95 p-4 shadow-md backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm">
                    <p className="text-base font-semibold text-content-heading">
                        เลือกไว้สำหรับนำเข้า {batch.selectedRows} รายการ
                    </p>
                    <p className="mt-1 text-sm leading-6 text-content-secondary">
                        พร้อมนำเข้า {batch.validRows} · ยังต้องตรวจสอบ{" "}
                        {batch.reviewRows} · ข้าม {batch.excludedRows}
                    </p>
                    {batchEditable && !canApply && applyDisabledReason ? (
                        <p
                            className="mt-2 text-sm font-medium text-status-warning-foreground"
                            role="status"
                        >
                            {applyDisabledReason}
                        </p>
                    ) : null}
                </div>
                <Button
                    type="button"
                    onClick={() => setConfirmOpen(true)}
                    disabled={!canApply}
                    title={applyDisabledReason}
                >
                    <Check /> ยืนยันและนำเข้า
                </Button>
            </div>

            {reference ? (
                <RoutineImportRowEditor
                    batchId={batch.id}
                    row={editorRow}
                    reference={reference}
                    open={editorRow !== null}
                    disabled={!batchEditable || applying}
                    readOnlyReason={readOnlyReason}
                    onOpenChange={(open) => {
                        if (!open) setEditorRow(null);
                    }}
                    onSaved={(savedRow) => {
                        setEditorRow(savedRow);
                        void loadBatch();
                    }}
                    onConflict={async () => {
                        setEditorRow(null);
                        await loadBatch();
                    }}
                />
            ) : null}

            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            ยืนยันการนำเข้าข้อมูล
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            กำลังจะนำเข้าข้อมูลจากชีต{" "}
                            {ROUTINE_IMPORT_TARGET_SHEET}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="rounded-lg bg-surface-subtle p-4 text-sm text-content-body">
                        <p>
                            รายการที่เลือก:{" "}
                            <strong>{batch.selectedRows}</strong>
                        </p>
                        <p>
                            พร้อมนำเข้า: <strong>{batch.validRows}</strong>
                        </p>
                        <p>
                            ยัง map ผู้รับผิดชอบไม่ครบ:{" "}
                            <strong>{batch.unresolvedOwnerRows}</strong>
                        </p>
                        <p>
                            ข้าม: <strong>{batch.excludedRows}</strong>
                        </p>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={applying}>
                            กลับไปตรวจสอบ
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(event) => {
                                event.preventDefault();
                                void apply();
                            }}
                            disabled={applying}
                        >
                            ยืนยันการนำเข้า
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
