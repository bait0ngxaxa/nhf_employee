import { LineIdentityVerificationError } from "./errors";

const DEFAULT_LINE_LIFF_SESSION_TTL_SECONDS = 60 * 60;
const MAX_LINE_LIFF_SESSION_TTL_SECONDS = 24 * 60 * 60;
const MIN_LINE_LIFF_SESSION_SECRET_LENGTH = 32;

export interface LineConfig {
    loginChannelId: string;
}

export interface LineMessagingConfig {
    channelAccessToken: string;
    channelSecret: string | null;
}

export interface LineConfigurationStatus {
    liffIdConfigured: boolean;
    loginChannelConfigured: boolean;
    channelAccessTokenConfigured: boolean;
    channelSecretConfigured: boolean;
}

function getConfiguredValue(value: string | undefined): string | undefined {
    return value?.trim() || undefined;
}

function getConfiguredLiffId(): string | undefined {
    return getConfiguredValue(process.env.NEXT_PUBLIC_LINE_LIFF_ID);
}

function getConfiguredLoginChannelId(): string | undefined {
    return getConfiguredValue(process.env.LINE_LOGIN_CHANNEL_ID);
}

function getConfiguredMessagingChannelAccessToken(): string | undefined {
    return getConfiguredValue(process.env.LINE_APP_CHANNEL_ACCESS_TOKEN);
}

function getConfiguredMessagingChannelSecret(): string | undefined {
    return getConfiguredValue(process.env.LINE_APP_CHANNEL_SECRET);
}

export function getLineLiffId(): string {
    const liffId = getConfiguredLiffId();

    if (!liffId) {
        throw new LineIdentityVerificationError(
            "MISCONFIGURED",
            "NHFapp LINE LIFF ID is not configured",
        );
    }

    return liffId;
}

export interface LineLiffSessionConfig {
    secret: string;
    ttlSeconds: number;
}

export function getLineConfig(): LineConfig {
    const loginChannelId = getConfiguredLoginChannelId();

    if (!loginChannelId) {
        throw new LineIdentityVerificationError(
            "MISCONFIGURED",
            "NHFapp LINE Login channel is not configured",
        );
    }

    return { loginChannelId };
}

export function getLineMessagingConfig(): LineMessagingConfig {
    const channelAccessToken = getConfiguredMessagingChannelAccessToken();

    if (!channelAccessToken) {
        throw new LineIdentityVerificationError(
            "MISCONFIGURED",
            "NHFapp LINE Messaging API channel is not configured",
        );
    }

    return {
        channelAccessToken,
        channelSecret: getConfiguredMessagingChannelSecret() ?? null,
    };
}

export function getLineConfigurationStatus(): LineConfigurationStatus {
    return {
        liffIdConfigured: getConfiguredLiffId() !== undefined,
        loginChannelConfigured: getConfiguredLoginChannelId() !== undefined,
        channelAccessTokenConfigured:
            getConfiguredMessagingChannelAccessToken() !== undefined,
        channelSecretConfigured:
            getConfiguredMessagingChannelSecret() !== undefined,
    };
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
