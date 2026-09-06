import type { EmployeeStatusValue } from "../../domain/lifecycle";

export type { EmployeeStatusValue };

export interface Department {
    id: number;
    name: string;
    code: string;
    description?: string | null;
}

export interface User {
    id: number;
    email: string;
    role: string;
}

export interface Employee {
    id: number;
    firstName: string;
    lastName: string;
    nickname?: string | null;
    phone?: string | null;
    email: string;
    position: string;
    affiliation?: string | null;
    hireDate: string;
    status: EmployeeStatusValue;
    dept: Department;
    user?: User | null;
    createdAt: string;
    updatedAt: string;
}

export interface EmployeeFormData {
    firstName: string;
    lastName: string;
    nickname?: string;
    phone?: string;
    email: string;
    position: string;
    affiliation?: string;
    departmentId: string | number;
    status?: EmployeeStatusValue;
    hireDate?: string;
}

export interface EmployeeListProps {
    refreshTrigger?: number;
    userRole?: string;
}

export interface AddEmployeeFormProps {
    isOpen?: boolean;
    onClose?: () => void;
    onSuccess?: () => void;
}

export interface EditEmployeeFormProps {
    employee: Employee | null;
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}
