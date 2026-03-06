"use client";

import { type ImportEmployeeCSVProps } from "@/types/employees";
import { useImportCSV } from "./useImportCSV";
import { ImportHeader } from "./ImportHeader";
import { ProgressSteps } from "./ProgressSteps";
import { UploadStep } from "./UploadStep";
import { PreviewStep } from "./PreviewStep";
import { ResultStep } from "./ResultStep";

export function ImportEmployeeCSV({
    onSuccess,
    onBack,
}: ImportEmployeeCSVProps) {
    const {
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
    } = useImportCSV({ onSuccess });

    return (
        <div className="space-y-6">
            <ImportHeader onBack={onBack} />
            <ProgressSteps step={step} />

            {step === "upload" && (
                <UploadStep
                    fileInputRef={fileInputRef}
                    previewError={previewError}
                    onFileSelect={handleFileSelect}
                    onDownloadSample={downloadSample}
                />
            )}

            {step === "preview" && (
                <PreviewStep
                    parsedData={parsedData}
                    error={error}
                    isLoading={isLoading}
                    onResetUpload={resetUpload}
                    onImport={handleImport}
                />
            )}

            {step === "result" && importResult && (
                <ResultStep
                    importResult={importResult}
                    onResetUpload={resetUpload}
                    onBack={onBack}
                />
            )}
        </div>
    );
}
