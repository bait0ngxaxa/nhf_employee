"use client";

import { useState, useRef } from "react";
import { type CSVEmployee, type ImportResult } from "@/types/employees";
import { parseCSV, downloadSampleCSV } from "@/lib/helpers/csv-helpers";
import { validateCSVFile } from "@/lib/helpers/file-validation";
import { type UseImportCSVReturn, type ImportStep } from "./types";
import { toast } from "sonner";
import { apiPost } from "@/lib/client/api-client";
import { API_ROUTES } from "@/lib/ssot/routes";

const MAX_CSV_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_IMPORT_ROWS = 1000;

interface UseImportCSVOptions {
    onSuccess?: () => void;
}

function getCsvReadErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim().length > 0) {
        return error.message;
    }

    return "เกิดข้อผิดพลาดในการอ่านไฟล์";
}

export function useImportCSV({
    onSuccess,
}: UseImportCSVOptions): UseImportCSVReturn {
    const [step, setStep] = useState<ImportStep>("upload");
    const [parsedData, setParsedData] = useState<CSVEmployee[]>([]);
    const [importResult, setImportResult] = useState<ImportResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [previewError, setPreviewError] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = async (
        event: React.ChangeEvent<HTMLInputElement>,
    ): Promise<void> => {
        const file = event.target.files?.[0];
        if (!file) return;

        setPreviewError("");
        setError("");
        setImportResult(null);

        if (file.size > MAX_CSV_FILE_SIZE_BYTES) {
            setPreviewError("ไฟล์มีขนาดใหญ่เกินไป (สูงสุด 5MB)");
            return;
        }

        const validation = await validateCSVFile(file);
        if (!validation.isValid) {
            setPreviewError(validation.error ?? "กรุณาเลือกไฟล์ CSV เท่านั้น");
            return;
        }

        try {
            const text = await file.text();
            const parsed = parseCSV(text);
            if (parsed.length === 0) {
                setPreviewError("ไม่พบข้อมูลพนักงานที่พร้อมนำเข้าในไฟล์ CSV");
                return;
            }

            if (parsed.length > MAX_IMPORT_ROWS) {
                setPreviewError(
                    `นำเข้าได้สูงสุด ${MAX_IMPORT_ROWS.toLocaleString("th-TH")} แถวต่อครั้ง`,
                );
                return;
            }

            setParsedData(parsed);
            setStep("preview");
        } catch (readError) {
            setPreviewError(getCsvReadErrorMessage(readError));
        }
    };

    const handleImport = async (): Promise<void> => {
        if (!parsedData.length || isLoading) return;

        setIsLoading(true);
        setError("");

        try {
            const response = await apiPost<{ result: ImportResult }>(API_ROUTES.employees.import, {
                employees: parsedData,
            });

            if (response.success) {
                const result = response.data.result;
                setImportResult(result);
                setStep("result");
                toast.success("นำเข้าข้อมูลเสร็จสิ้น", {
                    description: `พบข้อมูลทั้งหมด ${((result.imported || 0) + (result.failed || 0)).toLocaleString("th-TH")} รายการ`,
                });
                onSuccess?.();
            } else {
                const errorMsg = response.error || "เกิดข้อผิดพลาดในการนำเข้าข้อมูล";
                setError(errorMsg);
                toast.error("เกิดข้อผิดพลาด", { description: errorMsg });
            }
        } catch {
            const errorMsg = "เกิดข้อผิดพลาดในการเชื่อมต่อ";
            setError(errorMsg);
            toast.error("เกิดข้อผิดพลาด", { description: errorMsg });
        } finally {
            setIsLoading(false);
        }
    };

    const resetUpload = (): void => {
        setStep("upload");
        setParsedData([]);
        setImportResult(null);
        setError("");
        setPreviewError("");
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const downloadSample = (): void => {
        try {
            downloadSampleCSV();
        } catch {
            toast.error("ดาวน์โหลดไฟล์ตัวอย่างไม่สำเร็จ");
        }
    };

    return {
        step,
        parsedData,
        importResult,
        isLoading,
        error,
        previewError,
        fileInputRef,
        handleFileSelect,
        handleImport,
        resetUpload,
        downloadSample,
    };
}
