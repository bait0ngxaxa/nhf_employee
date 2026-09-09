import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

import { findAccountIdentityById } from "@/modules/auth";
import { findLiffEmployeeByUserId } from "@/modules/employee";
import { getLiffLeaveCapabilities } from "@/modules/leave";
import { FEATURE_KEYS, isFeatureEnabled } from "@/lib/ssot/features";
import { forbidden, serverError, unauthorized } from "@/lib/ssot/http";
import { isAdminRole } from "@/lib/ssot/permissions";
import { getUserDisplayName } from "@/shared/identity/display";
import { LIFF_SESSION_COOKIE_NAME, verifyLiffSession } from "../infrastructure/session/liff-session";
import { findLineUserIdByUserId } from "../infrastructure/persistence/account-link";
import { LineIdentityVerificationError } from "@/lib/line/errors";
import type {
    LiffCapabilities,
    LiffWorkforceSession,
} from "./types";

export async function findActiveLiffWorkforceIdentity(
    userId: number,
    expectedEmployeeId?: number,
): Promise<LiffWorkforceSession | null> {
    const account = await findAccountIdentityById(userId);
    if (!account || !account.isActive || account.deletedAt !== null) {
        return null;
    }

    const employee = await findLiffEmployeeByUserId(userId, expectedEmployeeId);
    if (!employee) return null;

    return {
        user: {
            id: account.id,
            role: account.role,
            email: account.email,
            name: getUserDisplayName({
                name: account.name,
                email: account.email,
                employee,
            }),
        },
        employeeId: employee.id,
    };
}

export async function getLiffCapabilities(
    session: LiffWorkforceSession,
): Promise<LiffCapabilities> {
    const leaveEnabled = isFeatureEnabled(FEATURE_KEYS.leave);
    const routineEnabled = isFeatureEnabled(FEATURE_KEYS.routine);
    const leaveCapabilities = leaveEnabled
        ? await getLiffLeaveCapabilities(session.employeeId)
        : { canApproveLeave: false };

    return {
        canRequestStock: true,
        canProcessStockRequests: isAdminRole(session.user.role),
        canRequestLeave: leaveEnabled,
        canApproveLeave: leaveCapabilities.canApproveLeave,
        canCreateOwnRoutine: routineEnabled,
    };
}

export async function requireLiffWorkforceSession(): Promise<
    | ({ ok: true } & LiffWorkforceSession)
    | { ok: false; response: NextResponse }
> {
    const cookieStore = await cookies();
    const token = cookieStore.get(LIFF_SESSION_COOKIE_NAME)?.value;
    if (!token) return { ok: false, response: unauthorized() };

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
    if (!identity) return { ok: false, response: forbidden() };

    let currentLineUserId: string | null;
    try {
        currentLineUserId = await findLineUserIdByUserId(claims.userId);
    } catch (error) {
        console.error("LIFF current account-link authorization failed", {
            errorType: error instanceof Error ? error.name : "UnknownError",
        });
        return { ok: false, response: serverError() };
    }

    if (currentLineUserId !== claims.lineUserId) {
        return { ok: false, response: unauthorized() };
    }

    return { ok: true, ...identity };
}
