// @vitest-environment node
import { createRequire } from "node:module";
import { createElement, type ReactNode } from "react";
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
import type { DepartmentPresentationCapabilities } from "@/modules/department";
import type { AuditPresentationCapabilities } from "@/modules/audit";
import type { NotificationPresentationCapabilities } from "@/modules/notification";
import type { EmailRequestPresentationCapabilities } from "@/modules/it/client";
import type { ITPresentationCapabilities } from "@/modules/it";

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
    departmentContextMock,
    departmentProjectionMock,
    auditContextMock,
    auditProjectionMock,
    notificationContextMock,
    notificationProjectionMock,
    emailRequestContextMock,
    emailRequestCapabilitiesMock,
    itContextMock,
    itCapabilitiesMock,
    userTeamsMock,
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
    departmentContextMock: vi.fn(),
    departmentProjectionMock: vi.fn(),
    auditContextMock: vi.fn(),
    auditProjectionMock: vi.fn(),
    notificationContextMock: vi.fn(),
    notificationProjectionMock: vi.fn(),
    emailRequestContextMock: vi.fn(),
    emailRequestCapabilitiesMock: vi.fn<() => Promise<EmailRequestPresentationCapabilities>>(),
    itContextMock: vi.fn(),
    itCapabilitiesMock: vi.fn(),
    userTeamsMock: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
// Load the real server-conditioned React module used by the installed Flight renderer.
vi.mock("react", async () => {
    const { createRequire } = await import("node:module");
    return createRequire(`${process.cwd()}/package.json`)("react");
});
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
vi.mock("@/modules/department", () => ({
    buildDepartmentAuthorizationContext: departmentContextMock,
    getDepartmentPresentationCapabilities: departmentProjectionMock,
}));
vi.mock("@/modules/audit", () => ({
    buildAuditAuthorizationContext: auditContextMock,
    getAuditPresentationCapabilities: auditProjectionMock,
}));
vi.mock("@/modules/notification", () => ({
    buildNotificationAuthorizationContext: notificationContextMock,
    getNotificationPresentationCapabilities: notificationProjectionMock,
}));
vi.mock("@/modules/it", () => ({
    buildEmailRequestAuthorizationContext: emailRequestContextMock,
    getEmailRequestPresentationCapabilities: emailRequestCapabilitiesMock,
    buildITAuthorizationContext: itContextMock,
    getITPresentationCapabilities: itCapabilitiesMock,
}));
vi.mock("@/modules/authorization", () => ({
    findActiveUserTeams: userTeamsMock,
}));

import { getCurrentUserProjection } from "@/app/_lib/auth/current-user";

interface ReactFlightServer {
    renderToReadableStream(
        model: ReactNode,
        moduleMap: Record<string, unknown>,
    ): ReadableStream<Uint8Array>;
}

const reactFlightServer = createRequire(import.meta.url)(
    "next/dist/compiled/react-server-dom-webpack/server.node",
) as ReactFlightServer;

async function renderServerComponent(
    component: () => Promise<ReactNode>,
): Promise<string> {
    const stream = reactFlightServer.renderToReadableStream(
        createElement(component),
        {},
    );
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let output = "";

    while (true) {
        const result = await reader.read();
        if (result.done) break;
        output += decoder.decode(result.value, { stream: true });
    }

    return output + decoder.decode();
}

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
    canManageRecovery: false,
};

const ROUTINE = {
    canReadTasks: true,
    canReadAllTasks: true,
    canCreateTasks: true,
    canCreateTasksForOthers: true,
    canUpdateTasks: true,
    canUpdateAllTasks: true,
    canDeleteTasks: true,
    canDeleteAllTasks: true,
    canReadOccurrences: true,
    canOverrideOccurrences: true,
    canReassignOccurrences: true,
    canChangeOccurrenceDueDate: true,
    canExportTasks: true,
    canReadSummary: true,
    canReadAllSummary: true,
    canReadReference: true,
    canReadAllReferences: true,
};

const EMAIL_REQUEST_CAPABILITIES = {
    canReadRequests: true,
    canCreateRequests: true,
    canUpdateOwnRequests: true,
    canUpdateAllRequests: false,
} satisfies EmailRequestPresentationCapabilities;

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

const DEPARTMENT_CAPABILITIES: DepartmentPresentationCapabilities = {
    canReadDepartments: true,
};

const AUDIT_CAPABILITIES: AuditPresentationCapabilities = {
    canReadAuditLogs: true,
};

const NOTIFICATION_CAPABILITIES: NotificationPresentationCapabilities = {
    canReadInbox: true,
    canUpdateInbox: false,
};

const IT_CAPABILITIES: ITPresentationCapabilities = {
    canReadOwnTickets: true,
    canReadAllTickets: false,
    canCreateOwnTickets: true,
    canCommentOwnTickets: true,
    canCommentAllTickets: false,
    canManageTickets: false,
    canReadAnalytics: false,
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
        departmentContextMock.mockReturnValue({ authorizationActor: "department-actor" });
        departmentProjectionMock.mockResolvedValue(DEPARTMENT_CAPABILITIES);
        auditContextMock.mockReturnValue({ authorizationActor: "audit-actor" });
        auditProjectionMock.mockResolvedValue(AUDIT_CAPABILITIES);
        notificationContextMock.mockReturnValue({ authorizationActor: "notification-actor" });
        notificationProjectionMock.mockResolvedValue(NOTIFICATION_CAPABILITIES);
        emailRequestContextMock.mockReturnValue({ authorizationActor: "email-request-actor" });
        emailRequestCapabilitiesMock.mockResolvedValue(EMAIL_REQUEST_CAPABILITIES);
        itContextMock.mockReturnValue({ authorizationActor: "it-actor" });
        itCapabilitiesMock.mockResolvedValue(IT_CAPABILITIES);
        userTeamsMock.mockResolvedValue([{ id: 8, name: "IT" }]);
    });

    it("returns all server-derived Dashboard projections after the Employee lifecycle check", async () => {
        await expect(getCurrentUserProjection()).resolves.toEqual({
            id: "41",
            employeeId: 101,
            role: "ADMIN",
            email: "account@test.com",
            name: "สมชาย ใจดี (ชาย)",
            department: "วิชาการ",
            teams: [{ id: 8, name: "IT" }],
            isManager: false,
            canApproveLeave: true,
            canViewLeaveReports: false,
            leaveCapabilities: LEAVE_CAPABILITIES,
            routineCapabilities: ROUTINE,
            stockCapabilities: STOCK,
            employeeCapabilities: EMPLOYEE_CAPABILITIES,
            departmentCapabilities: DEPARTMENT_CAPABILITIES,
            auditCapabilities: AUDIT_CAPABILITIES,
            notificationCapabilities: NOTIFICATION_CAPABILITIES,
            emailRequestCapabilities: EMAIL_REQUEST_CAPABILITIES,
            itCapabilities: IT_CAPABILITIES,
        });
        expect(resolveAccountMock).toHaveBeenCalledWith("access-token");
        expect(employeeProjectionMock).toHaveBeenCalledWith(41);
        expect(userTeamsMock).toHaveBeenCalledWith(41);
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
        expect(departmentContextMock).toHaveBeenCalledWith(
            { id: 41, role: "ADMIN" },
            101,
        );
        expect(departmentProjectionMock).toHaveBeenCalledWith({
            authorizationActor: "department-actor",
        });
        expect(auditContextMock).toHaveBeenCalledWith(
            { id: 41, role: "ADMIN" },
            101,
        );
        expect(auditProjectionMock).toHaveBeenCalledWith({
            authorizationActor: "audit-actor",
        });
        expect(notificationContextMock).toHaveBeenCalledWith(
            { id: 41, role: "ADMIN" },
            101,
        );
        expect(notificationProjectionMock).toHaveBeenCalledWith({
            authorizationActor: "notification-actor",
        });
        expect(emailRequestContextMock).toHaveBeenCalledWith({
            id: 41,
            role: "ADMIN",
        });
        expect(emailRequestCapabilitiesMock).toHaveBeenCalledWith({
            authorizationActor: "email-request-actor",
        });
        expect(itContextMock).toHaveBeenCalledWith({ id: 41, role: "ADMIN" }, 101);
        expect(itCapabilitiesMock).toHaveBeenCalledWith({ authorizationActor: "it-actor" });
    });

    it("keeps the broad projection unauthorized without an eligible Employee", async () => {
        employeeProjectionMock.mockResolvedValue(null);

        await expect(getCurrentUserProjection()).resolves.toBeNull();
        expect(leaveProjectionMock).not.toHaveBeenCalled();
        expect(leaveCapabilitiesMock).not.toHaveBeenCalled();
        expect(employeeCapabilitiesMock).not.toHaveBeenCalled();
        expect(userTeamsMock).not.toHaveBeenCalled();
        expect(departmentProjectionMock).not.toHaveBeenCalled();
        expect(auditProjectionMock).not.toHaveBeenCalled();
        expect(notificationProjectionMock).not.toHaveBeenCalled();
        expect(itContextMock).not.toHaveBeenCalled();
        expect(itCapabilitiesMock).not.toHaveBeenCalled();
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
        expect(departmentProjectionMock).not.toHaveBeenCalled();
        expect(auditProjectionMock).not.toHaveBeenCalled();
        expect(notificationProjectionMock).not.toHaveBeenCalled();
        expect(itContextMock).not.toHaveBeenCalled();
        expect(itCapabilitiesMock).not.toHaveBeenCalled();
    });

    it("deduplicates concurrent projection calls within one RSC render request", async () => {
        async function ProjectionProbe(): Promise<ReactNode> {
            const [first, second] = await Promise.all([
                getCurrentUserProjection(),
                getCurrentUserProjection(),
            ]);

            return createElement(
                "span",
                null,
                `${first?.id}|${second?.id}|${first?.routineCapabilities?.canReadTasks}`,
            );
        }

        const output = await renderServerComponent(ProjectionProbe);

        expect(output).toContain("41|41|true");
        expect({
            accountResolution: resolveAccountMock.mock.calls.length,
            employeeProjection: employeeProjectionMock.mock.calls.length,
            teamProjection: userTeamsMock.mock.calls.length,
            routineCapabilities: routineProjectionMock.mock.calls.length,
        }).toEqual({
            accountResolution: 1,
            employeeProjection: 1,
            teamProjection: 1,
            routineCapabilities: 1,
        });
    });

    it("reuses a resolved projection later in the same RSC render request", async () => {
        async function ProjectionProbe(): Promise<ReactNode> {
            const first = await getCurrentUserProjection();
            const second = await getCurrentUserProjection();

            return createElement(
                "span",
                null,
                `${first?.id}|${second?.id}|${second?.routineCapabilities?.canReadTasks}`,
            );
        }

        const output = await renderServerComponent(ProjectionProbe);

        expect(output).toContain("41|41|true");
        expect(resolveAccountMock).toHaveBeenCalledTimes(1);
        expect(employeeProjectionMock).toHaveBeenCalledTimes(1);
        expect(userTeamsMock).toHaveBeenCalledTimes(1);
        expect(routineProjectionMock).toHaveBeenCalledTimes(1);
    });

    it("resolves fresh identity and capabilities in independent RSC render requests", async () => {
        let accessToken = "first-access-token";
        cookiesMock.mockImplementation(async () => ({
            get: () => ({ value: accessToken }),
        }));
        resolveAccountMock.mockImplementation(async (token: string | undefined) => ({
            ...ACCOUNT,
            userId: token === "second-access-token" ? 42 : 41,
        }));
        routineProjectionMock.mockImplementation(async (actor: { id: number }) => ({
            ...ROUTINE,
            canReadTasks: actor.id === 41,
        }));

        async function ProjectionProbe(): Promise<ReactNode> {
            const user = await getCurrentUserProjection();
            return createElement(
                "span",
                null,
                `${user?.id}|${user?.routineCapabilities?.canReadTasks}`,
            );
        }

        const firstRequest = await renderServerComponent(ProjectionProbe);
        accessToken = "second-access-token";
        const secondRequest = await renderServerComponent(ProjectionProbe);

        expect(firstRequest).toContain("41|true");
        expect(secondRequest).toContain("42|false");
        expect(resolveAccountMock).toHaveBeenNthCalledWith(1, "first-access-token");
        expect(resolveAccountMock).toHaveBeenNthCalledWith(2, "second-access-token");
        expect(resolveAccountMock).toHaveBeenCalledTimes(2);
    });

    it.each(["unauthenticated account", "revoked session family"])(
        "keeps %s unauthorized when the session resolver returns no account",
        async () => {
            resolveAccountMock.mockResolvedValue(null);

            async function ProjectionProbe(): Promise<ReactNode> {
                const [first, second] = await Promise.all([
                    getCurrentUserProjection(),
                    getCurrentUserProjection(),
                ]);
                return createElement("span", null, `${first === null}|${second === null}`);
            }

            const output = await renderServerComponent(ProjectionProbe);

            expect(output).toContain("true|true");
            expect(resolveAccountMock).toHaveBeenCalledTimes(1);
            expect(employeeProjectionMock).not.toHaveBeenCalled();
        },
    );

    it("does not resolve capabilities for an inactive Employee in one RSC request", async () => {
        employeeProjectionMock.mockResolvedValue(null);

        async function ProjectionProbe(): Promise<ReactNode> {
            const [first, second] = await Promise.all([
                getCurrentUserProjection(),
                getCurrentUserProjection(),
            ]);
            return createElement("span", null, `${first === null}|${second === null}`);
        }

        const output = await renderServerComponent(ProjectionProbe);

        expect(output).toContain("true|true");
        expect(resolveAccountMock).toHaveBeenCalledTimes(1);
        expect(employeeProjectionMock).toHaveBeenCalledTimes(1);
        expect(userTeamsMock).not.toHaveBeenCalled();
        expect(leaveCapabilitiesMock).not.toHaveBeenCalled();
        expect(employeeCapabilitiesMock).not.toHaveBeenCalled();
    });

    it("does not share projection results outside an RSC render request", async () => {
        await getCurrentUserProjection();
        await getCurrentUserProjection();

        expect(resolveAccountMock).toHaveBeenCalledTimes(2);
    });
});
