import type { NextResponse } from "next/server";

import { requireApiSession, type ApiAuthResult } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { forbidden, jsonError, operationFailed } from "@/lib/ssot/http";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";

type ResponseFactory = () => NextResponse;

type ActiveEmployeeSessionOptions = {
    employeeProfileNotFoundResponse?: ResponseFactory;
    invalidUserResponse?: ResponseFactory;
};

type ActiveEmployeeSessionSuccess = Extract<ApiAuthResult, { ok: true }> & {
    employeeId: number;
};

type ActiveEmployeeSessionResult =
    | ActiveEmployeeSessionSuccess
    | Extract<ApiAuthResult, { ok: false }>;

export async function requireActiveEmployeeSession(
    options: ActiveEmployeeSessionOptions = {},
): Promise<ActiveEmployeeSessionResult> {
    const auth = await requireApiSession();
    if (!auth.ok) {
        return auth;
    }

    if (!Number.isInteger(auth.user.id)) {
        return {
            ok: false,
            response: options.invalidUserResponse?.()
                ?? jsonError(COMMON_API_MESSAGES.invalidUserId, 400),
        };
    }

    const user = await prisma.user.findUnique({
        where: { id: auth.user.id },
        select: {
            isActive: true,
            employee: {
                select: {
                    id: true,
                    status: true,
                    deletedAt: true,
                },
            },
        },
    });

    if (!user?.isActive) {
        return { ok: false, response: forbidden() };
    }
    if (!user.employee) {
        return {
            ok: false,
            response: options.employeeProfileNotFoundResponse?.() ?? operationFailed(404),
        };
    }
    if (user.employee.status !== "ACTIVE" || user.employee.deletedAt !== null) {
        return { ok: false, response: forbidden() };
    }

    return { ...auth, employeeId: user.employee.id };
}
