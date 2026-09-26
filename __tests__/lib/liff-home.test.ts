import { afterEach, describe, expect, it, vi } from "vitest";

import {
    getLiffConfiguredModules,
    getLiffHomeModules,
} from "@/modules/line";

const ROUTINE_READ_ALLOWED = {
    leaveCapabilities: { canReadOwnRequests: true, canReadAssignedApprovals: false },
    routineCapabilities: { canReadTasks: true },
    stockCapabilities: { canReadCatalog: true, canReadOwnRequests: true, canProcessRequests: false },
    itCapabilities: { canReadOwnTickets: true, canCreateOwnTickets: false },
};

const ROUTINE_READ_DENIED = {
    leaveCapabilities: { canReadOwnRequests: false, canReadAssignedApprovals: false },
    routineCapabilities: { canReadTasks: false },
    stockCapabilities: { canReadCatalog: false, canReadOwnRequests: false, canProcessRequests: false },
    itCapabilities: { canReadOwnTickets: false, canCreateOwnTickets: false },
};

const STOCK_PROCESSOR_ONLY = {
    leaveCapabilities: { canReadOwnRequests: false, canReadAssignedApprovals: false },
    routineCapabilities: { canReadTasks: false },
    stockCapabilities: { canReadCatalog: false, canReadOwnRequests: false, canProcessRequests: true },
    itCapabilities: { canReadOwnTickets: false, canCreateOwnTickets: false },
};

describe("LIFF home module availability", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("enables Routine only when the feature and read capability are both available", () => {
        vi.stubEnv("NEXT_PUBLIC_FEATURE_LEAVE", "false");
        vi.stubEnv("NEXT_PUBLIC_FEATURE_ROUTINE", "true");

        expect(getLiffHomeModules(ROUTINE_READ_ALLOWED)).toEqual({
            stock: { enabled: true, status: "available" },
            leave: { enabled: false, status: "unavailable" },
            routine: { enabled: true, status: "available" },
            it: { enabled: true, status: "available" },
        });
        expect(getLiffHomeModules(ROUTINE_READ_DENIED).routine).toEqual({
            enabled: false,
            status: "unavailable",
        });
    });

    it("keeps Routine unavailable when the feature is disabled", () => {
        vi.stubEnv("NEXT_PUBLIC_FEATURE_ROUTINE", "false");

        expect(getLiffHomeModules(ROUTINE_READ_ALLOWED).routine).toEqual({
            enabled: false,
            status: "unavailable",
        });
    });

    it("enables Stock for any usable current LIFF surface", () => {
        vi.stubEnv("NEXT_PUBLIC_FEATURE_STOCK", "true");

        expect(getLiffHomeModules(STOCK_PROCESSOR_ONLY).stock).toEqual({
            enabled: true,
            status: "available",
        });
        expect(getLiffHomeModules(ROUTINE_READ_DENIED).stock).toEqual({
            enabled: false,
            status: "unavailable",
        });
    });

    it("enables Leave for assigned approval reads even without request creation", () => {
        vi.stubEnv("NEXT_PUBLIC_FEATURE_LEAVE", "true");

        expect(getLiffHomeModules({
            ...ROUTINE_READ_DENIED,
            leaveCapabilities: {
                canReadOwnRequests: false,
                canReadAssignedApprovals: true,
            },
        }).leave).toEqual({
            enabled: true,
            status: "available",
        });
        expect(getLiffHomeModules(ROUTINE_READ_DENIED).leave).toEqual({
            enabled: false,
            status: "unavailable",
        });
    });

    it("keeps non-Routine module configuration unchanged", () => {
        vi.stubEnv("NEXT_PUBLIC_FEATURE_LEAVE", "true");
        vi.stubEnv("NEXT_PUBLIC_FEATURE_ROUTINE", "false");
        vi.stubEnv("NEXT_PUBLIC_FEATURE_STOCK", "false");

        expect(getLiffConfiguredModules().stock).toEqual({
            enabled: true,
            status: "available",
        });
        expect(getLiffConfiguredModules().leave).toEqual({
            enabled: true,
            status: "available",
        });
    });

    it("configures IT at the product level without an IT feature flag", () => {
        vi.stubEnv("NEXT_PUBLIC_FEATURE_LEAVE", "false");
        vi.stubEnv("NEXT_PUBLIC_FEATURE_ROUTINE", "false");
        vi.stubEnv("NEXT_PUBLIC_FEATURE_IT", "false");

        expect(getLiffConfiguredModules().it).toEqual({
            enabled: true,
            status: "available",
        });
    });

    it("enables requester IT when own-ticket read or create is available", () => {
        vi.stubEnv("NEXT_PUBLIC_FEATURE_IT", "false");

        expect(getLiffHomeModules(ROUTINE_READ_ALLOWED).it).toEqual({
            enabled: true,
            status: "available",
        });
        expect(getLiffHomeModules({
            ...ROUTINE_READ_DENIED,
            itCapabilities: { canReadOwnTickets: false, canCreateOwnTickets: true },
        }).it).toEqual({
            enabled: true,
            status: "available",
        });
    });

    it("does not expose IT from manage or analytics capabilities alone", () => {
        const operatorOnly = {
            ...ROUTINE_READ_DENIED,
            itCapabilities: {
                canReadOwnTickets: false,
                canCreateOwnTickets: false,
                canManageTickets: true,
                canReadAnalytics: true,
            },
        };

        expect(getLiffHomeModules(operatorOnly).it).toEqual({
            enabled: false,
            status: "unavailable",
        });
    });
});
