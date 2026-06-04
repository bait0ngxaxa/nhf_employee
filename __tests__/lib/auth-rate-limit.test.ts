import { beforeEach, describe, expect, it } from "vitest";

import {
    isAuthRateLimited,
    recordAuthAttempt,
    resetAuthRateLimit,
} from "@/lib/auth-rate-limit";

const policy = {
    windowMs: 60 * 1000,
    maxAttemptsPerIdentity: 2,
    maxAttemptsPerIp: 4,
} as const;

describe("auth rate limit", () => {
    beforeEach(() => {
        resetAuthRateLimit();
    });

    it("limits the same identity even when the IP changes", () => {
        recordAuthAttempt({
            scope: "login",
            identity: "Admin@ThaiNHF.org",
            ipAddress: "10.0.0.1",
        }, policy);
        recordAuthAttempt({
            scope: "login",
            identity: "admin@thainhf.org",
            ipAddress: "10.0.0.2",
        }, policy);

        const limited = isAuthRateLimited({
            scope: "login",
            identity: "admin@thainhf.org",
            ipAddress: "10.0.0.3",
        }, policy);

        expect(limited).toBe(true);
    });

    it("keeps an IP bucket separate from the identity bucket", () => {
        for (let index = 0; index < 4; index += 1) {
            recordAuthAttempt({
                scope: "login",
                identity: `user-${index}@thainhf.org`,
                ipAddress: "10.0.0.1",
            }, policy);
        }

        const sameIpLimited = isAuthRateLimited({
            scope: "login",
            identity: "new-user@thainhf.org",
            ipAddress: "10.0.0.1",
        }, policy);
        const differentIpAllowed = isAuthRateLimited({
            scope: "login",
            identity: "new-user@thainhf.org",
            ipAddress: "10.0.0.2",
        }, policy);

        expect(sameIpLimited).toBe(true);
        expect(differentIpAllowed).toBe(false);
    });
});
