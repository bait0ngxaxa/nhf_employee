import { useState, useRef, useCallback } from "react";
import { type CSVEmployee, type ImportResult } from "@/types/employees";
import { parseCSV, downloadSampleCSV } from "@/lib/helpers/csv-helpers";
import { validateCSVFile } from "@/lib/helpers/file-validation";
import { apiPost } from "@/lib/api-client";

type ImportStep = "upload" | "preview" | "result";

interface UseCSVImportReturn {
    // Step management
    step: ImportStep;
    setStep: (step: ImportStep) => void;

    // Data
    parsedData: CSVEmployee[];
    importResult: ImportResult | null;

    // Loading & Error states
    isLoading: boolean;
    error: string;
    previewError: string;

    // File input ref
    fileInputRef: React.RefObject<HTMLInputElement | null>;

    // Actions
    handleFileSelect: (
        event: React.ChangeEvent<HTMLInputElement>,
    ) => Promise<void>;
    handleImport: (onSuccess?: () => void) => Promise<void>;
    resetUpload: () => void;
    downloadSample: () => void;
}

export function useCSVImport(): UseCSVImportReturn {
    const [step, setStep] = useState<ImportStep>("upload");
    const [parsedData, setParsedData] = useState<CSVEmployee[]>([]);
    const [importResult, setImportResult] = useState<ImportResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [previewError, setPreviewError] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = useCallback(
        async (event: React.ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            if (!file) return;

            const validation = await validateCSVFile(file);
            if (!validation.isValid) {
                setPreviewError(
                    validation.error || "ไฟล์ตรวจสอบไม่ผ่านตามหลักความปลอดภัย",
                );
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
        },
        [],
    );

    const handleImport = useCallback(
        async (onSuccess?: () => void) => {
            if (!parsedData.length) return;

            setIsLoading(true);
            setError("");

            try {
                const result = await apiPost<{ result: ImportResult }>("/api/employees/import", {
                    employees: parsedData,
                });

                if (result.success) {
                    setImportResult(result.data.result);
                    setStep("result");
                    if (onSuccess) {
                        onSuccess();
                    }
                } else {
                    setError(result.error);
                }
            } finally {
                setIsLoading(false);
            }
        },
        [parsedData],
    );

    const resetUpload = useCallback(() => {
        setStep("upload");
        setParsedData([]);
        setImportResult(null);
        setError("");
        setPreviewError("");
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }, []);

    const downloadSample = useCallback(() => {
        downloadSampleCSV();
    }, []);

    return {
        step,
        setStep,
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
