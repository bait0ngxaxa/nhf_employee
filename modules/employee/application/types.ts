import type { Prisma } from "@prisma/client";

import type {
    EmployeeLifecycleOperation,
    EmployeeStatusValue,
} from "../domain/lifecycle";

export interface EmployeeFilters {
    search?: string;
    status?: EmployeeStatusValue | "all";
    page: number;
    limit: number;
}

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

export interface UpdateEmployeeData extends Partial<CreateEmployeeData> {
    status?: EmployeeStatusValue;
}

export interface EmployeeDepartmentReference {
    id: number;
    name: string;
    code: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface EmployeeUserReference {
    id: number;
    email: string;
    role: string;
}

export interface EmployeeRecord {
    id: number;
    firstName: string;
    lastName: string;
    phone: string | null;
    email: string;
    position: string;
    hireDate: Date;
    status: EmployeeStatusValue;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    departmentId: number;
    affiliation: string | null;
    nickname: string | null;
    managerId: number | null;
    dept: EmployeeDepartmentReference;
    user?: EmployeeUserReference | null;
}

export interface CurrentEmployeeProjection {
    id: number;
    firstName: string;
    lastName: string;
    nickname: string | null;
    departmentName: string | null;
    isManager: boolean;
}

export interface PaginatedEmployeesResult {
    employees: EmployeeRecord[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface EmployeeMutationResult {
    success: boolean;
    employee?: EmployeeRecord;
    error?: string;
    status?: number;
    beforeData?: Record<string, unknown>;
    lifecycle?: EmployeeLifecycleOperation;
    auditRecorded?: boolean;
}

export interface EmployeeLifecycleActor {
    userId: number;
    email: string;
}

export interface EmployeeAccountLifecycleRecord {
    id: number;
    name: string;
    email: string;
    role: string;
    isActive: boolean;
    deletedAt: Date | null;
}

export interface EmployeeAccountLifecycleProvider {
    lockAccountForLifecycle(
        tx: Prisma.TransactionClient,
        userId: number,
    ): Promise<void>;
    assertAccountCanDeactivate(
        tx: Prisma.TransactionClient,
        account: EmployeeAccountLifecycleRecord,
        actorUserId: number,
    ): Promise<void>;
    applyAccountLifecycle(
        tx: Prisma.TransactionClient,
        input: {
            accountId: number;
            operation: EmployeeLifecycleOperation;
            identity: { name?: string; email?: string };
            revokedAt: Date;
        },
    ): Promise<void>;
    synchronizeAccountIdentity(
        tx: Prisma.TransactionClient,
        accountId: number,
        identity: { name?: string; email?: string },
    ): Promise<void>;
}

export interface EmployeeOffboardingDependency {
    id: string;
    employee: {
        id: number;
        firstName: string;
        lastName: string;
        nickname: string | null;
    };
}

export type EmployeeOffboardingDependencyProvider = (
    tx: Prisma.TransactionClient,
    employeeId: number,
) => Promise<readonly EmployeeOffboardingDependency[]>;

export interface CsvImportEmployee {
    sourceRow?: number;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    position: string;
    department: string;
    affiliation?: string;
    nickname?: string;
    status?: string;
}

export interface EmployeeImportError {
    row: number;
    data: Partial<CsvImportEmployee>;
    error: string;
}

export interface EmployeeImportResult {
    success: CsvImportEmployee[];
    errors: EmployeeImportError[];
}
