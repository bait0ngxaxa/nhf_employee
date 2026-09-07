import bcrypt from "bcryptjs";

import { hasEligibleEmployeeLifecycle } from "@/modules/employee";
import {
    buildRefreshTokenRecord,
    issueAccessToken,
} from "@/lib/auth/hybrid/tokens";
import {
    findLoginAccount,
} from "../infrastructure/persistence/account-repository";
import { createRefreshToken } from "../infrastructure/persistence/refresh-token-repository";
import type {
    AuthClientMetadata,
    HybridLoginResult,
    SignupResult,
} from "./types";

export async function authenticateHybridLogin(input: {
    email: string;
    password: string;
    metadata: AuthClientMetadata;
}): Promise<HybridLoginResult> {
    const user = await findLoginAccount(input.email);
    const isPasswordValid = user
        ? await bcrypt.compare(input.password, user.password)
        : false;

    if (
        !user
        || !isPasswordValid
        || !user.isActive
        || user.deletedAt
        || !hasEligibleEmployeeLifecycle(user.employee)
    ) {
        return {
            status: "invalidCredentials",
            userId: user?.id,
        };
    }

    const refreshDraft = buildRefreshTokenRecord({
        userId: user.id,
        userAgent: input.metadata.userAgent,
        ipAddress: input.metadata.ipAddress,
    });
    const accessToken = await issueAccessToken({
        userId: user.id,
        role: user.role,
        sessionId: refreshDraft.record.familyId,
        tokenVersion: user.tokenVersion ?? 1,
    });

    await createRefreshToken(refreshDraft.record);

    return {
        status: "success",
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
        },
        accessToken,
        rawRefreshToken: refreshDraft.rawToken,
    };
}

export function toSignupResult(
    user: { id: number; name: string; email: string; role: "USER" | "ADMIN" },
    employeeDisplayName: string,
): SignupResult {
    return {
        user,
        assignedRole: user.role,
        employeeDisplayName,
    };
}
