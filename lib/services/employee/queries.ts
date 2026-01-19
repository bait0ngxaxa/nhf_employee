import { prisma } from "@/lib/prisma";
import type { Prisma, EmployeeStatus } from "@prisma/client";
import {
    EMPLOYEE_WITH_RELATIONS_INCLUDE,
    PAGINATION_DEFAULTS,
} from "./constants";
import type {
    EmployeeFilters,
    PaginatedEmployeesResult,
    EmployeeWithRelations,
} from "./types";

/**
 * Build Prisma where clause based on filters
 */
function buildWhereClause(filters: EmployeeFilters): Prisma.EmployeeWhereInput {
    const where: Prisma.EmployeeWhereInput = {};

    // Status filter
    if (filters.status && filters.status !== "all") {
        where.status = filters.status as EmployeeStatus;
    }

    // Search filter (search in multiple fields)
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

/**
 * Get paginated list of employees
 */
export async function getEmployees(
    filters: EmployeeFilters,
): Promise<PaginatedEmployeesResult> {
    const page = Math.max(1, filters.page || PAGINATION_DEFAULTS.page);
    const limit = Math.min(
        Math.max(1, filters.limit || PAGINATION_DEFAULTS.limit),
        PAGINATION_DEFAULTS.maxLimit,
    );
    const skip = (page - 1) * limit;

    const where = buildWhereClause(filters);

    const [total, employees] = await Promise.all([
        prisma.employee.count({ where }),
        prisma.employee.findMany({
            where,
            include: EMPLOYEE_WITH_RELATIONS_INCLUDE,
            orderBy: {
                createdAt: "desc",
            },
            skip,
            take: limit,
        }),
    ]);

    return {
        employees: employees as EmployeeWithRelations[],
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}

/**
 * Get single employee by ID
 */
export async function getEmployeeById(
    employeeId: number,
): Promise<EmployeeWithRelations | null> {
    const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        include: EMPLOYEE_WITH_RELATIONS_INCLUDE,
    });

    return employee as EmployeeWithRelations | null;
}

/**
 * Check if email already exists (optionally excluding a specific employee)
 */
export async function emailExists(
    email: string,
    excludeEmployeeId?: number,
): Promise<boolean> {
    const existing = await prisma.employee.findUnique({
        where: { email: email.toLowerCase() },
    });

    if (!existing) return false;
    if (excludeEmployeeId && existing.id === excludeEmployeeId) return false;
    return true;
}
