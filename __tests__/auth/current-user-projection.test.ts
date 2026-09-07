// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedAccount } from "@/modules/auth";
import type { CurrentEmployeeProjection } from "@/modules/employee";
import type { CurrentEmployeeLeaveProjection } from "@/modules/leave";

const { cookiesMock, resolveAccountMock, employeeProjectionMock, leaveProjectionMock } = vi.hoisted(() => ({
    cookiesMock: vi.fn(),
    resolveAccountMock: vi.fn(),
    employeeProjectionMock: vi.fn(),
    leaveProjectionMock: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("@/modules/auth", () => ({ resolveAuthenticatedAccount: resolveAccountMock }));
vi.mock("@/modules/employee", () => ({ findCurrentEmployeeProjection: employeeProjectionMock }));
vi.mock("@/modules/leave", () => ({ getCurrentEmployeeLeaveProjection: leaveProjectionMock }));

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

describe("current-user application projection", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        cookiesMock.mockResolvedValue({
            get: vi.fn(() => ({ value: "access-token" })),
        });
        resolveAccountMock.mockResolvedValue(ACCOUNT);
        employeeProjectionMock.mockResolvedValue(EMPLOYEE);
        leaveProjectionMock.mockResolvedValue(LEAVE);
    });

    it("returns the compatible Employee/Department/Leave projection", async () => {
        await expect(getCurrentUserProjection()).resolves.toEqual({
            id: "41",
            role: "ADMIN",
            email: "account@test.com",
            name: "สมชาย ใจดี (ชาย)",
            department: "วิชาการ",
            isManager: false,
            canApproveLeave: true,
            canViewLeaveReports: false,
        });
        expect(resolveAccountMock).toHaveBeenCalledWith("access-token");
        expect(employeeProjectionMock).toHaveBeenCalledWith(41);
        expect(leaveProjectionMock).toHaveBeenCalledWith(101, false);
    });

    it("keeps the broad projection unauthorized without an eligible Employee", async () => {
        employeeProjectionMock.mockResolvedValue(null);

        await expect(getCurrentUserProjection()).resolves.toBeNull();
        expect(leaveProjectionMock).not.toHaveBeenCalled();
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

    it("keeps unauthorized Auth separate from Employee projection", async () => {
        resolveAccountMock.mockResolvedValue(null);

        await expect(getCurrentUserProjection()).resolves.toBeNull();
        expect(employeeProjectionMock).not.toHaveBeenCalled();
        expect(leaveProjectionMock).not.toHaveBeenCalled();
    });
});
