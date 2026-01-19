import type { Employee, Department, EmployeeStatus } from "@prisma/client";

// ==================== Input Types ====================

/** Filters for querying employees list */
export interface EmployeeFilters {
    search?: string;
    status?: string;
    page: number;
    limit: number;
}

/** User context for authorization checks */
export interface UserContext {
    id: number;
    role: string;
    email: string;
}

/** Data for creating a new employee */
export interface CreateEmployeeData {
    firstName: string;
    lastName: string;
    nickname?: string | null;
    email: string;
    phone?: string | null;
    position: string;
    affiliation?: string | null;
    departmentId: number;
}

/** Data for updating an existing employee */
export interface UpdateEmployeeData {
    firstName?: string;
    lastName?: string;
    nickname?: string | null;
    email?: string;
    phone?: string | null;
    position?: string;
    affiliation?: string | null;
    departmentId?: number;
    status?: EmployeeStatus;
}

// ==================== CSV Import Types ====================

/** Employee data from CSV import */
export interface CSVImportEmployee {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    position: string;
    department: string;
    affiliation?: string;
    nickname?: string;
}

/** Import error details */
export interface ImportError {
    row: number;
    data: Partial<CSVImportEmployee>;
    error: string;
}

/** Import result */
export interface ImportResult {
    success: CSVImportEmployee[];
    errors: ImportError[];
}

// ==================== Relation Types ====================

/** User info for employee */
export interface EmployeeUserInfo {
    id: number;
    email: string;
    role: string;
}

/** Employee with department and user */
export interface EmployeeWithRelations extends Employee {
    dept: Department;
    user?: EmployeeUserInfo | null;
}

// ==================== Output Types ====================

/** Paginated employees response */
export interface PaginatedEmployeesResult {
    employees: EmployeeWithRelations[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

/** Service result for mutations */
export interface EmployeeMutationResult {
    success: boolean;
    employee?: EmployeeWithRelations;
    error?: string;
    status?: number;
}
