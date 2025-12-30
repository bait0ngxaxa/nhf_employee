import { EmployeeStatusValue } from "@/constants/employees";

export type { EmployeeStatusValue } from "@/constants/employees";

export interface Department {
    id: number;
    name: string;
    code: string;
    description?: string;
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
    nickname?: string;
    phone?: string;
    email: string;
    position: string;
    affiliation?: string;
    hireDate: string;
    status: EmployeeStatusValue;
    dept: Department;
    user?: User;
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

export interface CSVEmployee {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    position: string;
    department: string;
    affiliation?: string;
    nickname?: string;
    hireDate?: string;
}

export interface ImportError {
    row: number;
    field?: string;
    value?: string;
    error: string;
    data: Partial<CSVEmployee>;
}

export interface ImportResult {
    success: CSVEmployee[];
    imported?: number;
    failed?: number;
    errors: ImportError[];
}

export interface EmployeeCSVData {
    ลำดับ: number;
    ชื่อ: string;
    นามสกุล: string;
    ชื่อเล่น: string;
    ตำแหน่ง: string;
    สังกัด: string;
    แผนก: string;
    อีเมล: string;
    เบอร์โทร: string;
    สถานะ: string;
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

export interface EditStatusModalProps {
    employee: Employee | null;
    isOpen: boolean;
    onClose: () => void;
    onStatusUpdate: (
        employeeId: number,
        newStatus: EmployeeStatusValue
    ) => void;
}

export interface ImportEmployeeCSVProps {
    onSuccess?: () => void;
    onBack?: () => void;
}

export interface EmployeeUpdateData {
    firstName?: string;
    lastName?: string;
    nickname?: string;
    phone?: string;
    email?: string;
    position?: string;
    affiliation?: string;
    departmentId?: number;
    hireDate?: string;
    status?: EmployeeStatusValue;
}
