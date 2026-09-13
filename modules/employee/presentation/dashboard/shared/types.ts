import type { EmployeeFormData, Department } from "../types";

export interface EmployeeFormFieldsProps {
    formData: EmployeeFormData;
    fieldErrors: Record<string, string>;
    departments: Department[];
    canReadDepartments: boolean;
    onFieldChange: <K extends keyof EmployeeFormData>(
        field: K,
        value: EmployeeFormData[K],
    ) => void;
}
