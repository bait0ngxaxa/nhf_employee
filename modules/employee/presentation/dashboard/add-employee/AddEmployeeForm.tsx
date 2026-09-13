"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Loader2 } from "lucide-react";
import type { AddEmployeeFormProps } from "../types";
import { EmployeeFormFields } from "../shared";
import { useAddEmployee } from "./useAddEmployee";

export function AddEmployeeForm({
    onSuccess,
    canReadDepartments,
}: AddEmployeeFormProps) {
    const {
        formData,
        departments,
        canReadDepartments: projectedCanReadDepartments,
        isLoading,
        error,
        fieldErrors,
        handleFieldChange,
        handleSubmit,
    } = useAddEmployee({ onSuccess, canReadDepartments });

    return (
        <Card className="mx-auto w-full max-w-3xl rounded-xl border-border-subtle bg-surface-raised shadow-none">
            <CardContent className="pt-6">
                <form onSubmit={handleSubmit} noValidate aria-busy={isLoading}>
                    <div className="flex flex-col gap-6">
                        <EmployeeFormFields
                            formData={formData}
                            fieldErrors={fieldErrors}
                            departments={departments}
                            canReadDepartments={projectedCanReadDepartments}
                            onFieldChange={handleFieldChange}
                        />

                        {error && (
                            <Alert className="border-status-error-border bg-status-error-surface" aria-live="assertive">
                                <AlertTriangle className="h-4 w-4 text-status-error-muted" />
                                <AlertTitle className="text-status-error-strong">
                                    เพิ่มพนักงานไม่สำเร็จ
                                </AlertTitle>
                                <AlertDescription className="text-status-error-foreground [overflow-wrap:anywhere]">
                                    {error}
                                </AlertDescription>
                            </Alert>
                        )}

                        <Button
                            type="submit"
                            className="h-11 w-full bg-action-primary-solid text-base font-bold text-content-on-brand transition-colors hover:bg-action-primary-solid-hover"
                            disabled={isLoading || !projectedCanReadDepartments}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    กำลังเพิ่มพนักงาน...
                                </>
                            ) : (
                                "เพิ่มพนักงาน"
                            )}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
