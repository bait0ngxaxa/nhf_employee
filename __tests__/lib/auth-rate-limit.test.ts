import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    isAuthRateLimited,
    clearAuthIdentityRateLimit,
    recordAuthAttempt,
    reserveAuthAttempt,
    resetAuthRateLimit,
} from "@/lib/auth/rate-limit";

const policy = {
    windowMs: 60 * 1000,
    maxAttemptsPerIdentity: 2,
    maxAttemptsPerIp: 4,
} as const;

describe("auth rate limit", () => {
    beforeEach(() => {
        resetAuthRateLimit();
        vi.useRealTimers();
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

    it("uses a fixed window and resets after the exact expiry boundary", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-09-09T00:00:00.000Z"));

        recordAuthAttempt({
            scope: "login",
            identity: "user@thainhf.org",
            ipAddress: "10.0.0.1",
        }, policy);

        expect(isAuthRateLimited({
            scope: "login",
            identity: "user@thainhf.org",
            ipAddress: "10.0.0.1",
        }, { ...policy, maxAttemptsPerIdentity: 1 })).toBe(true);

        vi.advanceTimersByTime(policy.windowMs);

        expect(isAuthRateLimited({
            scope: "login",
            identity: "user@thainhf.org",
            ipAddress: "10.0.0.1",
        }, { ...policy, maxAttemptsPerIdentity: 1 })).toBe(false);
    });

    it("clears only the identity bucket and keeps the IP bucket", () => {
        const input = {
            scope: "signup",
            identity: "user@thainhf.org",
            ipAddress: "10.0.0.1",
        };
        const ipPolicy = {
            ...policy,
            maxAttemptsPerIdentity: 1,
            maxAttemptsPerIp: 2,
        };

        recordAuthAttempt(input, ipPolicy);
        clearAuthIdentityRateLimit(input);

        expect(isAuthRateLimited(input, ipPolicy)).toBe(false);
        recordAuthAttempt({ ...input, identity: "other@thainhf.org" }, ipPolicy);
        expect(isAuthRateLimited({
            ...input,
            identity: "new@thainhf.org",
        }, ipPolicy)).toBe(true);
    });

    it("uses one shared unknown-IP bucket for missing IP metadata", () => {
        const unknownIpPolicy = {
            ...policy,
            maxAttemptsPerIdentity: 10,
            maxAttemptsPerIp: 2,
        };

        recordAuthAttempt({
            scope: "forgot-password",
            identity: "first@thainhf.org",
        }, unknownIpPolicy);
        recordAuthAttempt({
            scope: "forgot-password",
            identity: "second@thainhf.org",
        }, unknownIpPolicy);

        expect(isAuthRateLimited({
            scope: "forgot-password",
            identity: "third@thainhf.org",
        }, unknownIpPolicy)).toBe(true);
    });

    it("reserves identity and IP slots atomically within one process", () => {
        const reservations = Array.from({ length: policy.maxAttemptsPerIdentity + 2 }, (_, index) =>
            reserveAuthAttempt({
                scope: "login",
                identity: "parallel@thainhf.org",
                ipAddress: `10.0.0.${index + 1}`,
            }, policy),
        );

        expect(reservations.slice(0, policy.maxAttemptsPerIdentity).every(Boolean)).toBe(true);
        expect(reservations.slice(policy.maxAttemptsPerIdentity).every((value) => value === null)).toBe(true);

        for (const reservation of reservations) {
            reservation?.commit();
        }
    });

    it("keeps parallel identity and IP budgets independent", async () => {
        const sameIpReservations = await Promise.all(
            Array.from({ length: policy.maxAttemptsPerIp + 1 }, (_, index) =>
                Promise.resolve(
                    reserveAuthAttempt({
                        scope: "login",
                        identity: `parallel-${index}@thainhf.org`,
                        ipAddress: "10.0.0.1",
                    }, policy),
                ),
            ),
        );

        expect(sameIpReservations.slice(0, policy.maxAttemptsPerIp).every(Boolean))
            .toBe(true);
        expect(sameIpReservations.at(-1)).toBeNull();
        for (const reservation of sameIpReservations) {
            reservation?.commit();
        }

        resetAuthRateLimit();

        const sameIdentityReservations = await Promise.all(
            Array.from({ length: policy.maxAttemptsPerIdentity + 1 }, (_, index) =>
                Promise.resolve(
                    reserveAuthAttempt({
                        scope: "login",
                        identity: "parallel@thainhf.org",
                        ipAddress: `10.0.0.${index + 1}`,
                    }, policy),
                ),
            ),
        );

        expect(sameIdentityReservations.slice(0, policy.maxAttemptsPerIdentity).every(Boolean))
            .toBe(true);
        expect(sameIdentityReservations.at(-1)).toBeNull();
        for (const reservation of sameIdentityReservations) {
            reservation?.commit();
        }
    });

    it("releases a successful-auth reservation without counting it", () => {
        const input = {
            scope: "login",
            identity: "success@thainhf.org",
            ipAddress: "10.0.0.1",
        };

        const reservation = reserveAuthAttempt(input, {
            ...policy,
            maxAttemptsPerIdentity: 1,
            maxAttemptsPerIp: 1,
        });
        expect(reservation).not.toBeNull();

        reservation?.release();

        expect(isAuthRateLimited(input, {
            ...policy,
            maxAttemptsPerIdentity: 1,
            maxAttemptsPerIp: 1,
        })).toBe(false);
    });
});
