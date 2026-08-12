import { getLineConfig } from "./config";
import { LineIdentityVerificationError } from "./errors";
import type { VerifiedLineIdentity } from "./types";

const LINE_ID_TOKEN_VERIFICATION_URL =
    "https://api.line.me/oauth2/v2.1/verify";
const LINE_ID_TOKEN_ISSUER = "https://access.line.me";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidLineVerificationResponse(
    value: unknown,
    loginChannelId: string,
): value is Record<string, unknown> & {
    sub: string;
    aud: string;
    exp: number;
} {
    if (!isRecord(value)) {
        return false;
    }

    const { sub, aud, exp, iss } = value;
    return (
        typeof sub === "string"
        && sub.trim().length > 0
        && typeof aud === "string"
        && aud === loginChannelId
        && typeof exp === "number"
        && Number.isInteger(exp)
        && exp > Math.floor(Date.now() / 1000)
        && (iss === undefined || iss === LINE_ID_TOKEN_ISSUER)
    );
}

function invalidTokenError(): LineIdentityVerificationError {
    return new LineIdentityVerificationError(
        "INVALID_TOKEN",
        "LINE ID token is invalid or expired",
    );
}

export async function verifyLineIdToken(
    idToken: string,
): Promise<VerifiedLineIdentity> {
    const token = typeof idToken === "string" ? idToken.trim() : "";
    if (!token) {
        throw invalidTokenError();
    }

    const { loginChannelId } = getLineConfig();
    const requestBody = new URLSearchParams({
        id_token: token,
        client_id: loginChannelId,
    });

    let response: Response;
    try {
        response = await fetch(LINE_ID_TOKEN_VERIFICATION_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: requestBody.toString(),
        });
    } catch {
        throw new LineIdentityVerificationError(
            "UPSTREAM_ERROR",
            "LINE ID token verification is unavailable",
        );
    }

    if (!response.ok) {
        if (response.status === 400 || response.status === 401) {
            throw invalidTokenError();
        }

        throw new LineIdentityVerificationError(
            "UPSTREAM_ERROR",
            "LINE ID token verification is unavailable",
        );
    }

    let responseBody: unknown;
    try {
        responseBody = await response.json();
    } catch {
        throw new LineIdentityVerificationError(
            "UPSTREAM_ERROR",
            "LINE returned an invalid verification response",
        );
    }

    if (!isValidLineVerificationResponse(responseBody, loginChannelId)) {
        throw invalidTokenError();
    }

    return {
        lineUserId: responseBody.sub.trim(),
    };
}

export { LineIdentityVerificationError } from "./errors";
