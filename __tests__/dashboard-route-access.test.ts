// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getCurrentUserProjection: vi.fn(),
    redirect: vi.fn((target: string): never => {
        throw new Error(`NEXT_REDIRECT:${target}`);
    }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/app/_lib/auth/current-user", () => ({
    getCurrentUserProjection: mocks.getCurrentUserProjection,
}));

import {
    requireDashboardAuditCapability,
    requireDashboardAuthorizationAdministration,
    requireDashboardITReadAccess,
    requireDashboardITOperatorReadAccess,
    requireDashboardITSelfServiceAccess,
} from "@/app/dashboard/_lib/route-access";

describe("Dashboard Audit route authorization", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("redirects unauthenticated access to login", async () => {
        mocks.getCurrentUserProjection.mockResolvedValue(null);

        await expect(requireDashboardAuditCapability()).rejects.toThrow(
            "NEXT_REDIRECT:/login",
        );
    });

    it("redirects a trusted user without Audit capability to access denied", async () => {
        mocks.getCurrentUserProjection.mockResolvedValue({
            id: "41",
            role: "USER",
            auditCapabilities: { canReadAuditLogs: false },
        });

        await expect(requireDashboardAuditCapability()).rejects.toThrow(
            "NEXT_REDIRECT:/access-denied",
        );
    });

    it("allows a normal USER with the projected Audit capability", async () => {
        mocks.getCurrentUserProjection.mockResolvedValue({
            id: "41",
            role: "USER",
            auditCapabilities: { canReadAuditLogs: true },
        });

        await expect(requireDashboardAuditCapability()).resolves.toBeUndefined();
        expect(mocks.redirect).not.toHaveBeenCalled();
    });

    it("redirects unauthenticated Authorization Administration access to login", async () => {
        mocks.getCurrentUserProjection.mockResolvedValue(null);

        await expect(requireDashboardAuthorizationAdministration()).rejects.toThrow(
            "NEXT_REDIRECT:/login",
        );
    });

    it("redirects a normal USER from the Authorization Administration route", async () => {
        mocks.getCurrentUserProjection.mockResolvedValue({
            id: "41",
            role: "USER",
        });

        await expect(requireDashboardAuthorizationAdministration()).rejects.toThrow(
            "NEXT_REDIRECT:/access-denied",
        );
    });

    it("allows only the server-projected ADMIN into Authorization Administration", async () => {
        mocks.getCurrentUserProjection.mockResolvedValue({
            id: "41",
            role: "ADMIN",
        });

        await expect(requireDashboardAuthorizationAdministration()).resolves.toEqual({
            userId: 41,
            systemRole: "ADMIN",
        });
        expect(mocks.redirect).not.toHaveBeenCalled();
    });
});

describe("Dashboard IT Ticket route authorization", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("redirects unauthenticated self-service access to login", async () => {
        mocks.getCurrentUserProjection.mockResolvedValue(null);

        await expect(requireDashboardITSelfServiceAccess()).rejects.toThrow(
            "NEXT_REDIRECT:/login",
        );
    });

    it("denies a direct route when neither requester capability is projected", async () => {
        mocks.getCurrentUserProjection.mockResolvedValue({
            id: "41",
            role: "USER",
            itCapabilities: {
                canReadOwnTickets: false,
                canReadAllTickets: false,
                canCreateOwnTickets: false,
                canCommentOwnTickets: false,
                canCommentAllTickets: false,
                canManageTickets: false,
                canReadAnalytics: false,
            },
        });

        await expect(requireDashboardITSelfServiceAccess()).rejects.toThrow(
            "NEXT_REDIRECT:/access-denied",
        );
    });

    it("requires read authority for a direct Ticket detail route", async () => {
        mocks.getCurrentUserProjection.mockResolvedValue({
            id: "41",
            role: "USER",
            itCapabilities: { canReadOwnTickets: false, canCreateOwnTickets: true },
        });

        await expect(requireDashboardITReadAccess()).rejects.toThrow(
            "NEXT_REDIRECT:/access-denied",
        );
    });

    it("allows the server-projected requester surface without role checks", async () => {
        const capabilities = {
            canReadOwnTickets: true,
            canReadAllTickets: false,
            canCreateOwnTickets: true,
            canCommentOwnTickets: true,
            canCommentAllTickets: false,
            canManageTickets: false,
            canReadAnalytics: false,
        };
        mocks.getCurrentUserProjection.mockResolvedValue({
            id: "41",
            role: "USER",
            itCapabilities: capabilities,
        });

        await expect(requireDashboardITSelfServiceAccess()).resolves.toEqual(capabilities);
        await expect(requireDashboardITReadAccess()).resolves.toBeUndefined();
    });

    it("requires read ALL for operator routes regardless of system role", async () => {
        mocks.getCurrentUserProjection.mockResolvedValue({
            id: "41",
            role: "ADMIN",
            itCapabilities: {
                canReadOwnTickets: true,
                canReadAllTickets: false,
                canCreateOwnTickets: true,
                canCommentOwnTickets: true,
                canCommentAllTickets: false,
                canManageTickets: true,
                canReadAnalytics: false,
            },
        });

        await expect(requireDashboardITOperatorReadAccess()).rejects.toThrow(
            "NEXT_REDIRECT:/access-denied",
        );
    });

    it("allows read ALL without manage authority to reach operator routes", async () => {
        const capabilities = {
            canReadOwnTickets: true,
            canReadAllTickets: true,
            canCreateOwnTickets: true,
            canCommentOwnTickets: true,
            canCommentAllTickets: false,
            canManageTickets: false,
            canReadAnalytics: false,
        };
        mocks.getCurrentUserProjection.mockResolvedValue({
            id: "41",
            role: "USER",
            itCapabilities: capabilities,
        });

        await expect(requireDashboardITOperatorReadAccess()).resolves.toEqual(capabilities);
    });
});
