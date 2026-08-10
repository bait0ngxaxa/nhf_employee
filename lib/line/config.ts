import { LineIdentityVerificationError } from "./errors";

const DEFAULT_LINE_LIFF_SESSION_TTL_SECONDS = 60 * 60;
const MAX_LINE_LIFF_SESSION_TTL_SECONDS = 24 * 60 * 60;
const MIN_LINE_LIFF_SESSION_SECRET_LENGTH = 32;

export interface LineRoutineConfig {
    loginChannelId: string;
}

export interface LineRoutineMessagingConfig {
    channelAccessToken: string;
}

export function getLineRoutineLiffId(): string {
    const liffId = process.env.NEXT_PUBLIC_LINE_ROUTINE_LIFF_ID?.trim();

    if (!liffId) {
        throw new LineIdentityVerificationError(
            "MISCONFIGURED",
            "LINE Routine LIFF ID is not configured",
        );
    }

    return liffId;
}

export interface LineLiffSessionConfig {
    secret: string;
    ttlSeconds: number;
}

export function getLineRoutineConfig(): LineRoutineConfig {
    const loginChannelId = process.env.LINE_ROUTINE_LOGIN_CHANNEL_ID?.trim();

    if (!loginChannelId) {
        throw new LineIdentityVerificationError(
            "MISCONFIGURED",
            "LINE Routine login channel is not configured",
        );
    }

    return { loginChannelId };
}

export function getLineRoutineMessagingConfig(): LineRoutineMessagingConfig {
    const channelAccessToken = process.env.LINE_ROUTINE_CHANNEL_ACCESS_TOKEN?.trim();

    if (!channelAccessToken) {
        throw new LineIdentityVerificationError(
            "MISCONFIGURED",
            "LINE Routine Messaging API channel is not configured",
        );
    }

    return { channelAccessToken };
}

function getLineLiffSessionTtlSeconds(): number {
    const rawTtl = process.env.LINE_LIFF_SESSION_TTL_SECONDS?.trim();
    if (!rawTtl) {
        return DEFAULT_LINE_LIFF_SESSION_TTL_SECONDS;
    }

    const ttlSeconds = Number(rawTtl);
    if (
        !Number.isInteger(ttlSeconds)
        || ttlSeconds <= 0
        || ttlSeconds > MAX_LINE_LIFF_SESSION_TTL_SECONDS
    ) {
        throw new LineIdentityVerificationError(
            "MISCONFIGURED",
            "LINE LIFF session configuration is invalid",
        );
    }

    return ttlSeconds;
}

export function getLineLiffSessionConfig(): LineLiffSessionConfig {
    const secret = process.env.LINE_LIFF_SESSION_SECRET?.trim();
    if (
        !secret
        || (process.env.NODE_ENV === "production"
            && secret.length < MIN_LINE_LIFF_SESSION_SECRET_LENGTH)
    ) {
        throw new LineIdentityVerificationError(
            "MISCONFIGURED",
            "LINE LIFF session secret is not configured",
        );
    }

    return {
        secret,
        ttlSeconds: getLineLiffSessionTtlSeconds(),
    };
}
