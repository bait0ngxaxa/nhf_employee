"use client";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
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
        <Card>
            <CardHeader>
                <CardTitle>เพิ่มพนักงานใหม่</CardTitle>
                <CardDescription>
                    กรอกข้อมูลพนักงานใหม่เพื่อเพิ่มเข้าระบบ
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} noValidate>
                    <div className="flex flex-col gap-6">
                        <EmployeeFormFields
                            formData={formData}
                            fieldErrors={fieldErrors}
                            departments={departments}
                            onFieldChange={handleFieldChange}
                        />

                        {error && (
                            <Alert className="border-red-200 bg-red-50">
                                <AlertTriangle className="h-4 w-4 text-red-600" />
                                <div className="text-red-700">{error}</div>
                            </Alert>
                        )}

                        <Button
                            type="submit"
                            className="w-full"
                            disabled={isLoading}
                        >
                            {isLoading
                                ? "กำลังเพิ่มพนักงาน..."
                                : "เพิ่มพนักงาน"}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
