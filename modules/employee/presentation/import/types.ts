import type { ChangeEvent, RefObject } from "react";

export type ImportStep = "upload" | "preview" | "result";

export interface CSVEmployee {
    sourceRow?: number;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    position: string;
    department: string;
    affiliation?: string;
    nickname?: string;
    hireDate?: string;
    status?: string;
}

export interface ImportError {
    row: number;
    field?: string;
    value?: string;
    error: string;
    data: Partial<CSVEmployee>;
}

export interface ImportResult {
    success: CSVEmployee[];
    imported?: number;
    failed?: number;
    errors: ImportError[];
}

export interface CSVEmployeeValidationIssue {
    field: Exclude<keyof CSVEmployee, "sourceRow">;
    message: string;
}

export interface CSVEmployeeRowValidation {
    index: number;
    sourceRow: number;
    issues: CSVEmployeeValidationIssue[];
}

export interface UseImportCSVReturn {
    step: ImportStep;
    parsedData: CSVEmployee[];
    importResult: ImportResult | null;
    isRetryAttempt: boolean;
    isLoading: boolean;
    error: string;
    previewError: string;
    fileInputRef: RefObject<HTMLInputElement | null>;
    handleFileSelect: (event: ChangeEvent<HTMLInputElement>) => void;
    handleImport: () => Promise<void>;
    updateEmployee: (index: number, employee: CSVEmployee) => void;
    retryFailedRows: () => void;
    resetUpload: () => void;
    downloadSample: () => void;
}

export interface ImportEmployeeCSVProps {
    onSuccess?: () => void;
    onBack?: () => void;
}

export interface ImportHeaderProps {
    onBack?: () => void;
}

export interface ProgressStepsProps {
    step: ImportStep;
}

export interface UploadStepProps {
    fileInputRef: RefObject<HTMLInputElement | null>;
    previewError: string;
    onFileSelect: (event: ChangeEvent<HTMLInputElement>) => void;
    onDownloadSample: () => void;
}

export interface PreviewStepProps {
    parsedData: CSVEmployee[];
    error: string;
    isLoading: boolean;
    onUpdateEmployee: (index: number, employee: CSVEmployee) => void;
    onResetUpload: () => void;
    onImport: () => Promise<void>;
}

export interface ResultStepProps {
    importResult: ImportResult;
    isRetryAttempt: boolean;
    onResetUpload: () => void;
    onRetryFailedRows: () => void;
    onBack?: () => void;
}
