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
import { Alert } from "@/components/ui/alert";
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
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                    <Upload className="h-5 w-5" />
                    <span>อัพโหลดไฟล์ CSV</span>
                </CardTitle>
                <CardDescription>
                    เลือกไฟล์ CSV ที่มีข้อมูลพนักงาน (ขนาดไฟล์สูงสุด 5MB)
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* File Upload */}
                <div className="space-y-4">
                    <Label htmlFor="csv-file">เลือกไฟล์ CSV</Label>
                    <Input
                        ref={fileInputRef}
                        id="csv-file"
                        type="file"
                        accept=".csv"
                        onChange={onFileSelect}
                        className="cursor-pointer"
                    />
                    {previewError && (
                        <Alert className="border-red-200 bg-red-50">
                            <XCircle className="h-4 w-4 text-red-600" />
                            <div className="text-red-700">{previewError}</div>
                        </Alert>
                    )}
                </div>

                <Separator />

                {/* Sample Download */}
                <div className="space-y-4">
                    <div>
                        <h4 className="font-medium text-gray-900 mb-2">
                            รูปแบบไฟล์ CSV ที่ต้องการ:
                        </h4>
                        <div className="text-sm text-gray-600 space-y-1">
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
                        variant="outline"
                        onClick={onDownloadSample}
                        className="flex items-center space-x-2"
                    >
                        <Download className="h-4 w-4" />
                        <span>ดาวน์โหลดไฟล์ตัวอย่าง</span>
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
