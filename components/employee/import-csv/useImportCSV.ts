"use client";

import { useState, useRef } from "react";
import { type CSVEmployee, type ImportResult } from "@/types/employees";
import { parseCSV, downloadSampleCSV } from "@/lib/helpers/csv-helpers";
import { type UseImportCSVReturn, type ImportStep } from "./types";
import { toast } from "sonner";
import { apiPost } from "@/lib/api-client";
import { API_ROUTES } from "@/lib/ssot/routes";

interface UseImportCSVOptions {
    onSuccess?: () => void;
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

        if (!file.name.endsWith(".csv")) {
            setPreviewError("กรุณาเลือกไฟล์ CSV เท่านั้น");
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setPreviewError("ไฟล์มีขนาดใหญ่เกินไป (สูงสุด 5MB)");
            return;
        }

        setPreviewError("");
        setError("");

        try {
            const text = await file.text();
            const parsed = parseCSV(text);
            setParsedData(parsed);
            setStep("preview");
        } catch (err) {
            setPreviewError(
                err instanceof Error
                    ? err.message
                    : "เกิดข้อผิดพลาดในการอ่านไฟล์",
            );
        }
    };

    const handleImport = async (): Promise<void> => {
        if (!parsedData.length) return;

        setIsLoading(true);
        setError("");

        try {
            const response = await apiPost<{ result: ImportResult }>(API_ROUTES.employees.import, {
                employees: parsedData,
            });

            if (response.success) {
                setImportResult(response.data.result);
                setStep("result");
                toast.success("นำเข้าข้อมูลเสร็จสิ้น", {
                    description: `พบข้อมูลทั้งหมด ${(response.data.result.imported || 0) + (response.data.result.failed || 0)} รายการ`,
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
        downloadSampleCSV();
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
