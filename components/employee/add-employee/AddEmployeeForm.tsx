"use client";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Loader2 } from "lucide-react";
import { type AddEmployeeFormProps } from "@/types/employees";
import { EmployeeFormFields } from "../shared";
import { useAddEmployee } from "./useAddEmployee";

export function AddEmployeeForm({ onSuccess }: AddEmployeeFormProps) {
    const {
        formData,
        departments,
        isLoading,
        error,
        fieldErrors,
        handleFieldChange,
        handleSubmit,
    } = useAddEmployee({ onSuccess });

    return (
        <Card className="mx-auto w-full max-w-3xl rounded-2xl border-border-subtle bg-surface-raised shadow-sm">
            <CardHeader>
                <CardTitle className="text-xl font-bold text-content-heading [overflow-wrap:anywhere]">
                    เพิ่มพนักงานใหม่
                </CardTitle>
                <CardDescription className="text-sm leading-6 text-content-secondary [overflow-wrap:anywhere]">
                    กรอกข้อมูลพนักงานใหม่เพื่อเพิ่มเข้าระบบ
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} noValidate aria-busy={isLoading}>
                    <div className="flex flex-col gap-6">
                        <EmployeeFormFields
                            formData={formData}
                            fieldErrors={fieldErrors}
                            departments={departments}
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
                            disabled={isLoading}
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
