// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as LeaveModule from "@/modules/leave";

const {
    leaveRequestFindFirstMock,
    leaveProjectionMock,
    routineProjectionMock,
    itContextMock,
    itProjectionMock,
    stockContextMock,
    stockProjectionMock,
} = vi.hoisted(() => ({
    leaveRequestFindFirstMock: vi.fn(),
    leaveProjectionMock: vi.fn(),
    routineProjectionMock: vi.fn(),
    itContextMock: vi.fn(),
    itProjectionMock: vi.fn(),
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
vi.mock("@/modules/leave", async () => {
    const actual = await vi.importActual<typeof LeaveModule>("@/modules/leave");
    return {
        ...actual,
        getLeavePresentationCapabilities: leaveProjectionMock,
    };
});
vi.mock("@/modules/routine", () => ({
    getRoutinePresentationCapabilities: routineProjectionMock,
}));
vi.mock("@/modules/it", () => ({
    buildITAuthorizationContext: itContextMock,
    getITPresentationCapabilities: itProjectionMock,
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
    canExportTasks: false,
    canReadSummary: true,
    canReadAllSummary: false,
    canReadReference: true,
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

const LEAVE_CAPABILITIES = {
    canReadOwnRequests: true,
    canReadAssignedApprovals: true,
    canCreateOwnRequests: true,
    canCancelOwnRequests: true,
    canApproveAssignedRequests: true,
    canDecideAssignedCancellations: false,
    canRequestOwnNotTaken: true,
    canConfirmAssignedNotTaken: true,
    canManageApprovers: false,
    canManageRecovery: false,
} as const;

const IT_CAPABILITIES = {
    canReadOwnTickets: true,
    canReadAllTickets: false,
    canCreateOwnTickets: true,
    canCommentOwnTickets: true,
    canCommentAllTickets: false,
    canManageTickets: false,
    canReadAnalytics: false,
} as const;

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
        itContextMock.mockReturnValue({ authorizationActor: "it-actor" });
        itProjectionMock.mockResolvedValue(IT_CAPABILITIES);
        leaveProjectionMock.mockResolvedValue(LEAVE_CAPABILITIES);
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
        expect(capabilities.leaveCapabilities).toEqual(LEAVE_CAPABILITIES);
        expect(capabilities.leaveCapabilities.canDecideAssignedCancellations).toBe(false);
        expect(capabilities.canCreateOwnRoutine).toBe(true);
        expect(capabilities.itCapabilities).toEqual(IT_CAPABILITIES);
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
        expect(itContextMock).toHaveBeenCalledWith(
            SESSION.user,
            SESSION.employeeId,
            "LIFF_SELF_SERVICE",
        );
        expect(itProjectionMock).toHaveBeenCalledWith({
            authorizationActor: "it-actor",
        });
        expect(leaveProjectionMock).toHaveBeenCalledWith({
            authorizationActor: {
                userId: SESSION.user.id,
                employeeId: SESSION.employeeId,
                systemRole: SESSION.user.role,
                channel: "LIFF_SELF_SERVICE",
            },
        });
        expectActionableApproverQuery();
    });

    it("projects IT from verified LIFF workforce identity without operator authority", async () => {
        const capabilities = await getLiffCapabilities(SESSION);

        expect(itContextMock).toHaveBeenCalledWith(
            SESSION.user,
            SESSION.employeeId,
            "LIFF_SELF_SERVICE",
        );
        expect(capabilities.itCapabilities.canReadOwnTickets).toBe(true);
        expect(capabilities.itCapabilities.canCreateOwnTickets).toBe(true);
        expect(capabilities.itCapabilities.canManageTickets).toBe(false);
        expect(capabilities.itCapabilities.canReadAnalytics).toBe(false);
    });

    it("grants approval capability to an exception approver with actionable work", async () => {
        leaveRequestFindFirstMock.mockResolvedValue({ id: 102 });

        const capabilities = await getLiffCapabilities({
            ...SESSION,
            user: { ...SESSION.user, role: "USER" },
        });

        expect(capabilities.canApproveLeave).toBe(true);
        expect(capabilities.leaveCapabilities).toEqual(LEAVE_CAPABILITIES);
        expectActionableApproverQuery();
    });

    it("does not grant approval capability to an admin without assigned workload", async () => {
        leaveRequestFindFirstMock.mockResolvedValue(null);

        const capabilities = await getLiffCapabilities({
            ...SESSION,
            user: { ...SESSION.user, role: "ADMIN" },
        });

        expect(capabilities.canApproveLeave).toBe(false);
        expect(capabilities.leaveCapabilities).toEqual(LEAVE_CAPABILITIES);
        expectActionableApproverQuery();
    });

    it("does not grant approval capability for historical or non-actionable requests", async () => {
        leaveRequestFindFirstMock.mockResolvedValue(null);

        const capabilities = await getLiffCapabilities(SESSION);

        expect(capabilities.canApproveLeave).toBe(false);
        expect(capabilities.leaveCapabilities).toEqual(LEAVE_CAPABILITIES);
        expectActionableApproverQuery();
    });

    it("does not query Leave approval work when Leave is disabled", async () => {
        vi.stubEnv("NEXT_PUBLIC_FEATURE_LEAVE", "false");

        const capabilities = await getLiffCapabilities(SESSION);

        expect(capabilities.canApproveLeave).toBe(false);
        expect(capabilities.leaveCapabilities).toEqual({
            canReadOwnRequests: false,
            canReadAssignedApprovals: false,
            canCreateOwnRequests: false,
            canCancelOwnRequests: false,
            canApproveAssignedRequests: false,
            canDecideAssignedCancellations: false,
            canRequestOwnNotTaken: false,
            canConfirmAssignedNotTaken: false,
            canManageApprovers: false,
            canManageRecovery: false,
        });
        expect(leaveRequestFindFirstMock).not.toHaveBeenCalled();
    });

    it("does not query Leave approval work when assigned-read capability is unavailable", async () => {
        leaveProjectionMock.mockResolvedValue({
            ...LEAVE_CAPABILITIES,
            canReadAssignedApprovals: false,
        });

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
