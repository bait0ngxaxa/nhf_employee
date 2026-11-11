"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import type { EmployeeFormData, Department } from "../types";
import { createEmployeeSchema } from "../../../schemas/employee";
import { apiPost } from "@/lib/client/api-client";
import { API_ROUTES } from "@/lib/ssot/routes";

const INITIAL_FORM_DATA: EmployeeFormData = {
    firstName: "",
    lastName: "",
    nickname: "",
    email: "",
    phone: "",
    position: "",
    affiliation: "",
    hireDate: "",
    departmentId: "",
};

function getAddEmployeeErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim().length > 0) {
        return error.message;
    }

    return "เพิ่มพนักงานไม่สำเร็จ กรุณาตรวจสอบข้อมูลแล้วลองใหม่อีกครั้ง";
}

interface UseAddEmployeeOptions {
    onSuccess?: () => void;
    canReadDepartments: boolean;
}

interface UseAddEmployeeReturn {
    formData: EmployeeFormData;
    departments: Department[];
    canReadDepartments: boolean;
    isLoading: boolean;
    hasUnresolvedSubmission: boolean;
    recoveryAcknowledged: boolean;
    error: string;
    fieldErrors: Record<string, string>;
    handleFieldChange: <K extends keyof EmployeeFormData>(
        field: K,
        value: EmployeeFormData[K],
    ) => void;
    acknowledgeUnresolvedSubmission: () => void;
    handleSubmit: (e: React.FormEvent) => Promise<void>;
}

export function useAddEmployee({
    onSuccess,
    canReadDepartments,
}: UseAddEmployeeOptions): UseAddEmployeeReturn {
    const [formData, setFormData] =
        useState<EmployeeFormData>(INITIAL_FORM_DATA);

    const { data: departmentData } = useSWR<{ departments: Department[] }>(
        canReadDepartments ? API_ROUTES.employees.departments : null,
    );
    const departments = departmentData?.departments || [];

    const [isLoading, setIsLoading] = useState(false);
    const [hasUnresolvedSubmission, setHasUnresolvedSubmission] = useState(false);
    const [recoveryAcknowledged, setRecoveryAcknowledged] = useState(false);
    const [error, setError] = useState("");
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    const handleFieldChange = useCallback(
        <K extends keyof EmployeeFormData>(
            field: K,
            value: EmployeeFormData[K],
        ): void => {
            if (isLoading || hasUnresolvedSubmission || recoveryAcknowledged) return;
            setFormData((prev) => ({ ...prev, [field]: value }));
            setError("");
            setFieldErrors((current) => {
                if (!current[field]) {
                    return current;
                }

                const next = { ...current };
                delete next[field];
                return next;
            });
        },
        [hasUnresolvedSubmission, isLoading, recoveryAcknowledged],
    );

    const acknowledgeUnresolvedSubmission = (): void => {
        if (!hasUnresolvedSubmission || isLoading) return;
        setHasUnresolvedSubmission(false);
        setRecoveryAcknowledged(true);
    };

    const handleSubmit = async (e: React.FormEvent): Promise<void> => {
        e.preventDefault();
        if (isLoading || hasUnresolvedSubmission || recoveryAcknowledged) {
            return;
        }

        if (!canReadDepartments) {
            setError("ไม่สามารถเพิ่มพนักงานได้ เนื่องจากไม่สามารถโหลดข้อมูลแผนก");
            return;
        }

        setError("");
        setFieldErrors({});

        const result = createEmployeeSchema.safeParse(formData);

        if (!result.success) {
            const errors: Record<string, string> = {};
            let firstErrorField = "";

            result.error.issues.forEach((issue) => {
                const fieldName = issue.path[0] as string;
                if (!errors[fieldName]) {
                    errors[fieldName] = issue.message;
                    if (!firstErrorField) firstErrorField = fieldName;
                }
            });

            setFieldErrors(errors);

            if (firstErrorField) {
                const element = document.getElementById(firstErrorField);
                if (element) {
                    element.scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                    });
                    element.focus();
                }
            }
            return;
        }

        setIsLoading(true);

        try {
            const apiResult = await apiPost(API_ROUTES.employees.list, {
                ...result.data,
                hireDate: formData.hireDate || null,
            });

            if (apiResult.success) {
                setHasUnresolvedSubmission(false);
                setRecoveryAcknowledged(false);
                toast.success("เพิ่มพนักงานสำเร็จ", {
                    description:
                        "ข้อมูลพนักงานใหม่ถูกเพิ่มเข้าระบบเรียบร้อยแล้ว",
                });
                setFormData(INITIAL_FORM_DATA);
                setFieldErrors({});
                onSuccess?.();
                return;
            }

            setHasUnresolvedSubmission(apiResult.status === undefined || apiResult.status >= 500);
            setError(apiResult.error);
        } catch (submitError) {
            setHasUnresolvedSubmission(true);
            setError(getAddEmployeeErrorMessage(submitError));
        } finally {
            setIsLoading(false);
        }
    };

    return {
        formData,
        departments,
        canReadDepartments,
        isLoading,
        hasUnresolvedSubmission,
        recoveryAcknowledged,
        error,
        fieldErrors,
        handleFieldChange,
        acknowledgeUnresolvedSubmission,
        handleSubmit,
    };
}
