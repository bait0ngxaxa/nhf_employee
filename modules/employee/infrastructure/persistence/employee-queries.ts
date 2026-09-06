import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { getBootstrapAdminEmails } from "@/lib/ssot/admin-bootstrap";
import { EMPLOYEE_PAGINATION_DEFAULTS } from "../../application/constants";
import type {
    EmployeeFilters,
    EmployeeRecord,
    PaginatedEmployeesResult,
} from "../../application/types";

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
