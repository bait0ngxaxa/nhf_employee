import type { Prisma } from "@prisma/client";

import { lockEmployeeRows, lockUserRows } from "@/lib/db/row-locks";

import {
    RoutineForbiddenError,
    RoutineValidationError,
} from "./errors";
import type { RoutineCommandActor } from "./types";

type RoutineTransaction = Prisma.TransactionClient;

export interface RoutineActorAuthorization {
    isAdmin: boolean;
    employeeId: number | null;
}

export function isRoutineAdminActor(
    role: string,
    mode: RoutineCommandActor["mode"] = undefined,
): boolean {
    return role === "ADMIN" && mode !== "LIFF_SELF_SERVICE";
}

export function buildRoutineTaskEditScope(
    actorId: number,
    authorization: RoutineActorAuthorization,
): Prisma.RoutineTaskWhereInput {
    if (authorization.isAdmin) return {};

    const scopes: Prisma.RoutineTaskWhereInput[] = [
        { createdById: actorId },
    ];
    if (authorization.employeeId !== null) {
        scopes.push({
            assignees: { some: { employeeId: authorization.employeeId } },
        });
    }
    return { OR: scopes };
}

export function buildRoutineTaskDeleteScope(
    actorId: number,
    authorization: RoutineActorAuthorization,
): Prisma.RoutineTaskWhereInput {
    return authorization.isAdmin ? {} : { createdById: actorId };
}

interface ActiveUserRecord {
    id: number;
    role: string;
    isActive: boolean;
    deletedAt: Date | null;
    employee: {
        id: number;
        status: string;
        deletedAt: Date | null;
    } | null;
}

async function findActiveUser(
    tx: RoutineTransaction,
    actorId: number,
): Promise<ActiveUserRecord | null> {
    await lockUserRows(tx, [actorId]);
    return tx.user.findUnique({
        where: { id: actorId },
        select: {
            id: true,
            role: true,
            isActive: true,
            deletedAt: true,
            employee: {
                select: { id: true, status: true, deletedAt: true },
            },
        },
    });
}

function isActiveEmployee(
    employee: ActiveUserRecord["employee"],
): employee is NonNullable<ActiveUserRecord["employee"]> {
    return employee?.status === "ACTIVE" && employee.deletedAt === null;
}

export async function assertActiveRoutineActorInTransaction(
    tx: RoutineTransaction,
    actor: RoutineCommandActor,
): Promise<RoutineActorAuthorization> {
    const user = await findActiveUser(tx, actor.id);
    if (!user || !user.isActive || user.deletedAt !== null) {
        throw new RoutineForbiddenError("บัญชีผู้ใช้ไม่พร้อมดำเนินการ");
    }

    if (isRoutineAdminActor(user.role, actor.mode)) {
        if (user.employee && !isActiveEmployee(user.employee)) {
            throw new RoutineForbiddenError("บัญชีผู้ดูแลระบบไม่พร้อมดำเนินการ");
        }
        return {
            isAdmin: true,
            employeeId: user.employee?.id ?? null,
        };
    }

    if (!isActiveEmployee(user.employee)) {
        throw new RoutineForbiddenError("บัญชีพนักงานไม่พร้อมดำเนินการ");
    }

    await lockEmployeeRows(tx, [user.employee.id]);
    return { isAdmin: false, employeeId: user.employee.id };
}

export async function assertActiveAdminInTransaction(
    tx: RoutineTransaction,
    actor: RoutineCommandActor,
): Promise<void> {
    const user = await findActiveUser(tx, actor.id);
    if (!user || !user.isActive || user.deletedAt !== null || user.role !== "ADMIN") {
        throw new RoutineForbiddenError();
    }

    if (user.employee && !isActiveEmployee(user.employee)) {
        throw new RoutineForbiddenError("บัญชีผู้ดูแลระบบไม่พร้อมดำเนินการ");
    }
}

export async function assertActiveWorkforceInTransaction(
    tx: RoutineTransaction,
    actor: RoutineCommandActor,
): Promise<number> {
    const user = await findActiveUser(tx, actor.id);
    if (
        !user
        || !user.isActive
        || user.deletedAt !== null
        || !user.employee
        || !isActiveEmployee(user.employee)
    ) {
        throw new RoutineForbiddenError("บัญชีพนักงานไม่พร้อมดำเนินการ");
    }

    await lockEmployeeRows(tx, [user.employee.id]);
    return user.employee.id;
}

export async function assertActiveEmployeesInTransaction(
    tx: RoutineTransaction,
    employeeIds: readonly number[],
): Promise<void> {
    const uniqueEmployeeIds = [...new Set(employeeIds)];
    if (uniqueEmployeeIds.length === 0) {
        throw new RoutineValidationError("กรุณาระบุผู้รับผิดชอบ");
    }

    const employees = await tx.employee.findMany({
        where: {
            id: { in: uniqueEmployeeIds },
            status: "ACTIVE",
            deletedAt: null,
        },
        select: { id: true },
    });
    if (employees.length !== uniqueEmployeeIds.length) {
        throw new RoutineValidationError(
            "ผู้รับผิดชอบต้องเป็นพนักงานที่ยังปฏิบัติงาน",
        );
    }
}
