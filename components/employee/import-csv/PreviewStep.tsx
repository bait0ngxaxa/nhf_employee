"use client";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getEmployeeDisplayName } from "@/lib/helpers/employee-helpers";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    formatEmployeePhone,
    getEmployeeDepartmentBadgeClass,
    getEmployeeDepartmentLabel,
} from "@/lib/helpers/employee-helpers";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { type PreviewStepProps } from "./types";

const PREVIEW_ROW_LIMIT = 100;

export function PreviewStep({
    parsedData,
    error,
    isLoading,
    onResetUpload,
    onImport,
}: PreviewStepProps) {
    const visibleRows = parsedData.slice(0, PREVIEW_ROW_LIMIT);
    const hiddenRowCount = Math.max(0, parsedData.length - visibleRows.length);

    return (
        <Card className="rounded-2xl border-border-subtle bg-surface-raised shadow-sm">
            <CardHeader>
                <CardTitle className="text-xl font-bold text-content-heading">
                    ตรวจสอบข้อมูลก่อนนำเข้า
                </CardTitle>
                <CardDescription className="text-sm leading-6 text-content-secondary [overflow-wrap:anywhere]">
                    พบข้อมูล {parsedData.length.toLocaleString("th-TH")} รายการ
                    กรุณาตรวจสอบความถูกต้องก่อนทำการนำเข้า
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900 [overflow-wrap:anywhere]">
                    แสดงตัวอย่าง {visibleRows.length.toLocaleString("th-TH")} รายการแรก
                    {hiddenRowCount > 0
                        ? ` ยังมีอีก ${hiddenRowCount.toLocaleString("th-TH")} รายการที่จะถูกนำเข้าพร้อมกัน`
                        : ""}
                </div>

                <div className="max-h-96 overflow-auto rounded-lg border border-border-subtle">
                    <table className="min-w-[920px] divide-y divide-border-neutral-default">
                        <thead className="sticky top-0 z-10 bg-surface-neutral-subtle">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-content-neutral-secondary">
                                    ลำดับ
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-content-neutral-secondary">
                                    ชื่อ-นามสกุล
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-content-neutral-secondary">
                                    อีเมล
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-content-neutral-secondary">
                                    ตำแหน่ง
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-content-neutral-secondary">
                                    แผนก
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-content-neutral-secondary">
                                    เบอร์โทร
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-content-neutral-secondary">
                                    ชื่อเล่น
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-neutral-default bg-surface-raised">
                            {visibleRows.map((employee, index) => (
                                <tr
                                    key={employee.sourceRow ?? index}
                                    className="hover:bg-surface-neutral-subtle"
                                >
                                    <td className="px-4 py-4 text-sm text-content-neutral-primary">
                                        {employee.sourceRow ?? index + 1}
                                    </td>
                                    <td className="max-w-56 px-4 py-4 text-sm font-medium text-content-neutral-primary [overflow-wrap:anywhere]">
                                        {getEmployeeDisplayName(employee) || "-"}
                                    </td>
                                    <td className="max-w-64 px-4 py-4 text-sm text-content-neutral-secondary [overflow-wrap:anywhere]">
                                        {employee.email || "-"}
                                    </td>
                                    <td className="max-w-56 px-4 py-4 text-sm text-content-neutral-secondary [overflow-wrap:anywhere]">
                                        {employee.position || "-"}
                                    </td>
                                    <td className="max-w-52 px-4 py-4 text-sm">
                                        <Badge
                                            variant="outline"
                                            className={`${getEmployeeDepartmentBadgeClass(employee.department)} max-w-full px-2.5 font-medium [overflow-wrap:anywhere]`}
                                        >
                                            {getEmployeeDepartmentLabel(employee.department)}
                                        </Badge>
                                    </td>
                                    <td className="max-w-40 px-4 py-4 text-sm text-content-neutral-secondary [overflow-wrap:anywhere]">
                                        {formatEmployeePhone(employee.phone)}
                                    </td>
                                    <td className="max-w-44 px-4 py-4 text-sm text-content-neutral-secondary">
                                        {employee.nickname?.trim() ? (
                                            <Badge variant="secondary" className="max-w-full border border-violet-200/60 bg-violet-50 px-2.5 font-medium text-violet-700 hover:bg-violet-100 [overflow-wrap:anywhere]">
                                                {employee.nickname.trim()}
                                            </Badge>
                                        ) : (
                                            "-"
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {error && (
                    <Alert className="border-red-200 bg-red-50" aria-live="assertive">
                        <XCircle className="h-4 w-4 text-red-600" />
                        <AlertTitle className="text-red-800">
                            นำเข้าข้อมูลไม่สำเร็จ
                        </AlertTitle>
                        <AlertDescription className="whitespace-pre-line text-red-700 [overflow-wrap:anywhere]">
                            {error}
                        </AlertDescription>
                    </Alert>
                )}

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
                        disabled={isLoading || parsedData.length === 0}
                        className="h-11 justify-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>กำลังนำเข้า...</span>
                            </>
                        ) : (
                            <>
                                <CheckCircle className="h-4 w-4" />
                                <span>
                                    นำเข้าข้อมูล ({parsedData.length} รายการ)
                                </span>
                            </>
                        )}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
