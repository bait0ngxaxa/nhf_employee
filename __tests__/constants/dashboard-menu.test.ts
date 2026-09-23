import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
    canAccessLeaveDashboard,
    canAccessEmployeeDashboard,
    DASHBOARD_MENU_GROUPS,
    DASHBOARD_MENU_ITEMS,
    getLeaveDashboardTabVisibility,
    getDashboardPageLabel,
    getMenuTheme,
    getAvailableMenuGroups,
    normalizeLeaveDashboardTab,
} from "@/constants/dashboard";
import { isDashboardTabEnabled } from "@/lib/ssot/features";
import type { LeavePresentationCapabilities } from "@/modules/leave/client";
import type { RoutinePresentationCapabilities } from "@/modules/routine/client";
import type { StockPresentationCapabilities } from "@/modules/stock/client";
import type { EmployeePresentationCapabilities } from "@/modules/employee/client";
import type { AuditPresentationCapabilities } from "@/modules/audit/client";
import type { EmailRequestPresentationCapabilities } from "@/types/email-request";

const originalRoutineFlag = process.env.NEXT_PUBLIC_FEATURE_ROUTINE;
const originalLeaveFlag = process.env.NEXT_PUBLIC_FEATURE_LEAVE;

const routineCapabilities = {
    canReadTasks: true,
    canReadAllTasks: false,
    canCreateTasks: false,
    canCreateTasksForOthers: false,
    canUpdateTasks: false,
    canUpdateAllTasks: false,
    canDeleteTasks: false,
    canDeleteAllTasks: false,
    canReadOccurrences: false,
    canOverrideOccurrences: false,
    canReassignOccurrences: false,
    canChangeOccurrenceDueDate: false,
    canExportTasks: true,
    canReadSummary: true,
    canReadAllSummary: false,
    canReadReference: true,
    canReadAllReferences: false,
} satisfies RoutinePresentationCapabilities;

const stockCapabilities = {
    canReadCatalog: true,
    canReadOwnRequests: true,
    canReadAllRequests: false,
    canCreateRequests: false,
    canCancelOwnRequests: false,
    canCancelAnyRequests: false,
    canProcessRequests: false,
    canManageInventory: false,
    canExportReports: false,
} satisfies StockPresentationCapabilities;

const noLeaveCapabilities = {
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
} satisfies LeavePresentationCapabilities;

const ownLeaveCapabilities = {
    ...noLeaveCapabilities,
    canReadOwnRequests: true,
} satisfies LeavePresentationCapabilities;

const employeeReadCapabilities = {
    canReadEmployees: true,
    canReadStats: true,
    canCreateEmployees: false,
    canUpdateEmployees: false,
    canDeleteEmployees: false,
    canImportEmployees: false,
    canExportEmployees: true,
} satisfies EmployeePresentationCapabilities;

const employeeCreateCapabilities = {
    ...employeeReadCapabilities,
    canCreateEmployees: true,
} satisfies EmployeePresentationCapabilities;

const employeeImportCapabilities = {
    ...employeeReadCapabilities,
    canImportEmployees: true,
} satisfies EmployeePresentationCapabilities;

const employeeAllCapabilities = {
    canReadEmployees: true,
    canReadStats: true,
    canCreateEmployees: true,
    canUpdateEmployees: true,
    canDeleteEmployees: true,
    canImportEmployees: true,
    canExportEmployees: true,
} satisfies EmployeePresentationCapabilities;

const auditCapabilities = {
    canReadAuditLogs: true,
} satisfies AuditPresentationCapabilities;

const emailReadCapabilities: EmailRequestPresentationCapabilities = {
    canReadRequests: true,
    canCreateRequests: false,
};

const emailCreateCapabilities: EmailRequestPresentationCapabilities = {
    canReadRequests: false,
    canCreateRequests: true,
};

function getMenuIds(
    isAdmin: boolean,
    leaveAvailability?: Parameters<typeof getAvailableMenuGroups>[3],
): string[] {
    return getAvailableMenuGroups(
        isAdmin,
        undefined,
        stockCapabilities,
        leaveAvailability,
    ).flatMap((group) => group.items.map((item) => item.id));
}

beforeEach(() => {
    process.env.NEXT_PUBLIC_FEATURE_LEAVE = "true";
});

afterEach(() => {
    if (originalRoutineFlag === undefined) {
        delete process.env.NEXT_PUBLIC_FEATURE_ROUTINE;
    } else {
        process.env.NEXT_PUBLIC_FEATURE_ROUTINE = originalRoutineFlag;
    }
    if (originalLeaveFlag === undefined) {
        delete process.env.NEXT_PUBLIC_FEATURE_LEAVE;
    } else {
        process.env.NEXT_PUBLIC_FEATURE_LEAVE = originalLeaveFlag;
    }
});

describe("dashboard menu", () => {
    it("groups sidebar destinations by work area", () => {
        expect(DASHBOARD_MENU_GROUPS.map((group) => [
            group.label,
            group.items.map((item) => item.id),
        ])).toEqual([
            ["บริการภายใน", ["leave-management", "stock", "routine"]],
            ["บุคลากร", ["employee-management", "add-employee", "email-request"]],
            ["ระบบและสิทธิ์", ["audit-logs", "authorization-administration"]],
        ]);
    });

    it("keeps Thai task labels specific to the dashboard sidebar", () => {
        const menuItem = (id: string) =>
            DASHBOARD_MENU_ITEMS.find((item) => item.id === id);

        expect(menuItem("leave-management")).toMatchObject({
            label: "NHF Leave",
            sidebarLabel: "การลา",
        });
        expect(menuItem("stock")).toMatchObject({
            label: "NHF Stock",
            sidebarLabel: "วัสดุและคลัง",
        });
        expect(menuItem("routine")).toMatchObject({
            label: "NHF Routine",
            sidebarLabel: "งานประจำ",
        });
        expect(menuItem("email-request")).toMatchObject({
            label: "ส่งคำร้องพนักงานใหม่",
            sidebarLabel: "คำร้องบริการ IT",
        });
        expect(getDashboardPageLabel("routine")).toBe("NHF Routine");
    });

    it("uses Employee read surfaces for people-menu availability", () => {
        expect(canAccessEmployeeDashboard()).toBe(false);
        expect(canAccessEmployeeDashboard({
            ...employeeReadCapabilities,
            canReadEmployees: false,
        })).toBe(true);
        expect(canAccessEmployeeDashboard({
            ...employeeReadCapabilities,
            canReadStats: false,
        })).toBe(true);

        const userMenuIds = getAvailableMenuGroups(
            false,
            undefined,
            undefined,
            undefined,
            employeeReadCapabilities,
        ).flatMap((group) => group.items.map((item) => item.id));

        expect(userMenuIds).toContain("employee-management");
        expect(userMenuIds).not.toContain("add-employee");
    });

    it("keeps Employee create and import navigation independent", () => {
        const createMenuIds = getAvailableMenuGroups(
            false,
            undefined,
            undefined,
            undefined,
            employeeCreateCapabilities,
        ).flatMap((group) => group.items.map((item) => item.id));
        const importMenuIds = getAvailableMenuGroups(
            false,
            undefined,
            undefined,
            undefined,
            employeeImportCapabilities,
        ).flatMap((group) => group.items.map((item) => item.id));

        expect(createMenuIds).toContain("add-employee");
        expect(importMenuIds).not.toContain("add-employee");
        expect(DASHBOARD_MENU_ITEMS.find((item) => item.id === "add-employee")?.requiredRole)
            .toBeUndefined();
        expect(DASHBOARD_MENU_ITEMS.find((item) => item.id === "import-employee")?.requiredRole)
            .toBeUndefined();
    });

    it("does not expose Employee presentation from system role alone", () => {
        const adminMenuIds = getAvailableMenuGroups(true)
            .flatMap((group) => group.items.map((item) => item.id));

        expect(adminMenuIds).not.toContain("employee-management");
        expect(adminMenuIds).not.toContain("add-employee");
    });

    it("preserves the existing ADMIN compatibility presentation", () => {
        const adminMenuIds = getAvailableMenuGroups(
            true,
            undefined,
            undefined,
            undefined,
            employeeAllCapabilities,
        ).flatMap((group) => group.items.map((item) => item.id));

        expect(adminMenuIds).toContain("employee-management");
        expect(adminMenuIds).toContain("add-employee");
    });

    it("shows Authorization Administration only to ADMIN users", () => {
        const adminMenuIds = getAvailableMenuGroups(true)
            .flatMap((group) => group.items.map((item) => item.id));
        const userMenuIds = getAvailableMenuGroups(false)
            .flatMap((group) => group.items.map((item) => item.id));

        expect(adminMenuIds).toContain("authorization-administration");
        expect(userMenuIds).not.toContain("authorization-administration");
        expect(DASHBOARD_MENU_ITEMS.find((item) => item.id === "authorization-administration")?.requiredRole)
            .toBe("ADMIN");
    });

    it("keeps CSV import route available but hides it from dashboard menus", () => {
        expect(
            DASHBOARD_MENU_ITEMS.some((item) => item.id === "import-employee"),
        ).toBe(true);

        const adminMenuIds = getAvailableMenuGroups(true).flatMap((group) =>
            group.items.map((item) => item.id),
        );
        const userMenuIds = getAvailableMenuGroups(false).flatMap((group) =>
            group.items.map((item) => item.id),
        );

        expect(adminMenuIds).not.toContain("import-employee");
        expect(userMenuIds).not.toContain("import-employee");
    });

    it("hides NHF Routine when its feature flag is disabled", () => {
        process.env.NEXT_PUBLIC_FEATURE_ROUTINE = "false";

        expect(isDashboardTabEnabled("routine")).toBe(false);
        expect(
            getAvailableMenuGroups(true, routineCapabilities)
                .flatMap((group) => group.items.map((item) => item.id)),
        ).not.toContain("routine");
    });

    it("shows NHF Routine and its theme when its feature flag is enabled", () => {
        process.env.NEXT_PUBLIC_FEATURE_ROUTINE = "true";

        expect(isDashboardTabEnabled("routine")).toBe(true);
        expect(
            getAvailableMenuGroups(false, routineCapabilities)
                .flatMap((group) => group.items.map((item) => item.id)),
        ).toContain("routine");
        expect(getMenuTheme("routine").text).toBe("text-teal-700");
        expect(getDashboardPageLabel("routine")).toBe("NHF Routine");
    });

    it("hides NHF Routine when its read capability is false or unavailable", () => {
        process.env.NEXT_PUBLIC_FEATURE_ROUTINE = "true";

        expect(
            getAvailableMenuGroups(true, {
                ...routineCapabilities,
                canReadTasks: false,
            })
                .flatMap((group) => group.items.map((item) => item.id)),
        ).not.toContain("routine");
        expect(
            getAvailableMenuGroups(true)
                .flatMap((group) => group.items.map((item) => item.id)),
        ).not.toContain("routine");
    });

    it("uses Email Request capabilities independently from the system role", () => {
        process.env.NEXT_PUBLIC_FEATURE_ROUTINE = "true";

        const adminMenuIds = getAvailableMenuGroups(
            true,
            routineCapabilities,
            undefined,
            undefined,
            undefined,
            undefined,
            emailReadCapabilities,
        )
            .flatMap((group) => group.items.map((item) => item.id));
        const userMenuIds = getAvailableMenuGroups(
            false,
            routineCapabilities,
            undefined,
            undefined,
            undefined,
            undefined,
            emailCreateCapabilities,
        )
            .flatMap((group) => group.items.map((item) => item.id));

        expect(adminMenuIds).toContain("routine");
        expect(userMenuIds).toContain("routine");
        expect(adminMenuIds).toContain("email-request");
        expect(userMenuIds).toContain("email-request");
    });

    it("uses the Audit and Email Request projections independently", () => {
        const grantedUserMenuIds = getAvailableMenuGroups(
            false,
            undefined,
            undefined,
            undefined,
            undefined,
            auditCapabilities,
            emailReadCapabilities,
        ).flatMap((group) => group.items.map((item) => item.id));
        const deniedUserMenuIds = getAvailableMenuGroups(false)
            .flatMap((group) => group.items.map((item) => item.id));
        const adminMenuIds = getAvailableMenuGroups(
            true,
            undefined,
            undefined,
            undefined,
            undefined,
            auditCapabilities,
            emailCreateCapabilities,
        ).flatMap((group) => group.items.map((item) => item.id));

        expect(grantedUserMenuIds).toContain("audit-logs");
        expect(deniedUserMenuIds).not.toContain("audit-logs");
        expect(adminMenuIds).toContain("audit-logs");
        expect(DASHBOARD_MENU_ITEMS.find((item) => item.id === "audit-logs")?.requiredRole)
            .toBeUndefined();
        expect(DASHBOARD_MENU_ITEMS.find((item) => item.id === "email-request")?.requiredRole)
            .toBeUndefined();
    });

    it("shows Stock only when a Stock presentation surface is usable", () => {
        expect(
            getAvailableMenuGroups(false, undefined, stockCapabilities)
                .flatMap((group) => group.items.map((item) => item.id)),
        ).toContain("stock");
        expect(
            getAvailableMenuGroups(true)
                .flatMap((group) => group.items.map((item) => item.id)),
        ).not.toContain("stock");
    });

    it("lets an explicit non-admin report capability expose Stock", () => {
        expect(
            getAvailableMenuGroups(false, undefined, {
                ...stockCapabilities,
                canReadCatalog: false,
                canReadOwnRequests: false,
                canExportReports: true,
            })
                .flatMap((group) => group.items.map((item) => item.id)),
        ).toContain("stock");
    });

    it("shows Leave for a normal workforce user with own-read capability", () => {
        expect(getMenuIds(false, {
            leaveCapabilities: ownLeaveCapabilities,
        })).toContain("leave-management");
    });

    it("hides Leave when the actor has no usable Leave surface", () => {
        expect(getMenuIds(false, {
            leaveCapabilities: noLeaveCapabilities,
        })).not.toContain("leave-management");
    });

    it("does not treat assigned-read alone as an approval surface", () => {
        expect(getMenuIds(false, {
            leaveCapabilities: {
                ...noLeaveCapabilities,
                canReadAssignedApprovals: true,
            },
            canApproveLeave: false,
        })).not.toContain("leave-management");

        expect(getMenuIds(false, {
            leaveCapabilities: {
                ...noLeaveCapabilities,
                canReadAssignedApprovals: true,
            },
            canApproveLeave: true,
        })).toContain("leave-management");
    });

    it("keeps reports, recovery, and approver management independently projected", () => {
        expect(getMenuIds(false, { canViewLeaveReports: true })).toContain("leave-management");
        expect(getMenuIds(true, {
            leaveCapabilities: noLeaveCapabilities,
        })).not.toContain("leave-management");
        expect(getMenuIds(false, {
            leaveCapabilities: {
                ...noLeaveCapabilities,
                canManageApprovers: true,
            },
        })).toContain("leave-management");

        const userManagementVisibility = getLeaveDashboardTabVisibility({
            leaveCapabilities: {
                ...noLeaveCapabilities,
                canManageApprovers: true,
            },
        });
        expect(userManagementVisibility["approver-settings"]).toBe(true);
        expect(userManagementVisibility.recovery).toBe(false);

        const recoveryVisibility = getLeaveDashboardTabVisibility({
            leaveCapabilities: {
                ...noLeaveCapabilities,
                canManageRecovery: true,
            },
        });
        expect(recoveryVisibility.recovery).toBe(true);
        expect(getLeaveDashboardTabVisibility({
            leaveCapabilities: noLeaveCapabilities,
        }).recovery).toBe(false);
    });

    it("keeps Leave unavailable when its feature flag is disabled", () => {
        process.env.NEXT_PUBLIC_FEATURE_LEAVE = "false";

        expect(isDashboardTabEnabled("leave-management")).toBe(false);
        expect(getMenuIds(true, {
            leaveCapabilities: ownLeaveCapabilities,
        })).not.toContain("leave-management");
    });

    it("normalizes inaccessible Leave deep links to the first visible surface", () => {
        const ownAvailability = {
            leaveCapabilities: ownLeaveCapabilities,
        } as const;
        expect(canAccessLeaveDashboard(ownAvailability)).toBe(true);
        expect(normalizeLeaveDashboardTab("approvals", ownAvailability)).toBe("my-leave");

        const settingsAvailability = {
            leaveCapabilities: {
                ...noLeaveCapabilities,
                canManageApprovers: true,
            },
        } as const;
        expect(normalizeLeaveDashboardTab("recovery", settingsAvailability))
            .toBe("approver-settings");
    });
});
