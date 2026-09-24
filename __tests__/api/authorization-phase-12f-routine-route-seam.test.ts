import { NextRequest } from "next/server";
import type * as NextServerModule from "next/server";
import type * as AuthorizationModule from "@/modules/authorization";
import type * as StockModule from "@/modules/stock";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
    const authState = {
        invalidCapability: null as string | null,
    };

    const authorizationRepository = {
        load: vi.fn(async ({
            userId,
            capabilityKey,
        }: {
            userId: number;
            capabilityKey: string;
        }) => ({
            userGrants: authState.invalidCapability === capabilityKey
                ? [{
                    userId,
                    capabilityKey,
                    scope: "INVALID_PERSISTED_SCOPE",
                }]
                : [],
            memberships: [],
            teamRoleGrants: [],
        })),
        loadMany: vi.fn(async () => ({
            userGrants: [],
            memberships: [],
            teamRoleGrants: [],
        })),
    };

    return {
        authState,
        authorizationRepository,
        authorizationResolve: vi.fn(),
        authorizationResolveInTransaction: vi.fn(),
        requireApiSession: vi.fn(),
        requireActiveWorkforceSession: vi.fn(),
        requireLiffWorkforceSession: vi.fn(),
        stockServices: {
            getCategories: vi.fn(),
            getItems: vi.fn(),
            createCategory: vi.fn(),
            deleteCategory: vi.fn(),
            createItem: vi.fn(),
            updateItem: vi.fn(),
            deleteItem: vi.fn(),
            adjustStock: vi.fn(),
            getRequests: vi.fn(),
            cancelRequest: vi.fn(),
            issueRequest: vi.fn(),
            getRequestById: vi.fn(),
            getVariantAvailability: vi.fn(),
        },
        prisma: {
            $transaction: vi.fn(),
            user: {
                findFirst: vi.fn(),
            },
            userCapabilityGrant: {
                findMany: vi.fn(async ({
                    where,
                }: {
                    where: { capabilityKey: string };
                }) => mocks.authState.invalidCapability === where.capabilityKey
                    ? [{
                        userId: 7,
                        capabilityKey: where.capabilityKey,
                        scope: "INVALID_PERSISTED_SCOPE",
                    }]
                    : []),
            },
            teamMembership: {
                findMany: vi.fn().mockResolvedValue([]),
            },
            teamRoleCapabilityGrant: {
                findMany: vi.fn().mockResolvedValue([]),
            },
            routineTask: {
                count: vi.fn(),
                findMany: vi.fn(),
            },
            routineOccurrence: {
                findMany: vi.fn(),
            },
            routineUnit: {
                findMany: vi.fn(),
            },
            routineCategory: {
                findMany: vi.fn(),
            },
            employee: {
                findMany: vi.fn(),
            },
        },
        runSerializableTransaction: vi.fn(),
        transaction: {
            $queryRaw: vi.fn().mockResolvedValue([]),
            user: {
                findFirst: vi.fn(),
                findUnique: vi.fn(),
            },
            employee: {
                findUnique: vi.fn(),
                findMany: vi.fn(),
            },
            userCapabilityGrant: {
                findMany: vi.fn(),
            },
            teamMembership: {
                findMany: vi.fn().mockResolvedValue([]),
            },
            teamRoleCapabilityGrant: {
                findMany: vi.fn().mockResolvedValue([]),
            },
        },
        enforceAuthenticatedMutationRateLimit: vi.fn(() => null),
        processOutbox: vi.fn(),
        logDataExport: vi.fn(),
    };
});

vi.mock("next/server", async (importOriginal) => {
    const actual = await importOriginal<typeof NextServerModule>();
    return {
        ...actual,
        after: vi.fn((callback: () => void | Promise<void>) => {
            void callback();
        }),
    };
});

vi.mock("@/modules/authorization", async (importOriginal) => {
    const actual = await importOriginal<typeof AuthorizationModule>();
    const resolver = actual.createAuthorizationResolver({
        registry: actual.CAPABILITY_REGISTRY,
        repository: mocks.authorizationRepository,
    });
    mocks.authorizationResolve.mockImplementation(resolver.resolve);
    mocks.authorizationResolveInTransaction.mockImplementation(
        resolver.resolveInTransaction,
    );
    return {
        ...actual,
        authorization: {
            ...resolver,
            resolve: mocks.authorizationResolve,
            resolveInTransaction: mocks.authorizationResolveInTransaction,
        },
    };
});

vi.mock("@/modules/stock", async (importOriginal) => {
    const actual = await importOriginal<typeof StockModule>();
    return {
        ...actual,
        stockService: {
            ...actual.stockService,
            ...mocks.stockServices,
        },
    };
});

vi.mock("@/lib/auth/workforce", () => ({
    requireActiveWorkforceSession: mocks.requireActiveWorkforceSession,
}));

vi.mock("@/lib/auth/api", () => ({
    requireApiSession: mocks.requireApiSession,
}));

vi.mock("@/modules/line", () => ({
    requireLiffWorkforceSession: mocks.requireLiffWorkforceSession,
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: mocks.prisma }));

vi.mock("@/lib/db/transaction", () => ({
    runSerializableTransaction: mocks.runSerializableTransaction,
    hasPrismaErrorCode: vi.fn(() => false),
}));

vi.mock("@/lib/security/mutation-rate-limit", () => ({
    enforceAuthenticatedMutationRateLimit:
        mocks.enforceAuthenticatedMutationRateLimit,
    enforcePreAuthIpRateLimit: vi.fn(() => null),
}));

vi.mock("@/lib/services/outbox/processor", () => ({
    processOutbox: mocks.processOutbox,
}));

vi.mock("@/lib/server/audit", () => ({
    logDataExport: mocks.logDataExport,
}));

import { GET as getRoutineExport } from "@/app/api/routines/export/route";
import { GET as getRoutineSummary } from "@/app/api/routines/summary/route";
import { GET as getRoutineReference } from "@/app/api/routines/reference/route";
import { GET as getLiffRoutineSummary } from "@/app/api/line/routine/summary/route";
import { GET as getLiffRoutineReference } from "@/app/api/line/routine/reference/route";
import { GET as getLiffRoutineTasks } from "@/app/api/line/routine/tasks/route";
import { POST as createLiffRoutineTask } from "@/app/api/line/routine/tasks/route";
import { GET as getLiffRoutineTask } from "@/app/api/line/routine/tasks/[id]/route";
import { PATCH as updateLiffRoutineTask } from "@/app/api/line/routine/tasks/[id]/route";
import { DELETE as deleteLiffRoutineTask } from "@/app/api/line/routine/tasks/[id]/route";
import { GET as getEmployees } from "@/app/api/employees/route";
import { POST as createEmployee } from "@/app/api/employees/route";
import { GET as getEmployeeStats } from "@/app/api/employees/stats/route";
import { GET as getEmployeeExport } from "@/app/api/employees/export/route";
import { POST as importEmployees } from "@/app/api/employees/import/route";
import { PATCH as updateEmployee } from "@/app/api/employees/[id]/route";
import { DELETE as deleteEmployee } from "@/app/api/employees/[id]/route";
import { GET as getDepartments } from "@/app/api/departments/route";
import { GET as getNotifications } from "@/app/api/notifications/route";
import { GET as getNotificationHistory } from "@/app/api/notifications/all/route";
import { PATCH as markNotificationRead } from "@/app/api/notifications/[id]/read/route";
import { POST as markAllNotificationsRead } from "@/app/api/notifications/mark-all-read/route";
import { GET as getAuditLogs } from "@/app/api/audit-logs/route";
import { GET as getRoutineTasks } from "@/app/api/routines/tasks/route";
import { POST as createRoutineTask } from "@/app/api/routines/tasks/route";
import { GET as getRoutineTask } from "@/app/api/routines/tasks/[id]/route";
import { PATCH as updateRoutineTask } from "@/app/api/routines/tasks/[id]/route";
import { DELETE as deleteRoutineTask } from "@/app/api/routines/tasks/[id]/route";
import { GET as getRoutineOccurrences } from "@/app/api/routines/occurrences/route";
import { GET as getRoutineOccurrence } from "@/app/api/routines/occurrences/[id]/route";
import { PATCH as overrideRoutineOccurrence } from "@/app/api/routines/occurrences/[id]/route";
import { PATCH as reassignRoutineOccurrence } from "@/app/api/routines/occurrences/[id]/assignees/route";
import { PATCH as changeRoutineOccurrenceDueDate } from "@/app/api/routines/occurrences/[id]/due-date/route";
import { GET as getStockCategories } from "@/app/api/stock/categories/route";
import { POST as createStockCategory } from "@/app/api/stock/categories/route";
import { DELETE as deleteStockCategory } from "@/app/api/stock/categories/route";
import { GET as getStockItems } from "@/app/api/stock/items/route";
import { POST as createStockItem } from "@/app/api/stock/items/route";
import { PATCH as updateStockItem } from "@/app/api/stock/items/[id]/route";
import { DELETE as deleteStockItem } from "@/app/api/stock/items/[id]/route";
import { POST as adjustStockItem } from "@/app/api/stock/items/[id]/adjust/route";
import { GET as exportStockReport } from "@/app/api/stock/reports/export/route";
import { POST as uploadStockImage } from "@/app/api/uploads/image/route";
import { GET as getStockRequests } from "@/app/api/stock/requests/route";
import { POST as createStockRequest } from "@/app/api/stock/requests/route";
import { POST as cancelStockRequest } from "@/app/api/stock/requests/[id]/cancel/route";
import { POST as issueStockRequest } from "@/app/api/stock/requests/[id]/issue/route";
import { POST as reviewStockRequest } from "@/app/api/stock/requests/[id]/review/route";
import { GET as getLiffStockCategories } from "@/app/api/line/stock/categories/route";
import { GET as getLiffStockItems } from "@/app/api/line/stock/items/route";
import { GET as getLiffStockAvailability } from "@/app/api/line/stock/availability/route";
import { GET as getLiffStockRequests } from "@/app/api/line/stock/requests/route";
import { POST as createLiffStockRequest } from "@/app/api/line/stock/requests/route";
import { GET as getLiffStockRequest } from "@/app/api/line/stock/requests/[id]/route";
import { POST as cancelLiffStockRequest } from "@/app/api/line/stock/requests/[id]/cancel/route";
import { GET as getLiffStockProcessing } from "@/app/api/line/stock/processing/route";
import { POST as issueLiffStockRequest } from "@/app/api/line/stock/requests/[id]/issue/route";
import { GET as getLeaveMe } from "@/app/api/leave/me/route";
import { POST as createLeaveRequest } from "@/app/api/leave/request/route";
import { POST as cancelLeaveRequest } from "@/app/api/leave/cancel/route";
import { PUT as decideLeaveCancellation } from "@/app/api/leave/cancel/route";
import { GET as getLeaveApprovals } from "@/app/api/leave/approvals/route";
import { POST as decideLeaveRequest } from "@/app/api/leave/decision/route";
import { POST as requestLeaveNotTaken } from "@/app/api/leave/not-taken/route";
import { PUT as confirmLeaveNotTaken } from "@/app/api/leave/not-taken/route";
import { GET as getLeaveApprovers } from "@/app/api/leave/approvers/route";
import { PUT as updateLeaveApprovers } from "@/app/api/leave/approvers/route";
import { GET as getLiffLeaveMe } from "@/app/api/line/leave/me/route";
import { GET as getLiffLeaveApprovals } from "@/app/api/line/leave/approvals/route";
import { POST as createLiffLeaveRequest } from "@/app/api/line/leave/request/route";
import { POST as cancelLiffLeaveRequest } from "@/app/api/line/leave/cancel/route";
import { POST as decideLiffLeaveRequest } from "@/app/api/line/leave/decision/route";
import { POST as requestLiffLeaveNotTaken } from "@/app/api/line/leave/not-taken/route";
import { PUT as confirmLiffLeaveNotTaken } from "@/app/api/line/leave/not-taken/route";

const USER = {
    id: 7,
    employeeId: 21,
    role: "USER",
    email: "user@example.com",
    name: "ผู้ใช้ทดสอบ",
} as const;

const DASHBOARD_AUTH = {
    ok: true as const,
    user: USER,
    employeeId: 21,
};

const LIFF_AUTH = {
    ok: true as const,
    user: USER,
    employeeId: 21,
};

const VALID_EMPLOYEE_CREATE = {
    firstName: "สมชาย",
    lastName: "ใจดี",
    email: "somchai@example.com",
    position: "เจ้าหน้าที่",
    departmentId: 1,
};

const VALID_EMPLOYEE_UPDATE = { firstName: "สมชาย" };

const VALID_ROUTINE_JSON = {
    unitId: 1,
    categoryId: 1,
    title: "ตรวจสอบระบบ",
    scheduleType: "MONTHLY_DAY",
    scheduleConfig: { day: 10, monthOffset: 0 },
    assignees: [{ employeeId: 21, role: "OWNER" }],
    reminderRules: [],
};

const VALID_LIFF_ROUTINE_CREATE = {
    unitId: 1,
    categoryId: 1,
    title: "ตรวจสอบระบบ",
    description: "รายละเอียด",
    scheduleType: "MONTHLY_DAY",
    scheduleConfig: { day: 10, monthOffset: 0 },
    scheduleText: "ทุกเดือน",
    businessDayPolicy: "NONE",
    isActive: true,
    reminderRules: [],
};

const VALID_LIFF_ROUTINE_UPDATE = {
    version: 1,
    title: "ตรวจสอบระบบ",
};

const VALID_ROUTINE_UPDATE = { version: 1 };

const VALID_ROUTINE_OCCURRENCE = {
    expectedReminderVersion: 1,
    dueDate: "2099-01-01",
    assignees: [{ employeeId: 21, role: "OWNER" }],
};

const VALID_STOCK_CATEGORY = { name: "หมวดทดสอบ" };

const VALID_STOCK_ITEM = {
    name: "วัสดุทดสอบ",
    categoryId: 1,
    variants: [{ unit: "ชิ้น", quantity: 1, minStock: 1 }],
};

const VALID_STOCK_REQUEST = {
    projectCode: "TEST-12F",
    items: [{ itemId: 1, quantity: 1 }],
};

const VALID_LEAVE_REQUEST = {
    leaveType: "PERSONAL",
    startDate: "2099-01-01",
    endDate: "2099-01-01",
    period: "FULL_DAY",
    reason: "เหตุผลการทดสอบ authorization",
};

const VALID_LEAVE_CANCEL = {
    leaveId: "leave-12f",
    reason: "เหตุผลการยกเลิก",
};

const VALID_LEAVE_DECISION = {
    leaveId: "leave-12f",
    action: "APPROVE",
};

const VALID_LEAVE_CANCELLATION_DECISION = {
    leaveId: "leave-12f",
    action: "CONFIRM",
};

const VALID_LEAVE_NOT_TAKEN_REQUEST = {
    leaveId: "leave-12f",
    note: "เหตุผลการไม่ใช้สิทธิ์",
};

const VALID_LEAVE_NOT_TAKEN_CONFIRMATION = {
    leaveId: "leave-12f",
    reason: "เหตุผลการยืนยัน",
};

function request(
    path: string,
    init?: ConstructorParameters<typeof NextRequest>[1],
): NextRequest {
    return new NextRequest(`http://localhost${path}`, init);
}

async function expectDirectConfigurationBoundary(
    capability: string,
    channel: "DASHBOARD" | "LIFF_SELF_SERVICE",
    employeeId: number | null,
    invoke: () => Promise<Response>,
): Promise<void> {
    mocks.authState.invalidCapability = capability;
    const response = await invoke();

    expect(response.status).toBeGreaterThanOrEqual(400);
    const customRepositoryCalled = mocks.authorizationRepository.load.mock.calls
        .some(([input]) => input.capabilityKey === capability);
    const defaultRepositoryCalled = mocks.prisma.userCapabilityGrant.findMany
        .mock.calls
        .some(([input]) => input.where.capabilityKey === capability);
    const transactionRepositoryCalled = mocks.transaction.userCapabilityGrant
        .findMany
        .mock.calls
        .some(([input]) => input.where.capabilityKey === capability);
    const actorCalls = [
        ...mocks.authorizationResolve.mock.calls,
        ...mocks.authorizationResolveInTransaction.mock.calls,
    ].filter(([, calledCapability]) => calledCapability === capability);
    if (actorCalls.length > 0) {
        expect(actorCalls.some(([actor]) =>
            actor.userId === USER.id
            && actor.employeeId === employeeId
            && actor.systemRole === USER.role
            && actor.channel === channel,
        )).toBe(true);
    }
    if (!customRepositoryCalled && !defaultRepositoryCalled && !transactionRepositoryCalled) {
        throw new Error(JSON.stringify({
            capability,
            repository: mocks.authorizationRepository.load.mock.calls,
            defaultRepository: mocks.prisma.userCapabilityGrant.findMany.mock.calls,
            transactionRepository: mocks.transaction.userCapabilityGrant.findMany.mock.calls,
        }));
    }
}

describe("Phase 12F direct migrated route seams", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.authState.invalidCapability = null;
        process.env.NEXT_PUBLIC_FEATURE_ROUTINE = "true";
        process.env.NEXT_PUBLIC_FEATURE_LEAVE = "true";
        mocks.requireActiveWorkforceSession.mockResolvedValue(DASHBOARD_AUTH);
        mocks.requireApiSession.mockResolvedValue({
            ok: true as const,
            user: USER,
            session: { user: USER },
        });
        mocks.requireLiffWorkforceSession.mockResolvedValue(LIFF_AUTH);
        mocks.transaction.user.findUnique.mockResolvedValue({
            id: USER.id,
            employeeId: USER.employeeId,
            role: USER.role,
            isActive: true,
            deletedAt: null,
            employee: {
                id: 21,
                status: "ACTIVE",
                deletedAt: null,
            },
        });
        mocks.transaction.user.findFirst.mockResolvedValue({
            id: USER.id,
            role: USER.role,
            isActive: true,
            deletedAt: null,
            employee: {
                id: 21,
                status: "ACTIVE",
                deletedAt: null,
            },
        });
        mocks.transaction.employee.findUnique.mockResolvedValue({
            id: 21,
            status: "ACTIVE",
            deletedAt: null,
        });
        mocks.transaction.userCapabilityGrant.findMany.mockImplementation(
            async ({ where }: { where: { capabilityKey: string } }) =>
                mocks.authState.invalidCapability === where.capabilityKey
                    ? [{
                        userId: USER.id,
                        capabilityKey: where.capabilityKey,
                        scope: "INVALID_PERSISTED_SCOPE",
                    }]
                : [],
        );
        mocks.runSerializableTransaction.mockImplementation(
            async (callback: (tx: typeof mocks.transaction) => Promise<unknown>) =>
                callback(mocks.transaction),
        );
        mocks.prisma.$transaction.mockImplementation(
            async (callback: (tx: typeof mocks.transaction) => Promise<unknown>) =>
                callback(mocks.transaction),
        );
    });

    it("proves Dashboard export reaches the real Routine resolver", async () => {
        await expectDirectConfigurationBoundary(
            "routine.task.export",
            "DASHBOARD",
            21,
            () => getRoutineExport(request("/api/routines/export?format=xlsx")),
        );
    });

    it("denies a no-grant Dashboard USER export before querying task data", async () => {
        const response = await getRoutineExport(
            request("/api/routines/export?format=xlsx"),
        );

        expect(response.status).toBe(403);
        expect(mocks.authorizationResolve).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: USER.id,
                employeeId: 21,
                systemRole: "USER",
                channel: "DASHBOARD",
            }),
            "routine.task.export",
        );
        expect(mocks.prisma.routineTask.count).not.toHaveBeenCalled();
        expect(mocks.prisma.routineTask.findMany).not.toHaveBeenCalled();
        expect(mocks.logDataExport).not.toHaveBeenCalled();
    });

    it("proves Dashboard summary reaches the real Routine resolver", async () => {
        await expectDirectConfigurationBoundary(
            "routine.summary.read",
            "DASHBOARD",
            21,
            () => getRoutineSummary(request("/api/routines/summary?scope=mine")),
        );
    });

    it("proves LIFF summary reaches the real Routine resolver", async () => {
        await expectDirectConfigurationBoundary(
            "routine.summary.read",
            "LIFF_SELF_SERVICE",
            21,
            () => getLiffRoutineSummary(request("/api/line/routine/summary")),
        );
    });

    it("proves Dashboard reference reaches the real Routine resolver", async () => {
        await expectDirectConfigurationBoundary(
            "routine.reference.read",
            "DASHBOARD",
            21,
            () => getRoutineReference(request("/api/routines/reference")),
        );
    });

    it("proves LIFF reference reaches the real Routine resolver", async () => {
        await expectDirectConfigurationBoundary(
            "routine.reference.read",
            "LIFF_SELF_SERVICE",
            21,
            () => getLiffRoutineReference(request("/api/line/routine/reference")),
        );
    });

    it.each([
        ["employee.read", () => getEmployees(request("/api/employees"))],
        ["employee.stats.read", () => getEmployeeStats()],
        ["employee.export", () => getEmployeeExport(request("/api/employees/export"))],
        ["department.read", () => getDepartments()],
        ["notification.inbox.read", () => getNotifications(request("/api/notifications"))],
        ["notification.inbox.read", () => getNotificationHistory(request("/api/notifications/all"))],
        ["notification.inbox.update", () => markNotificationRead(
            request("/api/notifications/1/read", { method: "PATCH" }),
            { params: Promise.resolve({ id: "1" }) },
        )],
        ["notification.inbox.update", () => markAllNotificationsRead(
            request("/api/notifications/mark-all-read", { method: "POST" }),
        )],
        ["audit.read", () => getAuditLogs(request("/api/audit-logs"))],
    ] as const)("proves %s reaches its real Dashboard resolver seam", async (capability, invoke) => {
        await expectDirectConfigurationBoundary(capability, "DASHBOARD", null, invoke);
    });

    it.each([
        ["employee.create", () => createEmployee(request("/api/employees", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(VALID_EMPLOYEE_CREATE),
        }))],
        ["employee.import", () => importEmployees(request("/api/employees/import", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ employees: [] }),
        }))],
        ["employee.update", () => updateEmployee(
            request("/api/employees/21", {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(VALID_EMPLOYEE_UPDATE),
            }),
            { params: Promise.resolve({ id: "21" }) },
        )],
        ["employee.delete", () => deleteEmployee(
            request("/api/employees/21", { method: "DELETE" }),
            { params: Promise.resolve({ id: "21" }) },
        )],
    ] as const)("proves %s reaches its real Employee resolver seam", async (capability, invoke) => {
        await expectDirectConfigurationBoundary(capability, "DASHBOARD", null, invoke);
    });

    it.each([
        ["routine.task.read", () => getRoutineTasks(request("/api/routines/tasks"))],
        ["routine.task.create", () => createRoutineTask(request("/api/routines/tasks", {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "Idempotency-Key": "routine-create-12f",
            },
            body: JSON.stringify(VALID_ROUTINE_JSON),
        }))],
        ["routine.task.read", () => getRoutineTask(
            request("/api/routines/tasks/71"),
            { params: Promise.resolve({ id: "71" }) },
        )],
        ["routine.task.update", () => updateRoutineTask(
            request("/api/routines/tasks/71", {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(VALID_ROUTINE_UPDATE),
            }),
            { params: Promise.resolve({ id: "71" }) },
        )],
        ["routine.task.delete", () => deleteRoutineTask(
            request("/api/routines/tasks/71", { method: "DELETE" }),
            { params: Promise.resolve({ id: "71" }) },
        )],
        ["routine.occurrence.read", () => getRoutineOccurrences(
            request("/api/routines/occurrences"),
        )],
        ["routine.task.read", () => getRoutineOccurrences(
            request("/api/routines/occurrences?view=tasks"),
        )],
        ["routine.occurrence.read", () => getRoutineOccurrence(
            request("/api/routines/occurrences/91"),
            { params: Promise.resolve({ id: "91" }) },
        )],
        ["routine.occurrence.override", () => overrideRoutineOccurrence(
            request("/api/routines/occurrences/91", {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(VALID_ROUTINE_OCCURRENCE),
            }),
            { params: Promise.resolve({ id: "91" }) },
        )],
        ["routine.occurrence.reassign", () => reassignRoutineOccurrence(
            request("/api/routines/occurrences/91/assignees", {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(VALID_ROUTINE_OCCURRENCE),
            }),
            { params: Promise.resolve({ id: "91" }) },
        )],
        ["routine.occurrence.change_due_date", () => changeRoutineOccurrenceDueDate(
            request("/api/routines/occurrences/91/due-date", {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    expectedReminderVersion: 1,
                    dueDate: "2099-01-01",
                }),
            }),
            { params: Promise.resolve({ id: "91" }) },
        )],
    ] as const)("proves %s reaches its real Dashboard Routine resolver seam", async (capability, invoke) => {
        await expectDirectConfigurationBoundary(capability, "DASHBOARD", 21, invoke);
    });

    it.each([
        ["routine.task.read", () => getLiffRoutineTasks(request("/api/line/routine/tasks"))],
        ["routine.task.create", () => createLiffRoutineTask(request("/api/line/routine/tasks", {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "Idempotency-Key": "liff-routine-create-12f",
            },
            body: JSON.stringify(VALID_LIFF_ROUTINE_CREATE),
        }))],
        ["routine.task.read", () => getLiffRoutineTask(
            request("/api/line/routine/tasks/71"),
            { params: Promise.resolve({ id: "71" }) },
        )],
        ["routine.task.update", () => updateLiffRoutineTask(
            request("/api/line/routine/tasks/71", {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(VALID_LIFF_ROUTINE_UPDATE),
            }),
            { params: Promise.resolve({ id: "71" }) },
        )],
        ["routine.task.delete", () => deleteLiffRoutineTask(
            request("/api/line/routine/tasks/71", { method: "DELETE" }),
            { params: Promise.resolve({ id: "71" }) },
        )],
    ] as const)("proves %s reaches its real LIFF Routine resolver seam", async (capability, invoke) => {
        await expectDirectConfigurationBoundary(capability, "LIFF_SELF_SERVICE", 21, invoke);
    });

    it.each([
        ["stock.catalog.read", () => getStockCategories()],
        ["stock.inventory.manage", () => createStockCategory(request("/api/stock/categories", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(VALID_STOCK_CATEGORY),
        }))],
        ["stock.inventory.manage", () => deleteStockCategory(
            request("/api/stock/categories?id=1", { method: "DELETE" }),
        )],
        ["stock.catalog.read", () => getStockItems(request("/api/stock/items"))],
        ["stock.inventory.manage", () => createStockItem(request("/api/stock/items", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(VALID_STOCK_ITEM),
        }))],
        ["stock.inventory.manage", () => updateStockItem(
            request("/api/stock/items/1", {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ name: "วัสดุทดสอบ" }),
            }),
            { params: Promise.resolve({ id: "1" }) },
        )],
        ["stock.inventory.manage", () => deleteStockItem(
            request("/api/stock/items/1", { method: "DELETE" }),
            { params: Promise.resolve({ id: "1" }) },
        )],
        ["stock.inventory.manage", () => adjustStockItem(
            request("/api/stock/items/1/adjust", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    type: "IN",
                    quantity: 1,
                    minStock: 1,
                }),
            }),
            { params: Promise.resolve({ id: "1" }) },
        )],
        ["stock.request.read", () => getStockRequests(request("/api/stock/requests"))],
        ["stock.request.create", () => createStockRequest(request("/api/stock/requests", {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "Idempotency-Key": "stock-request-12f",
            },
            body: JSON.stringify(VALID_STOCK_REQUEST),
        }))],
        ["stock.request.process", () => reviewStockRequest(
            request("/api/stock/requests/1/review", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ action: "issue" }),
            }),
            { params: Promise.resolve({ id: "1" }) },
        )],
        ["stock.request.cancel", () => reviewStockRequest(
            request("/api/stock/requests/1/review", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ action: "reject" }),
            }),
            { params: Promise.resolve({ id: "1" }) },
        )],
        ["stock.request.process", () => issueStockRequest(
            request("/api/stock/requests/1/issue", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({}),
            }),
            { params: Promise.resolve({ id: "1" }) },
        )],
        ["stock.request.cancel", () => cancelStockRequest(
            request("/api/stock/requests/1/cancel", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ cancelReason: "เหตุผล" }),
            }),
            { params: Promise.resolve({ id: "1" }) },
        )],
        ["stock.report.export", () => exportStockReport(
            request("/api/stock/reports/export?format=xlsx"),
        )],
        ["stock.inventory.manage", () => uploadStockImage(
            request("/api/uploads/image", { method: "POST" }),
        )],
    ] as const)("proves %s reaches its real Dashboard Stock resolver seam", async (capability, invoke) => {
        await expectDirectConfigurationBoundary(capability, "DASHBOARD", 21, invoke);
    });

    it.each([
        ["stock.catalog.read", () => getLiffStockCategories()],
        ["stock.catalog.read", () => getLiffStockItems(
            request("/api/line/stock/items"),
        )],
        ["stock.catalog.read", () => getLiffStockAvailability(
            request("/api/line/stock/availability?variantIds=1"),
        )],
        ["stock.request.read", () => getLiffStockRequests(
            request("/api/line/stock/requests"),
        )],
        ["stock.request.create", () => createLiffStockRequest(
            request("/api/line/stock/requests", {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "Idempotency-Key": "liff-stock-request-12f",
                },
                body: JSON.stringify(VALID_STOCK_REQUEST),
            }),
        )],
        ["stock.request.read", () => getLiffStockRequest(
            request("/api/line/stock/requests/1"),
            { params: Promise.resolve({ id: "1" }) },
        )],
        ["stock.request.cancel", () => cancelLiffStockRequest(
            request("/api/line/stock/requests/1/cancel", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ cancelReason: "เหตุผล" }),
            }),
            { params: Promise.resolve({ id: "1" }) },
        )],
        ["stock.request.process", () => getLiffStockProcessing(
            request("/api/line/stock/processing"),
        )],
        ["stock.request.process", () => issueLiffStockRequest(
            request("/api/line/stock/requests/1/issue", { method: "POST" }),
            { params: Promise.resolve({ id: "1" }) },
        )],
    ] as const)("proves %s reaches its real LIFF Stock resolver seam", async (capability, invoke) => {
        await expectDirectConfigurationBoundary(capability, "LIFF_SELF_SERVICE", 21, invoke);
    });

    it.each([
        ["leave.request.read", () => getLeaveMe(
            request("/api/leave/me"),
        )],
        ["leave.request.create", () => createLeaveRequest(
            request("/api/leave/request", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(VALID_LEAVE_REQUEST),
            }),
        )],
        ["leave.request.cancel", () => cancelLeaveRequest(
            request("/api/leave/cancel", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(VALID_LEAVE_CANCEL),
            }),
        )],
        ["leave.cancellation.decide", () => decideLeaveCancellation(
            request("/api/leave/cancel", {
                method: "PUT",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(VALID_LEAVE_CANCELLATION_DECISION),
            }),
        )],
        ["leave.approval.read", () => getLeaveApprovals(
            request("/api/leave/approvals"),
        )],
        ["leave.request.approve", () => decideLeaveRequest(
            request("/api/leave/decision", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(VALID_LEAVE_DECISION),
            }),
        )],
        ["leave.request.not_taken", () => requestLeaveNotTaken(
            request("/api/leave/not-taken", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(VALID_LEAVE_NOT_TAKEN_REQUEST),
            }),
        )],
        ["leave.request.not_taken", () => confirmLeaveNotTaken(
            request("/api/leave/not-taken", {
                method: "PUT",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(VALID_LEAVE_NOT_TAKEN_CONFIRMATION),
            }),
        )],
        ["leave.approver.manage", () => getLeaveApprovers()],
        ["leave.approver.manage", () => updateLeaveApprovers(
            request("/api/leave/approvers", {
                method: "PUT",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    assignments: [{ employeeId: 21, managerId: 20 }],
                }),
            }),
        )],
    ] as const)("proves %s reaches its real Dashboard Leave resolver seam", async (capability, invoke) => {
        await expectDirectConfigurationBoundary(capability, "DASHBOARD", 21, invoke);
    });

    it.each([
        ["leave.request.read", () => getLiffLeaveMe(
            request("/api/line/leave/me"),
        )],
        ["leave.approval.read", () => getLiffLeaveApprovals(
            request("/api/line/leave/approvals"),
        )],
        ["leave.request.create", () => createLiffLeaveRequest(
            request("/api/line/leave/request", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(VALID_LEAVE_REQUEST),
            }),
        )],
        ["leave.request.cancel", () => cancelLiffLeaveRequest(
            request("/api/line/leave/cancel", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(VALID_LEAVE_CANCEL),
            }),
        )],
        ["leave.request.approve", () => decideLiffLeaveRequest(
            request("/api/line/leave/decision", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(VALID_LEAVE_DECISION),
            }),
        )],
        ["leave.request.not_taken", () => requestLiffLeaveNotTaken(
            request("/api/line/leave/not-taken", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(VALID_LEAVE_NOT_TAKEN_REQUEST),
            }),
        )],
        ["leave.request.not_taken", () => confirmLiffLeaveNotTaken(
            request("/api/line/leave/not-taken", {
                method: "PUT",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(VALID_LEAVE_NOT_TAKEN_CONFIRMATION),
            }),
        )],
    ] as const)("proves %s reaches its real LIFF Leave resolver seam", async (capability, invoke) => {
        await expectDirectConfigurationBoundary(capability, "LIFF_SELF_SERVICE", 21, invoke);
    });
});
