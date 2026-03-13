"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import {
    type EmployeeFormData,
    type Department,
    type Employee,
    type EmployeeStatusValue,
} from "@/types/employees";
import { updateEmployeeSchema } from "@/lib/validations/employee";
import { apiPatch } from "@/lib/api-client";

function buildInitialFormData(employee: Employee | null): EmployeeFormData {
    return {
        firstName: employee?.firstName || "",
        lastName: employee?.lastName || "",
        nickname: employee?.nickname || "",
        email: employee?.email?.includes("@temp.local")
            ? ""
            : employee?.email || "",
        phone: employee?.phone || "",
        position: employee?.position || "",
        affiliation: employee?.affiliation || "",
        departmentId: employee?.dept?.id?.toString() || "",
        status: employee?.status || "ACTIVE",
        hireDate: "",
    };
}

interface UseEditEmployeeOptions {
    employee: Employee | null;
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

interface UseEditEmployeeReturn {
    formData: EmployeeFormData;
    departments: Department[];
    isLoading: boolean;
    error: string;
    fieldErrors: Record<string, string>;
    handleFieldChange: <K extends keyof EmployeeFormData>(
        field: K,
        value: EmployeeFormData[K],
    ) => void;
    handleStatusChange: (value: string) => void;
    handleSubmit: (e: React.FormEvent) => Promise<void>;
    handleClose: () => void;
}

export function useEditEmployee({
    employee,
    isOpen,
    onClose,
    onSuccess,
}: UseEditEmployeeOptions): UseEditEmployeeReturn {
    const [formData, setFormData] = useState<EmployeeFormData>(() =>
        buildInitialFormData(employee),
    );

    const { data: departmentData } = useSWR<{ departments: Department[] }>(
        isOpen ? "/api/departments" : null,
    );
    const departments = departmentData?.departments || [];

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    const handleFieldChange = useCallback(
        <K extends keyof EmployeeFormData>(
            field: K,
            value: EmployeeFormData[K],
        ): void => {
            setFormData((prev) => ({ ...prev, [field]: value }));
        },
        [],
    );

    const handleStatusChange = useCallback((value: string): void => {
        setFormData((prev) => ({
            ...prev,
            status: value as EmployeeStatusValue,
        }));
    }, []);

    const resetForm = (): void => {
        setFormData(buildInitialFormData(null));
        setError("");
        setFieldErrors({});
    };

    const handleClose = (): void => {
        resetForm();
        onClose();
    };

    const handleSubmit = async (e: React.FormEvent): Promise<void> => {
        e.preventDefault();
        if (!employee) return;

        setError("");
        setFieldErrors({});

        const result = updateEmployeeSchema.safeParse(formData);

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

        const apiResult = await apiPatch(
            `/api/employees/${employee.id}`,
            formData,
        );

        if (apiResult.success) {
            onSuccess?.();
        } else {
            setError(apiResult.error);
        }

        setIsLoading(false);
    };

    return {
        formData,
        departments,
        isLoading,
        error,
        fieldErrors,
        handleFieldChange,
        handleStatusChange,
        handleSubmit,
        handleClose,
    };
}
