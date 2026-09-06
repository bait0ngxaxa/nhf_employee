import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { lockEmployeeRows } from "@/lib/db/row-locks";
import {
    hasEligibleEmployeeLifecycle,
    type EmployeeStatusValue,
} from "../domain/lifecycle";

const SIGNUP_EMPLOYEE_SELECT = {
    id: true,
    firstName: true,
    lastName: true,
    nickname: true,
    email: true,
    status: true,
    deletedAt: true,
    user: { select: { id: true } },
} as const satisfies Prisma.EmployeeSelect;

export interface SignupEmployee {
    id: number;
    firstName: string;
    lastName: string;
    nickname: string | null;
    email: string;
    status: EmployeeStatusValue;
    deletedAt: Date | null;
    user: { id: number } | null;
}

export async function findSignupEmployee(email: string): Promise<SignupEmployee | null> {
    return prisma.employee.findUnique({ where: { email }, select: SIGNUP_EMPLOYEE_SELECT });
}

export async function lockAndRecheckSignupEmployee(
    tx: Prisma.TransactionClient,
    employeeId: number,
    expectedEmail: string,
): Promise<SignupEmployee | null> {
    await lockEmployeeRows(tx, [employeeId]);
    const employee = await tx.employee.findUnique({
        where: { id: employeeId },
        select: SIGNUP_EMPLOYEE_SELECT,
    });
    if (!employee || employee.email !== expectedEmail || !hasEligibleEmployeeLifecycle(employee)) {
        return null;
    }
    return employee;
}
