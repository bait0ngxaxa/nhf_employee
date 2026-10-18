"use client";

import type { ImportEmployeeCSVProps } from "./types";
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
    } = useImportCSV({ onSuccess });

    return (
        <div className="space-y-6">
            <ImportHeader onBack={onBack} />
            <ProgressSteps step={step} />

            <div aria-live="polite" aria-atomic="false">
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
                        onUpdateEmployee={updateEmployee}
                        onResetUpload={resetUpload}
                        onImport={handleImport}
                    />
                )}

                {step === "result" && importResult && (
                    <ResultStep
                        importResult={importResult}
                        isRetryAttempt={isRetryAttempt}
                        onResetUpload={resetUpload}
                        onRetryFailedRows={retryFailedRows}
                        onBack={onBack}
                    />
                )}
            </div>
        </div>
    );
}
