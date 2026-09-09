import crypto from "crypto";
import bcrypt from "bcryptjs";

import { runSerializableTransaction } from "@/lib/db/transaction";
import { lockUserRows } from "@/lib/db/row-locks";
import {
    findAccountForRecovery,
    findAccountForReset,
    updatePasswordAndIncrementTokenVersion,
} from "../infrastructure/persistence/account-repository";
import {
    claimPasswordResetToken,
    countRecentPasswordResetRequests,
    createPasswordResetToken,
    deleteUnusedPasswordResetTokens,
    findPasswordResetToken,
} from "../infrastructure/persistence/password-reset-repository";
import { revokeAllRefreshTokensForUserInTransaction } from "../infrastructure/persistence/refresh-token-repository";
import type { PasswordResetRequestResult, ResetPasswordResult } from "./types";

const MAX_REQUESTS_PER_HOUR = 3;
const TOKEN_EXPIRY_HOURS = 1;
const BCRYPT_SALT_ROUNDS = 12;

function hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
}

export async function requestPasswordReset(
    email: string,
): Promise<PasswordResetRequestResult> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentRequests = await countRecentPasswordResetRequests(email, oneHourAgo);
    if (recentRequests >= MAX_REQUESTS_PER_HOUR) return { rateLimited: true };

    const user = await findAccountForRecovery(email);
    if (!user || !user.isActive) return { rateLimited: false };

    await deleteUnusedPasswordResetTokens(email);

    const rawToken = crypto.randomBytes(32).toString("hex");
    await createPasswordResetToken({
        token: hashToken(rawToken),
        email,
        expiresAt: new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000),
    });

    return {
        rateLimited: false,
        rawToken,
        user: {
            email: user.email,
            name: user.name,
        },
    };
}

export async function resetPassword(
    token: string,
    password: string,
): Promise<ResetPasswordResult> {
    const resetToken = await findPasswordResetToken(hashToken(token));
    if (!resetToken) return { status: "invalid" };
    if (resetToken.used) return { status: "used" };
    if (resetToken.expiresAt <= new Date()) return { status: "expired" };

    const user = await findAccountForReset(resetToken.email);
    if (!user) return { status: "userNotFound" };

    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    const didClaim = await runSerializableTransaction(async (tx) => {
        await lockUserRows(tx, [user.id]);
        const claimedAt = new Date();
        const claimed = await claimPasswordResetToken(tx, resetToken.id, claimedAt);
        if (!claimed) return false;

        await updatePasswordAndIncrementTokenVersion(tx, user.id, hashedPassword);
        await revokeAllRefreshTokensForUserInTransaction(tx, user.id, claimedAt);
        return true;
    });

    return didClaim
        ? { status: "success", userId: user.id, email: user.email }
        : { status: "used" };
}
