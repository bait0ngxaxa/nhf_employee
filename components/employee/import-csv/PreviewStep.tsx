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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    formatEmployeePhone,
    getEmployeeDepartmentBadgeClass,
    getEmployeeDepartmentLabel,
} from "@/lib/helpers/employee-helpers";
import { FileText, CheckCircle, Loader2, XCircle } from "lucide-react";
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
        <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
            <CardHeader>
                <CardTitle className="flex min-w-0 items-center gap-2 text-xl font-bold text-slate-950">
                    <FileText className="h-5 w-5 shrink-0" />
                    <span>ตรวจสอบข้อมูลก่อนนำเข้า</span>
                </CardTitle>
                <CardDescription className="text-sm leading-6 text-slate-600 [overflow-wrap:anywhere]">
                    พบข้อมูลพนักงาน {parsedData.length.toLocaleString("th-TH")} คน
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

                <div className="max-h-96 overflow-auto rounded-lg border border-slate-200">
                    <table className="min-w-[920px] divide-y divide-gray-200">
                        <thead className="sticky top-0 z-10 bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                                    ลำดับ
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                                    ชื่อ-นามสกุล
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                                    อีเมล
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                                    ตำแหน่ง
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                                    แผนก
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                                    เบอร์โทร
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">
                                    ชื่อเล่น
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {visibleRows.map((employee, index) => (
                                <tr key={index} className="hover:bg-gray-50">
                                    <td className="px-4 py-4 text-sm text-gray-900">
                                        {index + 1}
                                    </td>
                                    <td className="max-w-56 px-4 py-4 text-sm font-medium text-gray-900 [overflow-wrap:anywhere]">
                                        {employee.firstName} {employee.lastName}
                                    </td>
                                    <td className="max-w-64 px-4 py-4 text-sm text-gray-600 [overflow-wrap:anywhere]">
                                        {employee.email || "-"}
                                    </td>
                                    <td className="max-w-56 px-4 py-4 text-sm text-gray-600 [overflow-wrap:anywhere]">
                                        {employee.position}
                                    </td>
                                    <td className="max-w-52 px-4 py-4 text-sm">
                                        <Badge
                                            variant="outline"
                                            className={`${getEmployeeDepartmentBadgeClass(employee.department)} max-w-full px-2.5 font-medium [overflow-wrap:anywhere]`}
                                        >
                                            {getEmployeeDepartmentLabel(employee.department)}
                                        </Badge>
                                    </td>
                                    <td className="max-w-40 px-4 py-4 text-sm text-gray-600 [overflow-wrap:anywhere]">
                                        {formatEmployeePhone(employee.phone)}
                                    </td>
                                    <td className="max-w-44 px-4 py-4 text-sm text-gray-600">
                                        {employee.nickname ? (
                                            <Badge variant="secondary" className="max-w-full border border-violet-200/60 bg-violet-50 px-2.5 font-medium text-violet-700 hover:bg-violet-100 [overflow-wrap:anywhere]">
                                                {employee.nickname}
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
                                    นำเข้าข้อมูล ({parsedData.length} คน)
                                </span>
                            </>
                        )}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
