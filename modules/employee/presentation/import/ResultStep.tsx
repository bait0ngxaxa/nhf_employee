"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle, ChevronLeft, ChevronRight, Download, RotateCcw, XCircle } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { downloadFailedRowsCSV } from "./csv";
import { type ImportError, type ResultStepProps } from "./types";

const ERROR_PAGE_SIZE = 25;

function getRejectedValues(error: ImportError): Array<[string, string]> {
    const values: Array<[string, string]> = [
        ["ชื่อ", error.data.firstName ?? ""],
        ["นามสกุล", error.data.lastName ?? ""],
        ["อีเมล", error.data.email ?? ""],
        ["เบอร์โทร", error.data.phone ?? ""],
        ["ตำแหน่ง", error.data.position ?? ""],
        ["แผนก", error.data.department ?? ""],
        ["สังกัด", error.data.affiliation ?? ""],
        ["ชื่อเล่น", error.data.nickname ?? ""],
        ["สถานะ", error.data.status ?? ""],
    ];

    return values.filter(([, value]) => value.trim() !== "");
}

export function ResultStep({
    importResult,
    isRetryAttempt,
    onResetUpload,
    onRetryFailedRows,
    onBack,
}: ResultStepProps) {
    const [currentPage, setCurrentPage] = useState(1);
    const [exportError, setExportError] = useState("");
    const importedCount = importResult.success.length;
    const rejectedCount = importResult.errors.length;
    const attemptedCount = importedCount + rejectedCount;
    const pageCount = Math.max(1, Math.ceil(rejectedCount / ERROR_PAGE_SIZE));
    const visibleErrors = importResult.errors.slice(
        (currentPage - 1) * ERROR_PAGE_SIZE,
        currentPage * ERROR_PAGE_SIZE,
    );

    const exportErrors = (): void => {
        try {
            downloadFailedRowsCSV(importResult.errors);
            setExportError("");
        } catch {
            setExportError("ดาวน์โหลดไฟล์รายการที่ไม่สำเร็จไม่ได้ กรุณาลองอีกครั้ง");
        }
    };

    return (
        <div className="space-y-6">
            <Card className="rounded-2xl border-border-subtle bg-surface-raised shadow-sm">
                <CardHeader>
                    <CardTitle className="flex min-w-0 items-center gap-2 text-xl font-bold text-content-heading">
                        {rejectedCount === 0
                            ? <CheckCircle className="h-5 w-5 shrink-0 text-status-positive-foreground" />
                            : <AlertTriangle className="h-5 w-5 shrink-0 text-status-error-icon" />}
                        <span>
                            {isRetryAttempt
                                ? "ผลการนำเข้าเฉพาะแถวที่แก้ไข"
                                : rejectedCount === 0
                                    ? "นำเข้าข้อมูลสำเร็จ"
                                    : "นำเข้าสำเร็จบางรายการ"}
                        </span>
                    </CardTitle>
                    <CardDescription className="text-sm leading-6 text-content-secondary [overflow-wrap:anywhere]">
                        {isRetryAttempt
                            ? "ผลรอบนี้นับเฉพาะแถวที่ไม่สำเร็จจากครั้งก่อน จำนวน "
                                + attemptedCount.toLocaleString("th-TH")
                                + " รายการ"
                            : "ผลการตรวจรอบนี้ทั้งหมด "
                                + attemptedCount.toLocaleString("th-TH")
                                + " รายการ"}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="rounded-lg border border-border-subtle bg-surface-neutral-subtle p-4">
                            <p className="text-2xl font-bold tabular-nums text-content-heading">
                                {attemptedCount.toLocaleString("th-TH")}
                            </p>
                            <p className="text-sm text-content-secondary">ตรวจในรอบนี้</p>
                        </div>
                        <div className="rounded-lg border border-status-positive-border bg-status-positive-surface p-4">
                            <p className="text-2xl font-bold tabular-nums text-status-positive-foreground">
                                {importedCount.toLocaleString("th-TH")}
                            </p>
                            <p className="text-sm text-status-positive-foreground">นำเข้าสำเร็จ</p>
                        </div>
                        <div className="rounded-lg border border-status-error-border bg-status-error-surface p-4">
                            <p className="text-2xl font-bold tabular-nums text-status-error-foreground">
                                {rejectedCount.toLocaleString("th-TH")}
                            </p>
                            <p className="text-sm text-status-error-foreground">ไม่สำเร็จ</p>
                        </div>
                    </div>
                    {isRetryAttempt ? (
                        <p className="text-sm leading-6 text-content-secondary">
                            รายการที่นำเข้าสำเร็จในครั้งก่อนจะไม่ถูกส่งซ้ำ
                        </p>
                    ) : null}
                </CardContent>
            </Card>

            {rejectedCount > 0 ? (
                <Card className="rounded-2xl border-status-error-border bg-surface-raised shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex min-w-0 items-center gap-2 text-xl font-bold text-status-error-foreground">
                            <AlertTriangle className="h-5 w-5 shrink-0" />
                            <span>รายการที่นำเข้าไม่สำเร็จ</span>
                        </CardTitle>
                        <CardDescription className="text-sm leading-6 text-status-error-foreground [overflow-wrap:anywhere]">
                            แสดงแถว CSV ต้นฉบับพร้อมเหตุผลและค่าที่ส่ง ระบบจะแจ้งข้อมูลซ้ำกับฐานข้อมูลจากผลฝั่งเซิร์ฟเวอร์
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-sm text-content-secondary" aria-live="polite">
                                แสดง {((currentPage - 1) * ERROR_PAGE_SIZE + 1).toLocaleString("th-TH")}–{Math.min(currentPage * ERROR_PAGE_SIZE, rejectedCount).toLocaleString("th-TH")} จาก {rejectedCount.toLocaleString("th-TH")} แถวที่ไม่สำเร็จ
                            </p>
                            <Button
                                type="button"
                                variant="outline"
                                className="min-h-11 gap-2"
                                onClick={exportErrors}
                            >
                                <Download className="h-4 w-4" />
                                ดาวน์โหลดทุกรายการที่ไม่สำเร็จ
                            </Button>
                        </div>

                        {exportError ? (
                            <Alert className="border-status-error-border bg-status-error-surface" role="alert">
                                <XCircle className="h-4 w-4 text-status-error-icon" />
                                <AlertDescription className="text-status-error-foreground">
                                    {exportError}
                                </AlertDescription>
                            </Alert>
                        ) : null}

                        <ol className="space-y-3" aria-label="รายละเอียดแถวที่นำเข้าไม่สำเร็จ">
                            {visibleErrors.map((error, index) => {
                                const originalValues = getRejectedValues(error);
                                const errorIndex = (currentPage - 1) * ERROR_PAGE_SIZE + index;

                                return (
                                    <li
                                        key={error.row + "-" + errorIndex}
                                        className="rounded-xl border border-status-error-border bg-status-error-surface p-4"
                                    >
                                        <div className="flex items-start gap-3">
                                            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-status-error-icon" />
                                            <div className="min-w-0 flex-1">
                                                <h3 className="font-medium text-status-error-strong">
                                                    แถว CSV ที่ {error.row}
                                                </h3>
                                                <p className="mt-1 text-sm leading-6 text-status-error-foreground [overflow-wrap:anywhere]">
                                                    {error.error}
                                                </p>
                                                <div className="mt-3">
                                                    <p className="text-xs font-medium text-status-error-strong">
                                                        ค่าที่ส่งจากแถวนี้
                                                    </p>
                                                    {originalValues.length > 0 ? (
                                                        <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
                                                            {originalValues.map(([label, value]) => (
                                                                <div key={label} className="min-w-0">
                                                                    <dt className="text-xs text-status-error-muted">{label}</dt>
                                                                    <dd className="mt-0.5 break-words text-status-error-foreground">{value}</dd>
                                                                </div>
                                                            ))}
                                                        </dl>
                                                    ) : (
                                                        <p className="mt-1 text-sm text-status-error-foreground">
                                                            ไม่มีค่าต้นฉบับในผลตอบกลับของเซิร์ฟเวอร์
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ol>

                        {pageCount > 1 ? (
                            <nav
                                className="flex items-center justify-between border-t border-border-subtle pt-4"
                                aria-label="แบ่งหน้ารายการที่นำเข้าไม่สำเร็จ"
                            >
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="min-h-11"
                                    disabled={currentPage <= 1}
                                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                    หน้าก่อน
                                </Button>
                                <span className="text-sm text-content-secondary" aria-current="page">
                                    หน้า {currentPage} / {pageCount}
                                </span>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="min-h-11"
                                    disabled={currentPage >= pageCount}
                                    onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))}
                                >
                                    หน้าถัดไป
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </nav>
                        ) : null}

                        <div className="rounded-xl border border-action-primary-border-subtle bg-action-primary-surface p-4">
                            <p className="text-sm leading-6 text-action-primary-emphasis">
                                ตรวจแก้แล้วส่งใหม่ได้เฉพาะ {rejectedCount.toLocaleString("th-TH")} แถวที่ไม่สำเร็จ รายการที่นำเข้าสำเร็จแล้วจะไม่รวมอยู่ในรอบถัดไป
                            </p>
                            <Button
                                type="button"
                                className="mt-3 min-h-11 gap-2"
                                onClick={onRetryFailedRows}
                            >
                                <RotateCcw className="h-4 w-4" />
                                แก้ไขและนำเข้าเฉพาะแถวที่ไม่สำเร็จ
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ) : null}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Button type="button" variant="outline" onClick={onResetUpload}>
                    นำเข้าไฟล์ใหม่
                </Button>
                {onBack ? (
                    <Button
                        type="button"
                        onClick={onBack}
                        className="h-11 justify-center"
                    >
                        <span>กลับไปหน้าจัดการพนักงาน</span>
                    </Button>
                ) : null}
            </div>
        </div>
    );
}
