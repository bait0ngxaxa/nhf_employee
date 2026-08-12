import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    getLineConfig,
    getLineConfigurationStatus,
    getLineLiffId,
    getLineMessagingConfig,
} from "@/lib/line/config";

const LINE_CONFIGURATION_ENV_KEYS = [
    "NEXT_PUBLIC_LINE_LIFF_ID",
    "LINE_LOGIN_CHANNEL_ID",
    "LINE_APP_CHANNEL_ACCESS_TOKEN",
    "LINE_APP_CHANNEL_SECRET",
] as const;

describe("NHFapp LINE configuration", () => {
    beforeEach(() => {
        for (const key of LINE_CONFIGURATION_ENV_KEYS) {
            vi.stubEnv(key, "");
        }
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("reads the canonical NHFapp variables", () => {
        vi.stubEnv("NEXT_PUBLIC_LINE_LIFF_ID", "global-liff-id");
        vi.stubEnv("LINE_LOGIN_CHANNEL_ID", "global-login-channel");
        vi.stubEnv("LINE_APP_CHANNEL_ACCESS_TOKEN", "global-access-token");
        vi.stubEnv("LINE_APP_CHANNEL_SECRET", "global-channel-secret");

        expect(getLineLiffId()).toBe("global-liff-id");
        expect(getLineConfig()).toEqual({
            loginChannelId: "global-login-channel",
        });
        expect(getLineMessagingConfig()).toEqual({
            channelAccessToken: "global-access-token",
            channelSecret: "global-channel-secret",
        });
        expect(getLineConfigurationStatus()).toEqual({
            liffIdConfigured: true,
            loginChannelConfigured: true,
            channelAccessTokenConfigured: true,
            channelSecretConfigured: true,
        });
    });

    it("fails safely when required configuration is missing", () => {
        expect(() => getLineLiffId()).toThrow(
            "NHFapp LINE LIFF ID is not configured",
        );
        expect(() => getLineConfig()).toThrow(
            "NHFapp LINE Login channel is not configured",
        );
        expect(() => getLineMessagingConfig()).toThrow(
            "NHFapp LINE Messaging API channel is not configured",
        );
        expect(getLineConfigurationStatus()).toEqual({
            liffIdConfigured: false,
            loginChannelConfigured: false,
            channelAccessTokenConfigured: false,
            channelSecretConfigured: false,
        });
    });
});
