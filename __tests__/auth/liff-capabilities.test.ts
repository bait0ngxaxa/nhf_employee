// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { leaveRequestFindFirstMock } = vi.hoisted(() => ({
    leaveRequestFindFirstMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
    prisma: {
        leaveRequest: {
            findFirst: leaveRequestFindFirstMock,
        },
    },
}));

import { getLiffCapabilities } from "@/lib/auth/liff";
import type { LiffWorkforceSession } from "@/lib/auth/liff";
import {
    getActionableLeaveApprovalWhere,
    getAssignedLeaveApproverWhere,
} from "@/modules/leave";

const SESSION: LiffWorkforceSession = {
    user: {
        id: 10,
        role: "USER",
        email: "employee@example.com",
        name: "พนักงาน ทดสอบ",
    },
    employeeId: 20,
};

function expectActionableApproverQuery(): void {
    expect(leaveRequestFindFirstMock).toHaveBeenCalledWith({
        where: {
            AND: [
                getAssignedLeaveApproverWhere(SESSION.employeeId),
                getActionableLeaveApprovalWhere(),
            ],
        },
        select: { id: true },
    });
}

describe("LIFF capability derivation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv("NEXT_PUBLIC_FEATURE_LEAVE", "true");
        vi.stubEnv("NEXT_PUBLIC_FEATURE_ROUTINE", "true");
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("grants approval capability to a normal effective approver with actionable work", async () => {
        leaveRequestFindFirstMock.mockResolvedValue({ id: 101 });

        const capabilities = await getLiffCapabilities(SESSION);

        expect(capabilities.canApproveLeave).toBe(true);
        expectActionableApproverQuery();
    });

    it("grants approval capability to an exception approver with actionable work", async () => {
        leaveRequestFindFirstMock.mockResolvedValue({ id: 102 });

        const capabilities = await getLiffCapabilities({
            ...SESSION,
            user: { ...SESSION.user, role: "USER" },
        });

        expect(capabilities.canApproveLeave).toBe(true);
        expectActionableApproverQuery();
    });

    it("does not grant approval capability to an admin without assigned workload", async () => {
        leaveRequestFindFirstMock.mockResolvedValue(null);

        const capabilities = await getLiffCapabilities({
            ...SESSION,
            user: { ...SESSION.user, role: "ADMIN" },
        });

        expect(capabilities.canApproveLeave).toBe(false);
        expectActionableApproverQuery();
    });

    it("does not grant approval capability for historical or non-actionable requests", async () => {
        leaveRequestFindFirstMock.mockResolvedValue(null);

        const capabilities = await getLiffCapabilities(SESSION);

        expect(capabilities.canApproveLeave).toBe(false);
        expectActionableApproverQuery();
    });

    it("does not query Leave approval work when Leave is disabled", async () => {
        vi.stubEnv("NEXT_PUBLIC_FEATURE_LEAVE", "false");

        const capabilities = await getLiffCapabilities(SESSION);

        expect(capabilities.canApproveLeave).toBe(false);
        expect(leaveRequestFindFirstMock).not.toHaveBeenCalled();
    });
});
