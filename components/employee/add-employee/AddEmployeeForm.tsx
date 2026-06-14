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
        <Card className="mx-auto w-full max-w-3xl rounded-2xl border-slate-200 bg-white shadow-sm">
            <CardHeader>
                <CardTitle className="text-xl font-bold text-slate-950 [overflow-wrap:anywhere]">
                    เพิ่มพนักงานใหม่
                </CardTitle>
                <CardDescription className="text-sm leading-6 text-slate-600 [overflow-wrap:anywhere]">
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
                            <Alert className="border-red-200 bg-red-50" aria-live="assertive">
                                <AlertTriangle className="h-4 w-4 text-red-600" />
                                <AlertTitle className="text-red-800">
                                    เพิ่มพนักงานไม่สำเร็จ
                                </AlertTitle>
                                <AlertDescription className="text-red-700 [overflow-wrap:anywhere]">
                                    {error}
                                </AlertDescription>
                            </Alert>
                        )}

                        <Button
                            type="submit"
                            className="h-11 w-full bg-blue-600 text-base font-bold text-white transition-colors hover:bg-blue-700"
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
