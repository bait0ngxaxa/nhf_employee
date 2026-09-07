import type { EmployeeStatus } from "@prisma/client";
import type { NextResponse } from "next/server";

import { requireApiSession, type ApiAuthResult } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { forbidden, jsonError, operationFailed } from "@/lib/ssot/http";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";
import { isAdminRole } from "@/lib/ssot/permissions";
import { getEmployeeDisplayName } from "@/modules/employee";

type ResponseFactory = () => NextResponse;
type ApiAuthSuccess = Extract<ApiAuthResult, { ok: true }>;
type ApiAuthFailure = Extract<ApiAuthResult, { ok: false }>;

type ActiveWorkforceSessionOptions = {
    employeeProfileNotFoundResponse?: ResponseFactory;
};

type ActiveWorkforceSessionSuccess = ApiAuthSuccess & {
    employeeId: number;
};

type ActiveWorkforceSessionResult =
    | ActiveWorkforceSessionSuccess
    | ApiAuthFailure;

type WorkforceLookupSuccess = {
    ok: true;
    auth: ApiAuthSuccess;
    employee: {
        id: number;
        firstName: string;
        lastName: string;
        nickname: string | null;
        status: EmployeeStatus;
        deletedAt: Date | null;
    } | null;
};

type WorkforceLookupResult = WorkforceLookupSuccess | ApiAuthFailure;

async function lookupWorkforceSession(): Promise<WorkforceLookupResult> {
    const auth = await requireApiSession();
    if (!auth.ok) {
        return auth;
    }

    if (!Number.isInteger(auth.user.id)) {
        return {
            ok: false,
            response: jsonError(COMMON_API_MESSAGES.invalidUserId, 400),
        };
    }

    const user = await prisma.user.findUnique({
        where: { id: auth.user.id },
        select: {
            isActive: true,
            deletedAt: true,
            employee: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    nickname: true,
                    status: true,
                    deletedAt: true,
                },
            },
        },
    });

    if (!user?.isActive || user.deletedAt) {
        return { ok: false, response: forbidden() };
    }

    return { ok: true, auth, employee: user.employee };
}

function isActiveEmployee(
    employee: WorkforceLookupSuccess["employee"],
): employee is NonNullable<WorkforceLookupSuccess["employee"]> {
    return employee?.status === "ACTIVE" && employee.deletedAt === null;
}

function applyEmployeeIdentity(
    auth: ApiAuthSuccess,
    employee: WorkforceLookupSuccess["employee"],
): ApiAuthSuccess {
    if (
        !employee
        || typeof employee.firstName !== "string"
        || typeof employee.lastName !== "string"
    ) {
        return auth;
    }

    return {
        ...auth,
        user: {
            ...auth.user,
            name: getEmployeeDisplayName(employee),
        },
    };
}

export async function requireActiveWorkforceSession(
    options: ActiveWorkforceSessionOptions = {},
): Promise<ActiveWorkforceSessionResult> {
    const lookup = await lookupWorkforceSession();
    if (!lookup.ok) {
        return lookup;
    }

    if (!lookup.employee) {
        return {
            ok: false,
            response: options.employeeProfileNotFoundResponse?.()
                ?? operationFailed(404),
        };
    }
    if (!isActiveEmployee(lookup.employee)) {
        return { ok: false, response: forbidden() };
    }

    return {
        ...applyEmployeeIdentity(lookup.auth, lookup.employee),
        employeeId: lookup.employee.id,
    };
}

export async function requireActiveWorkforceOrAdminSession(): Promise<
    ActiveWorkforceSessionResult | ApiAuthSuccess
> {
    const lookup = await lookupWorkforceSession();
    if (!lookup.ok) {
        return lookup;
    }

    if (isAdminRole(lookup.auth.user.role)) {
        return applyEmployeeIdentity(lookup.auth, lookup.employee);
    }
    if (!isActiveEmployee(lookup.employee)) {
        return { ok: false, response: forbidden() };
    }

    return {
        ...applyEmployeeIdentity(lookup.auth, lookup.employee),
        employeeId: lookup.employee.id,
    };
}
