"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle, ChevronLeft, ChevronRight, Loader2, Pencil, XCircle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    formatEmployeePhone,
    getEmployeeDepartmentBadgeClass,
    getEmployeeDisplayName,
} from "../dashboard/formatters";
import { getEmployeeImportDepartmentCode } from "../../domain/import-values";
import { validateEmployeeImportRows } from "./csv";
import type {
    CSVEmployee,
    CSVEmployeeRowValidation,
    PreviewStepProps,
} from "./types";

const PREVIEW_PAGE_SIZE = 25;

const EDITABLE_FIELDS = [
    { key: "firstName", label: "ชื่อ", type: "text" },
    { key: "lastName", label: "นามสกุล", type: "text" },
    { key: "email", label: "อีเมล", type: "email" },
    { key: "phone", label: "เบอร์โทรศัพท์", type: "tel" },
    { key: "position", label: "ตำแหน่ง", type: "text" },
    { key: "department", label: "แผนก", type: "text" },
    { key: "affiliation", label: "สังกัด", type: "text" },
    { key: "nickname", label: "ชื่อเล่น", type: "text" },
    { key: "status", label: "สถานะ", type: "text" },
] as const satisfies ReadonlyArray<{
    key: Exclude<keyof CSVEmployee, "sourceRow">;
    label: string;
    type: string;
}>;

function getIssueMap(
    validations: CSVEmployeeRowValidation[],
): Map<number, CSVEmployeeRowValidation["issues"]> {
    return new Map(validations.map((validation) => [validation.index, validation.issues]));
}

function getFieldValue(
    employee: CSVEmployee,
    field: Exclude<keyof CSVEmployee, "sourceRow">,
): string {
    return employee[field] ?? "";
}

function RowValidationMessage({
    issues,
}: {
    issues: CSVEmployeeRowValidation["issues"];
}) {
    if (issues.length === 0) return null;

    return (
        <ul className="mt-2 space-y-1 text-sm leading-5 text-status-error-foreground">
            {issues.map((issue, index) => (
                <li key={index}>
                    {EDITABLE_FIELDS.find((field) => field.key === issue.field)?.label}: {issue.message}
                </li>
            ))}
        </ul>
    );
}

function getEmployeeSummary(employee: CSVEmployee): Array<[string, string]> {
    const summary: Array<[string, string]> = [
        ["อีเมล", employee.email?.trim() ?? ""],
        ["ตำแหน่ง", employee.position.trim()],
        ["แผนก", employee.department.trim()],
        ["สังกัด", employee.affiliation?.trim() ?? ""],
        ["เบอร์โทร", employee.phone?.trim() ?? ""],
        ["ชื่อเล่น", employee.nickname?.trim() ?? ""],
        ["สถานะ", employee.status?.trim() ?? ""],
    ];
    return summary.filter(([, value]) => value !== "");
}

export function PreviewStep({
    parsedData,
    error,
    isLoading,
    onUpdateEmployee,
    onResetUpload,
    onImport,
}: PreviewStepProps) {
    const [currentPage, setCurrentPage] = useState(1);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [draft, setDraft] = useState<CSVEmployee | null>(null);
    const validations = validateEmployeeImportRows(parsedData);
    const issuesByIndex = getIssueMap(validations);
    const pageCount = Math.max(1, Math.ceil(parsedData.length / PREVIEW_PAGE_SIZE));
    const pageStartIndex = (currentPage - 1) * PREVIEW_PAGE_SIZE;
    const visibleRows = parsedData.slice(pageStartIndex, pageStartIndex + PREVIEW_PAGE_SIZE);
    const validRowCount = parsedData.length - validations.length;
    const sourceRowFor = (employee: CSVEmployee, index: number): number =>
        employee.sourceRow ?? pageStartIndex + index + 2;

    const openEditor = (index: number, employee: CSVEmployee): void => {
        setEditingIndex(index);
        setDraft({ ...employee });
    };

    const closeEditor = (): void => {
        setEditingIndex(null);
        setDraft(null);
    };

    const saveDraft = (): void => {
        if (draft === null || editingIndex === null) return;
        onUpdateEmployee(editingIndex, {
            ...draft,
            sourceRow: parsedData[editingIndex]?.sourceRow ?? draft.sourceRow,
        });
        closeEditor();
    };

    const editingIssues = editingIndex === null
        ? []
        : issuesByIndex.get(editingIndex) ?? [];

    return (
        <Card className="rounded-2xl border-border-subtle bg-surface-raised shadow-sm">
            <CardHeader>
                <CardTitle className="text-xl font-bold text-content-heading">
                    ตรวจสอบข้อมูลก่อนนำเข้า
                </CardTitle>
                <CardDescription className="text-sm leading-6 text-content-secondary [overflow-wrap:anywhere]">
                    ตรวจและแก้ไขข้อมูลได้ก่อนส่ง ระบบจะตรวจข้อมูลซ้ำกับฐานข้อมูลอีกครั้งตอนนำเข้า
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
                <div
                    className="grid grid-cols-1 gap-3 rounded-xl border border-border-subtle bg-surface-neutral-subtle p-4 sm:grid-cols-3"
                    role="group"
                    aria-label="สรุปการตรวจสอบข้อมูล"
                    aria-live="polite"
                >
                    <p className="text-sm text-content-secondary">
                        ทั้งหมด <strong className="text-content-heading">{parsedData.length.toLocaleString("th-TH")}</strong> แถว
                    </p>
                    <p className="text-sm text-content-secondary">
                        ผ่านการตรวจเบื้องต้น <strong className="text-content-heading">{validRowCount.toLocaleString("th-TH")}</strong> แถว
                    </p>
                    <p className={validations.length > 0 ? "text-sm text-status-error-foreground" : "text-sm text-content-secondary"}>
                        ต้องแก้ไข <strong>{validations.length.toLocaleString("th-TH")}</strong> แถว
                    </p>
                </div>

                {validations.length > 0 ? (
                    <Alert className="border-status-error-border bg-status-error-surface">
                        <AlertCircle className="h-4 w-4 text-status-error-icon" />
                        <AlertTitle className="text-status-error-strong">
                            แก้ไขแถวที่มีข้อความแจ้งก่อนนำเข้า
                        </AlertTitle>
                        <AlertDescription className="text-status-error-foreground">
                            เปิดดูเหตุผลใต้แต่ละรายการ แล้วเลือก “แก้ไขข้อมูล” ข้อมูลที่พบซ้ำกับฐานข้อมูลจะแจ้งหลังส่งตรวจโดยระบบ
                        </AlertDescription>
                    </Alert>
                ) : (
                    <div className="rounded-xl border border-status-positive-border bg-status-positive-surface px-4 py-3 text-sm leading-6 text-status-positive-foreground">
                        ผ่านการตรวจข้อมูลในไฟล์เบื้องต้นแล้ว การตรวจข้อมูลซ้ำกับพนักงานในระบบยังเป็นผลจากเซิร์ฟเวอร์
                    </div>
                )}

                <div className="hidden overflow-auto overscroll-x-contain rounded-lg border border-border-subtle md:block">
                    <table className="min-w-[900px] divide-y divide-border-neutral-default">
                        <caption className="sr-only">รายการพนักงานสำหรับตรวจและแก้ไขก่อนนำเข้า</caption>
                        <thead className="sticky top-0 z-10 bg-surface-neutral-subtle">
                            <tr>
                                {[
                                    "แถว CSV",
                                    "ชื่อ-นามสกุล",
                                    "อีเมล",
                                    "ตำแหน่ง",
                                    "แผนก",
                                    "เบอร์โทร",
                                    "ชื่อเล่น",
                                    "การตรวจสอบ",
                                    "การทำงาน",
                                ].map((label) => (
                                    <th
                                        key={label}
                                        scope="col"
                                        className="px-3 py-3 text-left text-xs font-medium text-content-neutral-secondary"
                                    >
                                        {label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-neutral-default bg-surface-raised">
                            {visibleRows.map((employee, index) => {
                                const rowIndex = pageStartIndex + index;
                                const sourceRow = sourceRowFor(employee, index);
                                const rowIssues = issuesByIndex.get(rowIndex) ?? [];
                                const departmentCode = getEmployeeImportDepartmentCode(employee.department);
                                const departmentLabel = departmentCode === "ADMIN"
                                    ? "บริหาร"
                                    : departmentCode === "ACADEMIC"
                                        ? "วิชาการ"
                                        : employee.department || "-";

                                return (
                                    <tr key={sourceRow} className="align-top hover:bg-surface-neutral-subtle">
                                        <td className="tabular-nums px-3 py-4 text-sm text-content-neutral-primary">
                                            {sourceRow}
                                        </td>
                                        <td className="max-w-48 px-3 py-4 text-sm font-medium text-content-neutral-primary [overflow-wrap:anywhere]">
                                            {getEmployeeDisplayName(employee) || "-"}
                                        </td>
                                        <td className="max-w-52 px-3 py-4 text-sm text-content-neutral-secondary [overflow-wrap:anywhere]">
                                            {employee.email || "-"}
                                        </td>
                                        <td className="max-w-48 px-3 py-4 text-sm text-content-neutral-secondary [overflow-wrap:anywhere]">
                                            {employee.position || "-"}
                                        </td>
                                        <td className="px-3 py-4 text-sm">
                                            <Badge
                                                variant="outline"
                                                className={departmentCode
                                                    ? getEmployeeDepartmentBadgeClass(employee.department)
                                                    : "border-status-error-border bg-status-error-surface text-status-error-foreground"}
                                            >
                                                {departmentLabel}
                                            </Badge>
                                        </td>
                                        <td className="tabular-nums max-w-36 px-3 py-4 text-sm text-content-neutral-secondary [overflow-wrap:anywhere]">
                                            {formatEmployeePhone(employee.phone)}
                                        </td>
                                        <td className="max-w-36 px-3 py-4 text-sm text-content-neutral-secondary [overflow-wrap:anywhere]">
                                            {employee.nickname || "-"}
                                        </td>
                                        <td className="min-w-56 px-3 py-4">
                                            {rowIssues.length > 0 ? (
                                                <RowValidationMessage issues={rowIssues} />
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-sm text-status-positive-foreground">
                                                    <CheckCircle className="h-4 w-4" />
                                                    ผ่านเบื้องต้น
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-3 py-4">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="min-h-11 gap-2"
                                                aria-label={"แก้ไขข้อมูลแถว CSV ที่ " + sourceRow}
                                                disabled={isLoading}
                                                onClick={() => openEditor(rowIndex, employee)}
                                            >
                                                <Pencil className="h-4 w-4" />
                                                แก้ไขข้อมูล
                                            </Button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="space-y-3 md:hidden">
                    {visibleRows.map((employee, index) => {
                        const rowIndex = pageStartIndex + index;
                        const sourceRow = sourceRowFor(employee, index);
                        const rowIssues = issuesByIndex.get(rowIndex) ?? [];

                        return (
                            <article
                                key={sourceRow}
                                className="rounded-xl border border-border-subtle bg-surface-raised p-4"
                                aria-labelledby={"employee-import-row-" + sourceRow}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-xs text-content-secondary">แถว CSV ที่ {sourceRow}</p>
                                        <h3
                                            id={"employee-import-row-" + sourceRow}
                                            className="mt-1 font-medium text-content-heading [overflow-wrap:anywhere]"
                                        >
                                            {getEmployeeDisplayName(employee) || "ยังไม่มีชื่อ"}
                                        </h3>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="min-h-11 shrink-0 gap-2"
                                        aria-label={"แก้ไขข้อมูลแถว CSV ที่ " + sourceRow}
                                        disabled={isLoading}
                                        onClick={() => openEditor(rowIndex, employee)}
                                    >
                                        <Pencil className="h-4 w-4" />
                                        แก้ไข
                                    </Button>
                                </div>
                                <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
                                    {getEmployeeSummary(employee).map(([label, value]) => (
                                        <div key={label} className="min-w-0">
                                            <dt className="text-xs text-content-secondary">{label}</dt>
                                            <dd className="mt-0.5 break-words text-content-neutral-primary">{value}</dd>
                                        </div>
                                    ))}
                                </dl>
                                {rowIssues.length > 0 ? (
                                    <div className="mt-3 rounded-lg border border-status-error-border bg-status-error-surface p-3">
                                        <p className="text-sm font-medium text-status-error-strong">ต้องแก้ไขข้อมูล</p>
                                        <RowValidationMessage issues={rowIssues} />
                                    </div>
                                ) : null}
                            </article>
                        );
                    })}
                </div>

                <nav
                    className="flex flex-col gap-3 border-t border-border-subtle pt-4 sm:flex-row sm:items-center sm:justify-between"
                    aria-label="แบ่งหน้ารายการพนักงานนำเข้า"
                >
                    <p className="text-sm text-content-secondary" aria-live="polite">
                        แสดงแถว {parsedData.length === 0 ? 0 : pageStartIndex + 1}–{Math.min(pageStartIndex + visibleRows.length, parsedData.length)} จาก {parsedData.length.toLocaleString("th-TH")} แถว
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            className="min-h-11"
                            disabled={currentPage <= 1 || isLoading}
                            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                        >
                            <ChevronLeft className="h-4 w-4" />
                            หน้าก่อน
                        </Button>
                        <span className="min-w-20 text-center text-sm text-content-secondary" aria-current="page">
                            หน้า {currentPage} / {pageCount}
                        </span>
                        <Button
                            type="button"
                            variant="outline"
                            className="min-h-11"
                            disabled={currentPage >= pageCount || isLoading}
                            onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))}
                        >
                            หน้าถัดไป
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </nav>

                {error ? (
                    <Alert className="border-status-error-border bg-status-error-surface" aria-live="assertive">
                        <XCircle className="h-4 w-4 text-status-error-muted" />
                        <AlertTitle className="text-status-error-strong">
                            นำเข้าข้อมูลไม่สำเร็จ
                        </AlertTitle>
                        <AlertDescription className="whitespace-pre-line text-status-error-foreground [overflow-wrap:anywhere]">
                            {error}
                        </AlertDescription>
                    </Alert>
                ) : null}

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onResetUpload}
                        disabled={isLoading}
                    >
                        เลือกไฟล์ใหม่
                    </Button>
                    <Button
                        type="button"
                        onClick={onImport}
                        disabled={isLoading || parsedData.length === 0 || validations.length > 0}
                        className="h-11 justify-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>กำลังนำเข้า...</span>
                            </>
                        ) : validations.length > 0 ? (
                            <span>แก้ไข {validations.length.toLocaleString("th-TH")} แถวก่อนนำเข้า</span>
                        ) : (
                            <>
                                <CheckCircle className="h-4 w-4" />
                                <span>นำเข้าข้อมูล {parsedData.length.toLocaleString("th-TH")} แถว</span>
                            </>
                        )}
                    </Button>
                </div>
            </CardContent>

            <Dialog open={draft !== null} onOpenChange={(open) => !open && closeEditor()}>
                <DialogContent className="sm:max-w-2xl" scrollMode="content">
                    <DialogHeader>
                        <DialogTitle className="text-content-heading">
                            แก้ไขข้อมูลพนักงาน
                        </DialogTitle>
                        <DialogDescription className="leading-6">
                            {editingIndex === null
                                ? ""
                                : "แถว CSV ที่ "
                                    + (parsedData[editingIndex]?.sourceRow ?? editingIndex + 2)
                                    + " · บันทึกการแก้ไขในตัวอย่างก่อนนำเข้า"}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {draft ? EDITABLE_FIELDS.map(({ key, label, type }) => {
                            const fieldIssues = editingIssues
                                .filter((issue) => issue.field === key)
                                .map((issue) => issue.message);
                            const errorId = "employee-import-" + key + "-error";

                            return (
                                <div key={key} className="space-y-2">
                                    <Label htmlFor={"employee-import-" + key} className="text-content-secondary">
                                        {label}
                                    </Label>
                                    <Input
                                        id={"employee-import-" + key}
                                        type={type}
                                        value={getFieldValue(draft, key)}
                                        aria-invalid={fieldIssues.length > 0}
                                        aria-describedby={fieldIssues.length > 0 ? errorId : undefined}
                                        autoComplete={key === "email" ? "email" : key === "phone" ? "tel" : "off"}
                                        onChange={(event) => setDraft((current) => current
                                            ? { ...current, [key]: event.target.value }
                                            : current)}
                                    />
                                    {fieldIssues.length > 0 ? (
                                        <ul id={errorId} className="space-y-1 text-sm leading-5 text-status-error-foreground">
                                            {fieldIssues.map((message, index) => (
                                                <li key={index}>{message}</li>
                                            ))}
                                        </ul>
                                    ) : null}
                                </div>
                            );
                        }) : null}
                    </div>
                    <DialogFooter className="gap-2 sm:gap-2">
                        <Button type="button" variant="outline" className="min-h-11" onClick={closeEditor}>
                            ยกเลิก
                        </Button>
                        <Button type="button" className="min-h-11" onClick={saveDraft}>
                            บันทึกการแก้ไข
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
