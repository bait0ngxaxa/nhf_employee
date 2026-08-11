import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

import {
    LIFF_SESSION_COOKIE_NAME,
    verifyLiffSession,
} from "@/lib/line/liff-session";
import { LineIdentityVerificationError } from "@/lib/line/errors";
import { prisma } from "@/lib/db/prisma";
import { getEmployeeBackedUserDisplayName } from "@/lib/helpers/employee-helpers";
import { forbidden, serverError, unauthorized } from "@/lib/ssot/http";

export interface LiffWorkforceUser {
    id: number;
    role: string;
    email: string;
    name: string | null;
}

export interface LiffWorkforceSession {
    user: LiffWorkforceUser;
    employeeId: number;
}

type LiffWorkforceSessionFailure = {
    ok: false;
    response: NextResponse;
};

export type LiffWorkforceSessionResult =
    | ({ ok: true } & LiffWorkforceSession)
    | LiffWorkforceSessionFailure;

export async function findActiveLiffWorkforceIdentity(
    userId: number,
    expectedEmployeeId?: number,
): Promise<LiffWorkforceSession | null> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            role: true,
            email: true,
            name: true,
            isActive: true,
            deletedAt: true,
            employeeId: true,
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

    if (
        !user
        || !user.isActive
        || user.deletedAt !== null
        || !user.employee
        || user.employee.status !== "ACTIVE"
        || user.employee.deletedAt !== null
        || user.employeeId !== user.employee.id
        || (expectedEmployeeId !== undefined
            && user.employee.id !== expectedEmployeeId)
    ) {
        return null;
    }

    return {
        user: {
            id: user.id,
            role: user.role,
            email: user.email,
            name: getEmployeeBackedUserDisplayName(user),
        },
        employeeId: user.employee.id,
    };
}

export async function requireLiffWorkforceSession(): Promise<LiffWorkforceSessionResult> {
    const cookieStore = await cookies();
    const token = cookieStore.get(LIFF_SESSION_COOKIE_NAME)?.value;
    if (!token) {
        return { ok: false, response: unauthorized() };
    }

    let claims;
    try {
        claims = await verifyLiffSession(token);
    } catch (error) {
        if (
            error instanceof LineIdentityVerificationError
            && error.code === "MISCONFIGURED"
        ) {
            return { ok: false, response: serverError() };
        }
        return { ok: false, response: unauthorized() };
    }

    const identity = await findActiveLiffWorkforceIdentity(
        claims.userId,
        claims.employeeId,
    );
    if (!identity) {
        return { ok: false, response: forbidden() };
    }

    return { ok: true, ...identity };
}
