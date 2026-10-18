"use client";

import { useState, useRef } from "react";
import type { CSVEmployee, ImportResult, UseImportCSVReturn, ImportStep } from "./types";
import {
    downloadSampleCSV,
    parseCSV,
    validateEmployeeImportRows,
} from "./csv";
import { validateCSVFile } from "@/lib/helpers/file-validation";
import { toast } from "sonner";
import { apiPost } from "@/lib/client/api-client";
import { API_ROUTES } from "@/lib/ssot/routes";
import { getImportResultStatus, IMPORT_RESULT_MESSAGES } from "./import-result-status";

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
    const [isRetryAttempt, setIsRetryAttempt] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [previewError, setPreviewError] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);
    const isSubmittingRef = useRef(false);

    const handleFileSelect = async (
        event: React.ChangeEvent<HTMLInputElement>,
    ): Promise<void> => {
        const file = event.target.files?.[0];
        if (!file) return;

        setPreviewError("");
        setError("");
        setImportResult(null);
        setIsRetryAttempt(false);

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
        if (!parsedData.length || isSubmittingRef.current) return;

        const validationIssues = validateEmployeeImportRows(parsedData);
        if (validationIssues.length > 0) {
            setError(
                "ยังมีข้อมูล " + validationIssues.length.toLocaleString("th-TH") + " แถวที่ต้องแก้ไขก่อนนำเข้า",
            );
            return;
        }

        isSubmittingRef.current = true;
        setIsLoading(true);
        setError("");

        try {
            const response = await apiPost<{ result: ImportResult }>(API_ROUTES.employees.import, {
                employees: parsedData,
            });

            if (response.success) {
                const result = response.data.result;
                const resultStatus = getImportResultStatus(result);
                setImportResult(result);
                setStep("result");
                const toastOptions = {
                    description: "สำเร็จ "
                        + result.success.length.toLocaleString("th-TH")
                        + " รายการ · ไม่สำเร็จ "
                        + result.errors.length.toLocaleString("th-TH")
                        + " รายการ",
                };

                if (resultStatus === "complete") {
                    toast.success(IMPORT_RESULT_MESSAGES[resultStatus], toastOptions);
                } else if (resultStatus === "partial" || resultStatus === "empty") {
                    toast.warning(IMPORT_RESULT_MESSAGES[resultStatus], toastOptions);
                } else {
                    toast.error(IMPORT_RESULT_MESSAGES[resultStatus], toastOptions);
                }

                if (result.success.length > 0) onSuccess?.();
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
            isSubmittingRef.current = false;
            setIsLoading(false);
        }
    };

    const updateEmployee = (index: number, employee: CSVEmployee): void => {
        setParsedData((current) => current.map((currentEmployee, currentIndex) =>
            currentIndex === index
                ? { ...employee, sourceRow: currentEmployee.sourceRow }
                : currentEmployee,
        ));
        setError("");
    };

    const retryFailedRows = (): void => {
        if (!importResult || importResult.errors.length === 0 || isLoading) return;

        setParsedData(importResult.errors.map(({ row, data }) => ({
            sourceRow: row,
            firstName: data.firstName ?? "",
            lastName: data.lastName ?? "",
            email: data.email,
            phone: data.phone,
            position: data.position ?? "",
            department: data.department ?? "",
            affiliation: data.affiliation,
            nickname: data.nickname,
            status: data.status,
        })));
        setImportResult(null);
        setIsRetryAttempt(true);
        setError("");
        setStep("preview");
    };

    const resetUpload = (): void => {
        setStep("upload");
        setParsedData([]);
        setImportResult(null);
        setIsRetryAttempt(false);
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
        isRetryAttempt,
        isLoading,
        error,
        previewError,
        fileInputRef,
        handleFileSelect,
        handleImport,
        updateEmployee,
        retryFailedRows,
        resetUpload,
        downloadSample,
    };
}
