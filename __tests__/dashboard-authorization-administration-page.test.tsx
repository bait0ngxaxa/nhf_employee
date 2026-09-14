// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    guard: vi.fn(),
    getOverview: vi.fn(),
}));

vi.mock("@/app/dashboard/_lib/route-access", () => ({
    requireDashboardAuthorizationAdministration: mocks.guard,
}));
vi.mock("@/modules/authorization", () => ({
    getAuthorizationAdministrationOverview: mocks.getOverview,
}));

import AuthorizationAdministrationPage from "@/app/dashboard/authorization/page";

const OVERVIEW = {
    capabilities: [],
    teams: [],
    summary: {
        registeredCapabilityCount: 0,
        administrativelyGrantableCapabilityCount: 0,
        policyActivationRequiredCapabilityCount: 0,
        deferredCapabilityCount: 0,
        teamCount: 0,
        activeTeamCount: 0,
    },
};

describe("Authorization Administration Dashboard page boundary", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.guard.mockResolvedValue({ userId: 41, systemRole: "ADMIN" });
        mocks.getOverview.mockResolvedValue(OVERVIEW);
    });

    it("checks the server-side ADMIN guard before reading the administration model", async () => {
        const page = await AuthorizationAdministrationPage();

        expect(mocks.guard).toHaveBeenCalledTimes(1);
        expect(mocks.getOverview).toHaveBeenCalledWith({
            userId: 41,
            systemRole: "ADMIN",
        });
        expect(page).toBeTruthy();
    });

    it("does not read administration data when the direct route guard denies access", async () => {
        mocks.guard.mockRejectedValue(new Error("NEXT_REDIRECT:/access-denied"));

        await expect(AuthorizationAdministrationPage()).rejects.toThrow(
            "NEXT_REDIRECT:/access-denied",
        );
        expect(mocks.getOverview).not.toHaveBeenCalled();
    });
});
