import { type EmployeeFormData, type Department } from "@/types/employees";

export interface EmployeeFormFieldsProps {
    formData: EmployeeFormData;
    fieldErrors: Record<string, string>;
    departments: Department[];
    onFieldChange: <K extends keyof EmployeeFormData>(
        field: K,
        value: EmployeeFormData[K],
    ) => void;
}
