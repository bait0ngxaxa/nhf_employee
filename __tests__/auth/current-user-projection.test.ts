// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedAccount } from "@/modules/auth";
import type {
    CurrentEmployeeProjection,
    EmployeePresentationCapabilities,
} from "@/modules/employee";
import type {
    CurrentEmployeeLeaveProjection,
    LeavePresentationCapabilities,
} from "@/modules/leave";

const {
    cookiesMock,
    resolveAccountMock,
    employeeProjectionMock,
    employeeCapabilitiesMock,
    employeeAuthorizationContextMock,
    leaveProjectionMock,
    leaveCapabilitiesMock,
    leaveAuthorizationContextMock,
    routineProjectionMock,
    stockContextMock,
    stockProjectionMock,
} = vi.hoisted(() => ({
    cookiesMock: vi.fn(),
    resolveAccountMock: vi.fn(),
    employeeProjectionMock: vi.fn(),
    employeeCapabilitiesMock: vi.fn(),
    employeeAuthorizationContextMock: vi.fn(),
    leaveProjectionMock: vi.fn(),
    leaveCapabilitiesMock: vi.fn(),
    leaveAuthorizationContextMock: vi.fn(),
    routineProjectionMock: vi.fn(),
    stockContextMock: vi.fn(),
    stockProjectionMock: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("@/modules/auth", () => ({ resolveAuthenticatedAccount: resolveAccountMock }));
vi.mock("@/modules/employee", () => ({
    buildEmployeeAuthorizationContext: employeeAuthorizationContextMock,
    findCurrentEmployeeProjection: employeeProjectionMock,
    getEmployeePresentationCapabilities: employeeCapabilitiesMock,
}));
vi.mock("@/modules/leave", () => ({
    buildLeaveAuthorizationContext: leaveAuthorizationContextMock,
    getCurrentEmployeeLeaveProjection: leaveProjectionMock,
    getLeavePresentationCapabilities: leaveCapabilitiesMock,
}));
vi.mock("@/modules/routine", () => ({
    getRoutinePresentationCapabilities: routineProjectionMock,
}));
vi.mock("@/modules/stock", () => ({
    buildStockAuthorizationContext: stockContextMock,
    getStockPresentationCapabilities: stockProjectionMock,
}));

import { getCurrentUserProjection } from "@/app/_lib/auth/current-user";

const ACCOUNT: AuthenticatedAccount = {
    userId: 41,
    role: "ADMIN",
    email: "account@test.com",
    name: "Account Name",
    sessionFamilyId: "family-1",
    tokenVersion: 3,
};

const EMPLOYEE: CurrentEmployeeProjection = {
    id: 101,
    firstName: "สมชาย",
    lastName: "ใจดี",
    nickname: "ชาย",
    departmentName: "วิชาการ",
    isManager: false,
};

const LEAVE: CurrentEmployeeLeaveProjection = {
    canApproveLeave: true,
    canViewLeaveReports: false,
};

const LEAVE_CAPABILITIES: LeavePresentationCapabilities = {
    canReadOwnRequests: true,
    canReadAssignedApprovals: true,
    canCreateOwnRequests: true,
    canCancelOwnRequests: true,
    canApproveAssignedRequests: true,
    canDecideAssignedCancellations: true,
    canRequestOwnNotTaken: true,
    canConfirmAssignedNotTaken: true,
    canManageApprovers: true,
};

const ROUTINE = {
    canReadTasks: true,
    canCreateTasks: true,
    canUpdateTasks: true,
    canDeleteTasks: true,
    canReadOccurrences: true,
    canOverrideOccurrences: true,
    canReassignOccurrences: true,
    canChangeOccurrenceDueDate: true,
    canManageImports: true,
};

const STOCK = {
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

const EMPLOYEE_CAPABILITIES: EmployeePresentationCapabilities = {
    canReadEmployees: true,
    canReadStats: true,
    canCreateEmployees: true,
    canUpdateEmployees: true,
    canDeleteEmployees: true,
    canImportEmployees: true,
    canExportEmployees: true,
};

describe("current-user application projection", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        cookiesMock.mockResolvedValue({
            get: vi.fn(() => ({ value: "access-token" })),
        });
        resolveAccountMock.mockResolvedValue(ACCOUNT);
        employeeProjectionMock.mockResolvedValue(EMPLOYEE);
        employeeAuthorizationContextMock.mockReturnValue({
            authorizationActor: {
                userId: 41,
                employeeId: 101,
                systemRole: "ADMIN",
                channel: "DASHBOARD",
            },
        });
        employeeCapabilitiesMock.mockResolvedValue(EMPLOYEE_CAPABILITIES);
        leaveProjectionMock.mockResolvedValue(LEAVE);
        leaveCapabilitiesMock.mockResolvedValue(LEAVE_CAPABILITIES);
        leaveAuthorizationContextMock.mockReturnValue({
            authorizationActor: {
                userId: 41,
                employeeId: 101,
                systemRole: "ADMIN",
                channel: "DASHBOARD",
            },
        });
        routineProjectionMock.mockResolvedValue(ROUTINE);
        stockContextMock.mockReturnValue({ authorizationActor: "stock-actor" });
        stockProjectionMock.mockResolvedValue(STOCK);
    });

    it("returns the server-derived Routine projection with the compatible Employee/Department/Leave projection", async () => {
        await expect(getCurrentUserProjection()).resolves.toEqual({
            id: "41",
            role: "ADMIN",
            email: "account@test.com",
            name: "สมชาย ใจดี (ชาย)",
            department: "วิชาการ",
            isManager: false,
            canApproveLeave: true,
            canViewLeaveReports: false,
            leaveCapabilities: LEAVE_CAPABILITIES,
            routineCapabilities: ROUTINE,
            stockCapabilities: STOCK,
            employeeCapabilities: EMPLOYEE_CAPABILITIES,
        });
        expect(resolveAccountMock).toHaveBeenCalledWith("access-token");
        expect(employeeProjectionMock).toHaveBeenCalledWith(41);
        expect(employeeAuthorizationContextMock).toHaveBeenCalledWith(
            { id: 41, role: "ADMIN" },
            101,
        );
        expect(employeeCapabilitiesMock).toHaveBeenCalledWith({
            authorizationActor: {
                userId: 41,
                employeeId: 101,
                systemRole: "ADMIN",
                channel: "DASHBOARD",
            },
        });
        expect(leaveProjectionMock).toHaveBeenCalledWith(101, false);
        expect(leaveCapabilitiesMock).toHaveBeenCalledWith({
            authorizationActor: {
                userId: 41,
                employeeId: 101,
                systemRole: "ADMIN",
                channel: "DASHBOARD",
            },
        });
        expect(routineProjectionMock).toHaveBeenCalledWith({
            id: 41,
            role: "ADMIN",
            email: "account@test.com",
        }, 101);
        expect(stockContextMock).toHaveBeenCalledWith({
            id: 41,
            role: "ADMIN",
        }, 101, "DASHBOARD");
        expect(stockProjectionMock).toHaveBeenCalledWith({
            authorizationActor: "stock-actor",
        });
    });

    it("keeps the broad projection unauthorized without an eligible Employee", async () => {
        employeeProjectionMock.mockResolvedValue(null);

        await expect(getCurrentUserProjection()).resolves.toBeNull();
        expect(leaveProjectionMock).not.toHaveBeenCalled();
        expect(leaveCapabilitiesMock).not.toHaveBeenCalled();
        expect(employeeCapabilitiesMock).not.toHaveBeenCalled();
    });

    it.each(["inactive", "suspended", "deleted"])(
        "keeps %s Employee state unauthorized for the broad projection",
        async () => {
            employeeProjectionMock.mockResolvedValue(null);

            await expect(getCurrentUserProjection()).resolves.toBeNull();
        },
    );

    it("preserves manager contribution to both Leave flags", async () => {
        employeeProjectionMock.mockResolvedValue({ ...EMPLOYEE, isManager: true });
        leaveProjectionMock.mockResolvedValue({
            canApproveLeave: true,
            canViewLeaveReports: true,
        } satisfies CurrentEmployeeLeaveProjection);

        await expect(getCurrentUserProjection()).resolves.toMatchObject({
            isManager: true,
            canApproveLeave: true,
            canViewLeaveReports: true,
            leaveCapabilities: LEAVE_CAPABILITIES,
        });
        expect(leaveProjectionMock).toHaveBeenCalledWith(101, true);
    });

    it("preserves Leave-owned actionable and report-history decisions", async () => {
        leaveProjectionMock.mockResolvedValue({
            canApproveLeave: false,
            canViewLeaveReports: true,
        } satisfies CurrentEmployeeLeaveProjection);

        await expect(getCurrentUserProjection()).resolves.toMatchObject({
            canApproveLeave: false,
            canViewLeaveReports: true,
        });
    });

    it("keeps the legacy approval alias relationship-sensitive when the read capability is absent", async () => {
        leaveProjectionMock.mockResolvedValue({
            canApproveLeave: true,
            canViewLeaveReports: false,
        });
        leaveCapabilitiesMock.mockResolvedValue({
            ...LEAVE_CAPABILITIES,
            canReadAssignedApprovals: false,
        });

        await expect(getCurrentUserProjection()).resolves.toMatchObject({
            canApproveLeave: false,
            leaveCapabilities: {
                canReadAssignedApprovals: false,
            },
        });
    });

    it("keeps unauthorized Auth separate from Employee projection", async () => {
        resolveAccountMock.mockResolvedValue(null);

        await expect(getCurrentUserProjection()).resolves.toBeNull();
        expect(employeeProjectionMock).not.toHaveBeenCalled();
        expect(leaveProjectionMock).not.toHaveBeenCalled();
        expect(leaveCapabilitiesMock).not.toHaveBeenCalled();
        expect(employeeCapabilitiesMock).not.toHaveBeenCalled();
    });
});
