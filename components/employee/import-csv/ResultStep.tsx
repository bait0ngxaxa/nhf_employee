import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { type ResultStepProps } from "./types";

const ERROR_DETAIL_LIMIT = 50;

export function ResultStep({
    importResult,
    onResetUpload,
    onBack,
}: ResultStepProps) {
    const visibleErrors = importResult.errors.slice(0, ERROR_DETAIL_LIMIT);
    const hiddenErrorCount = Math.max(0, importResult.errors.length - visibleErrors.length);

    return (
        <div className="space-y-6">
            <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
                <CardHeader>
                    <CardTitle className="flex min-w-0 items-center gap-2 text-xl font-bold text-green-700">
                        <CheckCircle className="h-5 w-5 shrink-0" />
                        <span>ผลลัพธ์การนำเข้าข้อมูล</span>
                    </CardTitle>
                    <CardDescription className="text-sm leading-6 text-slate-600 [overflow-wrap:anywhere]">
                        นำเข้าสำเร็จ {importResult.success.length.toLocaleString("th-TH")} คน
                        {importResult.errors.length > 0
                            ? `, มีข้อผิดพลาด ${importResult.errors.length.toLocaleString("th-TH")} รายการ`
                            : ""}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="rounded-lg bg-green-50 p-4 text-center">
                            <div className="text-2xl font-bold text-green-600">
                                {importResult.success.length.toLocaleString("th-TH")}
                            </div>
                            <div className="text-sm text-green-700">
                                นำเข้าสำเร็จ
                            </div>
                        </div>
                        {importResult.errors.length > 0 ? (
                            <div className="rounded-lg bg-red-50 p-4 text-center">
                                <div className="text-2xl font-bold text-red-600">
                                    {importResult.errors.length.toLocaleString("th-TH")}
                                </div>
                                <div className="text-sm text-red-700">
                                    มีข้อผิดพลาด
                                </div>
                            </div>
                        ) : null}
                    </div>
                </CardContent>
            </Card>

            {importResult.errors.length > 0 ? (
                <Card className="rounded-2xl border-red-200 bg-white shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex min-w-0 items-center gap-2 text-xl font-bold text-red-700">
                            <AlertTriangle className="h-5 w-5 shrink-0" />
                            <span>รายการที่มีข้อผิดพลาด</span>
                        </CardTitle>
                        <CardDescription className="text-sm leading-6 text-red-700 [overflow-wrap:anywhere]">
                            แสดง {visibleErrors.length.toLocaleString("th-TH")} รายการแรก
                            {hiddenErrorCount > 0
                                ? ` ยังมีอีก ${hiddenErrorCount.toLocaleString("th-TH")} รายการ`
                                : ""}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {visibleErrors.map((err, index) => (
                                <div
                                    key={index}
                                    className="rounded-lg border border-red-200 bg-red-50 p-4"
                                >
                                    <div className="flex items-start gap-3">
                                        <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
                                        <div className="min-w-0 flex-1">
                                            <div className="font-medium text-red-800">
                                                แถวที่ {err.row}:
                                            </div>
                                            <div className="mt-1 text-sm leading-6 text-red-700 [overflow-wrap:anywhere]">
                                                {err.error}
                                            </div>
                                            <div className="mt-2 text-xs leading-5 text-red-600 [overflow-wrap:anywhere]">
                                                ข้อมูล:{" "}
                                                {JSON.stringify(err.data)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
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
