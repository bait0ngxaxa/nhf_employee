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
import { Alert } from "@/components/ui/alert";
import {
    formatEmployeePhone,
    getEmployeeDepartmentBadgeClass,
    getEmployeeDepartmentLabel,
} from "@/lib/helpers/employee-helpers";
import { FileText, CheckCircle, XCircle } from "lucide-react";
import { type PreviewStepProps } from "./types";

export function PreviewStep({
    parsedData,
    error,
    isLoading,
    onResetUpload,
    onImport,
}: PreviewStepProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                    <FileText className="h-5 w-5" />
                    <span>ตรวจสอบข้อมูลก่อนนำเข้า</span>
                </CardTitle>
                <CardDescription>
                    พบข้อมูลพนักงาน {parsedData.length} คน
                    กรุณาตรวจสอบความถูกต้องก่อนทำการนำเข้า
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Preview Table */}
                <div className="overflow-x-auto max-h-96 border rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 sticky top-0">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    ลำดับ
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    ชื่อ-นามสกุล
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    อีเมล
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    ตำแหน่ง
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    แผนก
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    เบอร์โทร
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    ชื่อเล่น
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {parsedData.map((employee, index) => (
                                <tr key={index} className="hover:bg-gray-50">
                                    <td className="px-4 py-4 text-sm text-gray-900">
                                        {index + 1}
                                    </td>
                                    <td className="px-4 py-4 text-sm font-medium text-gray-900">
                                        {employee.firstName} {employee.lastName}
                                    </td>
                                    <td className="px-4 py-4 text-sm text-gray-600">
                                        {employee.email || "-"}
                                    </td>
                                    <td className="px-4 py-4 text-sm text-gray-600">
                                        {employee.position}
                                    </td>
                                    <td className="px-4 py-4 text-sm">
                                        <Badge
                                            variant="outline"
                                            className={`${getEmployeeDepartmentBadgeClass(employee.department)} px-2.5 font-medium shadow-sm`}
                                        >
                                            {getEmployeeDepartmentLabel(employee.department)}
                                        </Badge>
                                    </td>
                                    <td className="px-4 py-4 text-sm text-gray-600">
                                        {formatEmployeePhone(employee.phone)}
                                    </td>
                                    <td className="px-4 py-4 text-sm text-gray-600">
                                        {employee.nickname ? (
                                            <Badge variant="secondary" className="bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200/60 font-medium shadow-sm px-2.5">
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
                    <Alert className="border-red-200 bg-red-50">
                        <XCircle className="h-4 w-4 text-red-600" />
                        <div className="text-red-700">{error}</div>
                    </Alert>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-between">
                    <Button variant="outline" onClick={onResetUpload}>
                        เลือกไฟล์ใหม่
                    </Button>
                    <Button
                        onClick={onImport}
                        disabled={isLoading || parsedData.length === 0}
                        className="flex items-center space-x-2"
                    >
                        {isLoading ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
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
