// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
    leaveRequestFindFirstMock,
    routineProjectionMock,
    stockContextMock,
    stockProjectionMock,
} = vi.hoisted(() => ({
    leaveRequestFindFirstMock: vi.fn(),
    routineProjectionMock: vi.fn(),
    stockContextMock: vi.fn(),
    stockProjectionMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
    prisma: {
        leaveRequest: {
            findFirst: leaveRequestFindFirstMock,
        },
    },
}));
vi.mock("@/modules/routine", () => ({
    getRoutinePresentationCapabilities: routineProjectionMock,
}));
vi.mock("@/modules/stock", () => ({
    buildStockAuthorizationContext: stockContextMock,
    getStockPresentationCapabilities: stockProjectionMock,
}));

import { getLiffCapabilities } from "@/modules/line";
import type { LiffWorkforceSession } from "@/modules/line";
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

const ROUTINE_CAPABILITIES = {
    canReadTasks: true,
    canCreateTasks: true,
    canUpdateTasks: true,
    canDeleteTasks: true,
    canReadOccurrences: false,
    canOverrideOccurrences: false,
    canReassignOccurrences: false,
    canChangeOccurrenceDueDate: false,
    canManageImports: false,
};

const STOCK_CAPABILITIES = {
    canReadCatalog: true,
    canReadOwnRequests: true,
    canReadAllRequests: false,
    canCreateRequests: true,
    canCancelOwnRequests: true,
    canCancelAnyRequests: false,
    canProcessRequests: false,
    canManageInventory: false,
    canExportReports: false,
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
        routineProjectionMock.mockResolvedValue(ROUTINE_CAPABILITIES);
        stockContextMock.mockReturnValue({ authorizationActor: "stock-actor" });
        stockProjectionMock.mockResolvedValue(STOCK_CAPABILITIES);
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("grants approval capability to a normal effective approver with actionable work", async () => {
        leaveRequestFindFirstMock.mockResolvedValue({ id: 101 });

        const capabilities = await getLiffCapabilities(SESSION);

        expect(capabilities.routineCapabilities).toEqual(ROUTINE_CAPABILITIES);
        expect(capabilities.stockCapabilities).toEqual(STOCK_CAPABILITIES);
        expect(capabilities.canRequestStock).toBe(true);
        expect(capabilities.canProcessStockRequests).toBe(false);
        expect(capabilities.canApproveLeave).toBe(true);
        expect(capabilities.canCreateOwnRoutine).toBe(true);
        expect(routineProjectionMock).toHaveBeenCalledWith({
            id: SESSION.user.id,
            role: SESSION.user.role,
            email: SESSION.user.email,
            mode: "LIFF_SELF_SERVICE",
        }, SESSION.employeeId);
        expect(stockContextMock).toHaveBeenCalledWith(
            SESSION.user,
            SESSION.employeeId,
            "LIFF_SELF_SERVICE",
        );
        expect(stockProjectionMock).toHaveBeenCalledWith({
            authorizationActor: "stock-actor",
        });
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

    it("does not derive own Routine creation from the feature flag alone", async () => {
        routineProjectionMock.mockResolvedValue({
            ...ROUTINE_CAPABILITIES,
            canCreateTasks: false,
        });

        const capabilities = await getLiffCapabilities(SESSION);

        expect(capabilities.canCreateOwnRoutine).toBe(false);
        expect(routineProjectionMock).toHaveBeenCalled();
    });

    it("keeps Routine unavailable when its feature is disabled", async () => {
        vi.stubEnv("NEXT_PUBLIC_FEATURE_ROUTINE", "false");

        const capabilities = await getLiffCapabilities(SESSION);

        expect(capabilities.canCreateOwnRoutine).toBe(false);
        expect(capabilities.routineCapabilities).toEqual(ROUTINE_CAPABILITIES);
    });
});
