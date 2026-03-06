"use client";

import { useState, useRef } from "react";
import { type CSVEmployee, type ImportResult } from "@/types/employees";
import { parseCSV, downloadSampleCSV } from "@/lib/helpers/csv-helpers";
import { type UseImportCSVReturn, type ImportStep } from "./types";

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
            const response = await fetch("/api/employees/import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ employees: parsedData }),
            });

            const data = await response.json();

            if (response.ok) {
                setImportResult(data.result);
                setStep("result");
                onSuccess?.();
            } else {
                setError(data.error || "เกิดข้อผิดพลาดในการนำเข้าข้อมูล");
            }
        } catch {
            setError("เกิดข้อผิดพลาดในการเชื่อมต่อ");
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
