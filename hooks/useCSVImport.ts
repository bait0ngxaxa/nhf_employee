import { useState, useRef, useCallback } from "react";
import { CSVEmployee, ImportResult } from "@/types/employees";
import { parseCSV, downloadSampleCSV } from "@/lib/helpers/csv-helpers";

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
        event: React.ChangeEvent<HTMLInputElement>
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
                        : "เกิดข้อผิดพลาดในการอ่านไฟล์"
                );
            }
        },
        []
    );

    const handleImport = useCallback(
        async (onSuccess?: () => void) => {
            if (!parsedData.length) return;

            setIsLoading(true);
            setError("");

            try {
                const response = await fetch("/api/employees/import", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ employees: parsedData }),
                });

                const data = await response.json();

                if (response.ok) {
                    setImportResult(data.result);
                    setStep("result");
                    if (onSuccess) {
                        onSuccess();
                    }
                } else {
                    setError(data.error || "เกิดข้อผิดพลาดในการนำเข้าข้อมูล");
                }
            } catch {
                setError("เกิดข้อผิดพลาดในการเชื่อมต่อ");
            } finally {
                setIsLoading(false);
            }
        },
        [parsedData]
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
