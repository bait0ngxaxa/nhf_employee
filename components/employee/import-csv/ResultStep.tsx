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

export function ResultStep({
    importResult,
    onResetUpload,
    onBack,
}: ResultStepProps) {
    return (
        <div className="space-y-6">
            {/* Success Summary */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center space-x-2 text-green-600">
                        <CheckCircle className="h-5 w-5" />
                        <span>ผลลัพธ์การนำเข้าข้อมูล</span>
                    </CardTitle>
                    <CardDescription>
                        นำเข้าสำเร็จ {importResult.success.length} คน
                        {importResult.errors.length > 0
                            ? `, มีข้อผิดพลาด ${importResult.errors.length} รายการ`
                            : ""}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="text-center p-4 bg-green-50 rounded-lg">
                            <div className="text-2xl font-bold text-green-600">
                                {importResult.success.length}
                            </div>
                            <div className="text-sm text-green-700">
                                นำเข้าสำเร็จ
                            </div>
                        </div>
                        {importResult.errors.length > 0 ? (
                            <div className="text-center p-4 bg-red-50 rounded-lg">
                                <div className="text-2xl font-bold text-red-600">
                                    {importResult.errors.length}
                                </div>
                                <div className="text-sm text-red-700">
                                    มีข้อผิดพลาด
                                </div>
                            </div>
                        ) : null}
                    </div>
                </CardContent>
            </Card>

            {/* Error Details */}
            {importResult.errors.length > 0 ? (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center space-x-2 text-red-600">
                            <AlertTriangle className="h-5 w-5" />
                            <span>รายการที่มีข้อผิดพลาด</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {importResult.errors.map((err, index) => (
                                <div
                                    key={index}
                                    className="p-4 border border-red-200 rounded-lg bg-red-50"
                                >
                                    <div className="flex items-start space-x-3">
                                        <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                                        <div className="flex-1">
                                            <div className="font-medium text-red-800">
                                                แถวที่ {err.row}:
                                            </div>
                                            <div className="text-sm text-red-700 mt-1">
                                                {err.error}
                                            </div>
                                            <div className="text-xs text-red-600 mt-2">
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

            {/* Action Buttons */}
            <div className="flex items-center justify-between">
                <Button variant="outline" onClick={onResetUpload}>
                    นำเข้าไฟล์ใหม่
                </Button>
                {onBack ? (
                    <Button
                        onClick={onBack}
                        className="flex items-center space-x-2"
                    >
                        <span>กลับไปหน้าจัดการพนักงาน</span>
                    </Button>
                ) : null}
            </div>
        </div>
    );
}
