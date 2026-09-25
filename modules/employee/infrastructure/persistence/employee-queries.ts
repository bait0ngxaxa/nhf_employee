import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { getBootstrapAdminEmails } from "@/lib/ssot/admin-bootstrap";
import { EMPLOYEE_PAGINATION_DEFAULTS } from "../../application/constants";
import { hasEligibleEmployeeLifecycle } from "../../domain/lifecycle";
import type {
    CurrentWorkforceDepartmentSnapshot,
    CurrentEmployeeProjection,
    CurrentEmployeeDisplayProjection,
    EmployeeFilters,
    EmployeeRecord,
    LiffEmployeeIdentity,
    PaginatedEmployeesResult,
} from "../../application/types";

type EmployeeDisplayPersistenceContext = Pick<Prisma.TransactionClient, "employee">;

export async function getCurrentWorkforceDepartmentSnapshotInTransaction(
    tx: Prisma.TransactionClient,
    userId: number,
): Promise<CurrentWorkforceDepartmentSnapshot | null> {
    const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
            isActive: true,
            deletedAt: true,
            employee: {
                select: {
                    id: true,
                    status: true,
                    deletedAt: true,
                    departmentId: true,
                    dept: { select: { name: true } },
                },
            },
        },
    });

    if (
        user === null
        || !user.isActive
        || user.deletedAt !== null
        || user.employee === null
        || user.employee.status !== "ACTIVE"
        || user.employee.deletedAt !== null
    ) {
        return null;
    }

    return Object.freeze({
        employeeId: user.employee.id,
        departmentId: user.employee.departmentId,
        departmentName: user.employee.dept.name,
    });
}

export async function hasEligibleCurrentEmployeeForUser(
    userId: number,
): Promise<boolean> {
    const employee = await prisma.employee.findFirst({
        where: {
            user: { id: userId },
            status: "ACTIVE",
            deletedAt: null,
        },
        select: { id: true },
    });

    return employee !== null;
}

export async function findCurrentEmployeeProjection(
    userId: number,
): Promise<CurrentEmployeeProjection | null> {
    const employee = await prisma.employee.findFirst({
        where: {
            user: {
                id: userId,
                isActive: true,
                deletedAt: null,
            },
        },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            nickname: true,
            status: true,
            deletedAt: true,
            dept: { select: { name: true } },
            subordinates: { select: { id: true }, take: 1 },
        },
    });

    if (!employee || !hasEligibleEmployeeLifecycle(employee)) {
        return null;
    }

    return {
        id: employee.id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        nickname: employee.nickname,
        departmentName: employee.dept?.name ?? null,
        isManager: employee.subordinates.length > 0,
    };
}

/** Returns only active linked workforce identities for a batch of known users. */
export async function findCurrentEmployeeDisplayProjections(
    userIds: readonly number[],
    persistenceContext?: EmployeeDisplayPersistenceContext,
): Promise<readonly CurrentEmployeeDisplayProjection[]> {
    const uniqueUserIds = [...new Set(userIds)];
    if (uniqueUserIds.length === 0) return [];

    const client: EmployeeDisplayPersistenceContext = persistenceContext ?? prisma;
    const employees = await client.employee.findMany({
        where: {
            status: "ACTIVE",
            deletedAt: null,
            user: {
                id: { in: uniqueUserIds },
                isActive: true,
                deletedAt: null,
            },
        },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            nickname: true,
            user: { select: { id: true } },
        },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }, { id: "asc" }],
    });

    return employees.flatMap((employee) => employee.user === null
        ? []
        : [{
            userId: employee.user.id,
            employeeId: employee.id,
            firstName: employee.firstName,
            lastName: employee.lastName,
            nickname: employee.nickname,
        }]);
}

export async function findLiffEmployeeByUserId(
    userId: number,
    expectedEmployeeId?: number,
): Promise<LiffEmployeeIdentity | null> {
    const employee = await prisma.employee.findFirst({
        where: {
            ...(expectedEmployeeId === undefined ? {} : { id: expectedEmployeeId }),
            status: "ACTIVE",
            deletedAt: null,
            user: {
                id: userId,
                ...(expectedEmployeeId === undefined
                    ? {}
                    : { employeeId: expectedEmployeeId }),
            },
        },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            nickname: true,
        },
    });

    return employee;
}

export const EMPLOYEE_WITH_RELATIONS_INCLUDE = {
    dept: true,
    user: { select: { id: true, email: true, role: true } },
} as const satisfies Prisma.EmployeeInclude;

export function createEmployeeWhereClause(
    filters: EmployeeFilters,
): Prisma.EmployeeWhereInput {
    const bootstrapAdminEmails = getBootstrapAdminEmails();
    const where: Prisma.EmployeeWhereInput = {
        deletedAt: null,
        NOT: bootstrapAdminEmails.length === 1
            ? { email: bootstrapAdminEmails[0] }
            : { email: { in: bootstrapAdminEmails } },
    };

    if (filters.status && filters.status !== "all") where.status = filters.status;
    if (filters.search) {
        where.OR = [
            { firstName: { contains: filters.search } },
            { lastName: { contains: filters.search } },
            { nickname: { contains: filters.search } },
            { email: { contains: filters.search } },
            { position: { contains: filters.search } },
            { affiliation: { contains: filters.search } },
            { dept: { name: { contains: filters.search } } },
        ];
    }
    return where;
}

export async function listEmployees(
    filters: EmployeeFilters,
): Promise<PaginatedEmployeesResult> {
    const page = Math.max(1, filters.page || EMPLOYEE_PAGINATION_DEFAULTS.page);
    const limit = Math.min(
        Math.max(1, filters.limit || EMPLOYEE_PAGINATION_DEFAULTS.limit),
        EMPLOYEE_PAGINATION_DEFAULTS.maxLimit,
    );
    const where = createEmployeeWhereClause(filters);
    const [total, employees] = await Promise.all([
        prisma.employee.count({ where }),
        prisma.employee.findMany({
            where,
            include: EMPLOYEE_WITH_RELATIONS_INCLUDE,
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * limit,
            take: limit,
        }),
    ]);

    return {
        employees: employees as EmployeeRecord[],
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
}

export async function employeeEmailExists(
    email: string,
    excludeEmployeeId?: number,
): Promise<boolean> {
    const existing = await prisma.employee.findFirst({
        where: { email: email.toLowerCase(), deletedAt: null },
        select: { id: true },
    });
    if (!existing) return false;
    return excludeEmployeeId === undefined || existing.id !== excludeEmployeeId;
}

export async function getEmployeeStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    suspended: number;
    admin: number;
    academic: number;
}> {
    const [total, active, inactive, suspended, admin, academic] = await Promise.all([
        prisma.employee.count(),
        prisma.employee.count({ where: { status: "ACTIVE" } }),
        prisma.employee.count({ where: { status: "INACTIVE" } }),
        prisma.employee.count({ where: { status: "SUSPENDED" } }),
        prisma.employee.count({ where: { dept: { code: "ADMIN" } } }),
        prisma.employee.count({ where: { dept: { code: "ACADEMIC" } } }),
    ]);
    return { total, active, inactive, suspended, admin, academic };
}
