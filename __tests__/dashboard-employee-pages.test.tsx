// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    employeeManagementSection: vi.fn(() => null),
    getCurrentUserProjection: vi.fn(),
    redirect: vi.fn((target: string): never => {
        throw new Error(`NEXT_REDIRECT:${target}`);
    }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/app/_lib/auth/current-user", () => ({
    getCurrentUserProjection: mocks.getCurrentUserProjection,
}));
vi.mock("@/modules/employee/client", () => ({
    AddEmployeeSection: () => null,
    EmployeeManagementSection: mocks.employeeManagementSection,
    EmployeeManagementSectionSkeleton: () => null,
    ImportEmployeeRouteContent: () => null,
}));

import EmployeesDashboardPage from "@/app/dashboard/employees/page";
import ImportEmployeeDashboardPage from "@/app/dashboard/employees/import/page";
import AddEmployeeDashboardPage from "@/app/dashboard/employees/new/page";

const noEmployeeCapabilities = {
    canReadEmployees: true,
    canReadStats: true,
    canCreateEmployees: false,
    canUpdateEmployees: false,
    canDeleteEmployees: false,
    canImportEmployees: false,
    canExportEmployees: true,
} as const;

const createEmployeeCapabilities = {
    ...noEmployeeCapabilities,
    canCreateEmployees: true,
} as const;

const importEmployeeCapabilities = {
    ...noEmployeeCapabilities,
    canImportEmployees: true,
} as const;

const mutationOnlyEmployeeCapabilities = {
    ...noEmployeeCapabilities,
    canReadEmployees: false,
    canReadStats: false,
    canExportEmployees: false,
    canCreateEmployees: true,
} as const;

const listOnlyEmployeeCapabilities = {
    ...noEmployeeCapabilities,
    canReadEmployees: true,
    canReadStats: false,
    canExportEmployees: false,
} as const;

const statsOnlyEmployeeCapabilities = {
    ...noEmployeeCapabilities,
    canReadEmployees: false,
    canReadStats: true,
    canExportEmployees: false,
} as const;

const adminEmployeeCapabilities = {
    canReadEmployees: true,
    canReadStats: true,
    canCreateEmployees: true,
    canUpdateEmployees: true,
    canDeleteEmployees: true,
    canImportEmployees: true,
    canExportEmployees: true,
} as const;

const user = {
    id: "41",
    role: "USER",
    email: "account@test.com",
};

describe("Employee Dashboard information route access", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getCurrentUserProjection.mockResolvedValue({
            ...user,
            employeeCapabilities: noEmployeeCapabilities,
        });
    });

    it("redirects unauthenticated access to login before rendering the section", async () => {
        mocks.getCurrentUserProjection.mockResolvedValue(null);

        await expect(EmployeesDashboardPage()).rejects.toThrow(
            "NEXT_REDIRECT:/login",
        );
        expect(mocks.employeeManagementSection).not.toHaveBeenCalled();
    });

    it("denies a mutation-only actor without an Employee read surface", async () => {
        mocks.getCurrentUserProjection.mockResolvedValue({
            ...user,
            employeeCapabilities: mutationOnlyEmployeeCapabilities,
        });

        await expect(EmployeesDashboardPage()).rejects.toThrow(
            "NEXT_REDIRECT:/access-denied",
        );
        expect(mocks.employeeManagementSection).not.toHaveBeenCalled();
    });

    it("allows a list-only actor to render the Employee page", async () => {
        mocks.getCurrentUserProjection.mockResolvedValue({
            ...user,
            employeeCapabilities: listOnlyEmployeeCapabilities,
        });

        await expect(EmployeesDashboardPage()).resolves.toBeTruthy();
    });

    it("allows a stats-only actor to render the Employee page", async () => {
        mocks.getCurrentUserProjection.mockResolvedValue({
            ...user,
            employeeCapabilities: statsOnlyEmployeeCapabilities,
        });

        await expect(EmployeesDashboardPage()).resolves.toBeTruthy();
    });

    it("preserves normal USER compatibility access to the Employee page", async () => {
        await expect(EmployeesDashboardPage()).resolves.toBeTruthy();
    });
});

describe("Employee Dashboard mutation route access", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getCurrentUserProjection.mockResolvedValue({
            ...user,
            employeeCapabilities: noEmployeeCapabilities,
        });
    });

    it("redirects unauthenticated Add Employee access to login", async () => {
        mocks.getCurrentUserProjection.mockResolvedValue(null);

        await expect(AddEmployeeDashboardPage()).rejects.toThrow(
            "NEXT_REDIRECT:/login",
        );
    });

    it("denies Add Employee without the create capability", async () => {
        await expect(AddEmployeeDashboardPage()).rejects.toThrow(
            "NEXT_REDIRECT:/access-denied",
        );
    });

    it("allows ADMIN compatibility to render Add Employee", async () => {
        mocks.getCurrentUserProjection.mockResolvedValue({
            ...user,
            role: "ADMIN",
            employeeCapabilities: adminEmployeeCapabilities,
        });

        await expect(AddEmployeeDashboardPage()).resolves.toBeTruthy();
    });

    it("allows an explicitly granted normal USER to render Add Employee", async () => {
        mocks.getCurrentUserProjection.mockResolvedValue({
            ...user,
            employeeCapabilities: createEmployeeCapabilities,
        });

        await expect(AddEmployeeDashboardPage()).resolves.toBeTruthy();
    });

    it("redirects unauthenticated Import Employee access to login", async () => {
        mocks.getCurrentUserProjection.mockResolvedValue(null);

        await expect(ImportEmployeeDashboardPage()).rejects.toThrow(
            "NEXT_REDIRECT:/login",
        );
    });

    it("denies Import Employee without the import capability", async () => {
        await expect(ImportEmployeeDashboardPage()).rejects.toThrow(
            "NEXT_REDIRECT:/access-denied",
        );
    });

    it("allows ADMIN compatibility to render Import Employee", async () => {
        mocks.getCurrentUserProjection.mockResolvedValue({
            ...user,
            role: "ADMIN",
            employeeCapabilities: adminEmployeeCapabilities,
        });

        await expect(ImportEmployeeDashboardPage()).resolves.toBeTruthy();
    });

    it("allows an explicitly granted normal USER to render Import Employee", async () => {
        mocks.getCurrentUserProjection.mockResolvedValue({
            ...user,
            employeeCapabilities: importEmployeeCapabilities,
        });

        await expect(ImportEmployeeDashboardPage()).resolves.toBeTruthy();
    });
});
