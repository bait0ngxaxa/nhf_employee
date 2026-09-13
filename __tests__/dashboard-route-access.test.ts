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

import { requireDashboardAuditCapability } from "@/app/dashboard/_lib/route-access";

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
});
