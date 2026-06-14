"use client";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Upload, XCircle, Download } from "lucide-react";
import { type UploadStepProps } from "./types";

export function UploadStep({
    fileInputRef,
    previewError,
    onFileSelect,
    onDownloadSample,
}: UploadStepProps) {
    return (
        <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
            <CardHeader>
                <CardTitle className="flex min-w-0 items-center gap-2 text-xl font-bold text-slate-950">
                    <Upload className="h-5 w-5 shrink-0" />
                    <span>อัพโหลดไฟล์ CSV</span>
                </CardTitle>
                <CardDescription className="text-sm leading-6 text-slate-600 [overflow-wrap:anywhere]">
                    เลือกไฟล์ CSV ที่มีข้อมูลพนักงาน (ขนาดไฟล์สูงสุด 5MB)
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-4">
                    <Label htmlFor="csv-file" className="[overflow-wrap:anywhere]">
                        เลือกไฟล์ CSV
                    </Label>
                    <Input
                        ref={fileInputRef}
                        id="csv-file"
                        type="file"
                        accept=".csv,text/csv"
                        onChange={onFileSelect}
                        aria-invalid={Boolean(previewError)}
                        aria-describedby={
                            previewError ? "csv-file-error" : "csv-file-help"
                        }
                        className="cursor-pointer file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700"
                    />
                    <p id="csv-file-help" className="text-xs leading-5 text-slate-500">
                        รองรับเฉพาะไฟล์ .csv แบบ UTF-8 และขนาดไม่เกิน 5MB
                    </p>
                    {previewError && (
                        <Alert
                            id="csv-file-error"
                            className="border-red-200 bg-red-50"
                            aria-live="assertive"
                        >
                            <XCircle className="h-4 w-4 text-red-600" />
                            <AlertTitle className="text-red-800">
                                ตรวจสอบไฟล์ไม่สำเร็จ
                            </AlertTitle>
                            <AlertDescription className="whitespace-pre-line text-red-700 [overflow-wrap:anywhere]">
                                {previewError}
                            </AlertDescription>
                        </Alert>
                    )}
                </div>

                <Separator />

                <div className="space-y-4">
                    <div>
                        <h4 className="mb-2 font-medium text-gray-900">
                            รูปแบบไฟล์ CSV ที่ต้องการ:
                        </h4>
                        <div className="space-y-1 text-sm leading-6 text-gray-600 [overflow-wrap:anywhere]">
                            <p>
                                <strong>คอลัมน์ที่จำเป็น:</strong> ชื่อ,
                                นามสกุล, ตำแหน่ง, แผนก
                            </p>
                            <p>
                                <strong>คอลัมน์เสริม:</strong> อีเมล,
                                เบอร์โทรศัพท์, สังกัด, ชื่อเล่น
                            </p>
                            <p>
                                <strong>รหัสแผนก:</strong> ADMIN (บริหาร),
                                ACADEMIC (วิชาการ)
                            </p>
                            <p>
                                <strong>หมายเหตุ:</strong>{" "}
                                อีเมลสามารถเว้นว่างได้ (บางคนไม่มีอีเมล)
                            </p>
                        </div>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onDownloadSample}
                        className="h-11 w-full justify-center gap-2 sm:w-auto"
                    >
                        <Download className="h-4 w-4" />
                        <span>ดาวน์โหลดไฟล์ตัวอย่าง</span>
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
