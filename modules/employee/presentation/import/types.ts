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

export interface UseImportCSVReturn {
    step: ImportStep;
    parsedData: CSVEmployee[];
    importResult: ImportResult | null;
    isLoading: boolean;
    error: string;
    previewError: string;
    fileInputRef: RefObject<HTMLInputElement | null>;
    handleFileSelect: (event: ChangeEvent<HTMLInputElement>) => void;
    handleImport: () => Promise<void>;
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
    onResetUpload: () => void;
    onImport: () => Promise<void>;
}

export interface ResultStepProps {
    importResult: ImportResult;
    onResetUpload: () => void;
    onBack?: () => void;
}
