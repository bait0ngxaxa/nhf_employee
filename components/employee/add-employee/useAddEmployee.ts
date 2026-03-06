"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { type EmployeeFormData, type Department } from "@/types/employees";
import { createEmployeeSchema } from "@/lib/validations/employee";

const INITIAL_FORM_DATA: EmployeeFormData = {
    firstName: "",
    lastName: "",
    nickname: "",
    email: "",
    phone: "",
    position: "",
    affiliation: "",
    departmentId: "",
};

interface UseAddEmployeeOptions {
    onSuccess?: () => void;
}

interface UseAddEmployeeReturn {
    formData: EmployeeFormData;
    departments: Department[];
    isLoading: boolean;
    error: string;
    fieldErrors: Record<string, string>;
    handleFieldChange: <K extends keyof EmployeeFormData>(
        field: K,
        value: EmployeeFormData[K],
    ) => void;
    handleSubmit: (e: React.FormEvent) => Promise<void>;
}

export function useAddEmployee({
    onSuccess,
}: UseAddEmployeeOptions): UseAddEmployeeReturn {
    const [formData, setFormData] =
        useState<EmployeeFormData>(INITIAL_FORM_DATA);

    const { data: departmentData } = useSWR<{ departments: Department[] }>(
        "/api/departments",
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

    const handleSubmit = async (e: React.FormEvent): Promise<void> => {
        e.preventDefault();
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
            const response = await fetch("/api/employees", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            if (response.ok) {
                toast.success("เพิ่มพนักงานสำเร็จ!", {
                    description:
                        "ข้อมูลพนักงานใหม่ถูกเพิ่มเข้าระบบเรียบร้อยแล้ว",
                });
                setFormData(INITIAL_FORM_DATA);
                setFieldErrors({});
                onSuccess?.();
            } else {
                const data = await response.json();
                setError(data.error || "เกิดข้อผิดพลาดในการเพิ่มพนักงาน");
            }
        } catch {
            setError("เกิดข้อผิดพลาดในการเชื่อมต่อ");
        } finally {
            setIsLoading(false);
        }
    };

    return {
        formData,
        departments,
        isLoading,
        error,
        fieldErrors,
        handleFieldChange,
        handleSubmit,
    };
}
