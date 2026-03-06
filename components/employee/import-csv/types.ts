import { type RefObject } from "react";
import { type CSVEmployee, type ImportResult } from "@/types/employees";

export type ImportStep = "upload" | "preview" | "result";

export interface UseImportCSVReturn {
    step: ImportStep;
    parsedData: CSVEmployee[];
    importResult: ImportResult | null;
    isLoading: boolean;
    error: string;
    previewError: string;
    fileInputRef: RefObject<HTMLInputElement | null>;
    handleFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
    handleImport: () => Promise<void>;
    resetUpload: () => void;
    downloadSample: () => void;
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
    onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
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
