// @vitest-environment node
import type * as AuthorizationModule from "@/modules/authorization";
import type * as NextServerModule from "next/server";
import type * as StockModule from "@/modules/stock";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
    const authState = {
        userGrants: [] as Array<{
            userId: number;
            capabilityKey: string;
            scope: string;
        }>,
    };

    const authorizationRepository = {
        load: vi.fn(async ({
            userId,
            capabilityKey,
        }: {
            userId: number;
            capabilityKey: string;
        }) => ({
            userGrants: authState.userGrants.filter(
                (grant) =>
                    grant.userId === userId
                    && grant.capabilityKey === capabilityKey,
            ),
            memberships: [],
            teamRoleGrants: [],
        })),
        loadMany: vi.fn(async ({
            userId,
            capabilityKeys,
        }: {
            userId: number;
            capabilityKeys: readonly string[];
        }) => ({
            userGrants: authState.userGrants.filter(
                (grant) =>
                    grant.userId === userId
                    && capabilityKeys.includes(grant.capabilityKey),
            ),
            memberships: [],
            teamRoleGrants: [],
        })),
    };

    const prisma = {
        $transaction: vi.fn(),
        $queryRaw: vi.fn(),
        userCapabilityGrant: {
            findMany: vi.fn(),
        },
        teamMembership: {
            findMany: vi.fn(),
        },
        teamRoleCapabilityGrant: {
            findMany: vi.fn(),
        },
        user: {
            findFirst: vi.fn(),
            findUnique: vi.fn(),
        },
        employee: {
            findUnique: vi.fn(),
            findMany: vi.fn(),
        },
        leaveRequest: {
            findUnique: vi.fn(),
            findUniqueOrThrow: vi.fn(),
            update: vi.fn(),
            updateMany: vi.fn(),
        },
        leaveQuota: {
            findFirst: vi.fn(),
            findMany: vi.fn(),
            update: vi.fn(),
        },
        notification: {
            create: vi.fn(),
            update: vi.fn(),
            updateMany: vi.fn(),
        },
        notificationOutbox: {
            create: vi.fn(),
        },
        auditLog: {
            create: vi.fn(),
        },
    };

    return {
        after: vi.fn(),
        authState,
        authorizationRepository,
        authorizationResolve: vi.fn(),
        authorizationResolveInTransaction: vi.fn(),
        enforceAuthenticatedMutationRateLimit: vi.fn(),
        enforcePreAuthIpRateLimit: vi.fn(),
        getCategories: vi.fn(),
        getItems: vi.fn(),
        createCategory: vi.fn(),
        deleteCategory: vi.fn(),
        createItem: vi.fn(),
        adjustStock: vi.fn(),
        prisma,
        processOutbox: vi.fn(),
        requireActiveWorkforceOrAdminSession: vi.fn(),
        requireLiffWorkforceSession: vi.fn(),
    };
});

vi.mock("next/server", async (importOriginal) => {
    const actual = await importOriginal<typeof NextServerModule>();
    return {
        ...actual,
        after: mocks.after,
    };
});

vi.mock("@/lib/auth/workforce", () => ({
    requireActiveWorkforceOrAdminSession:
        mocks.requireActiveWorkforceOrAdminSession,
}));

vi.mock("@/modules/line", () => ({
    requireLiffWorkforceSession: mocks.requireLiffWorkforceSession,
}));

vi.mock("@/lib/db/prisma", () => ({
    prisma: mocks.prisma,
}));

vi.mock("@/lib/services/outbox/processor", () => ({
    processOutbox: mocks.processOutbox,
}));

vi.mock("@/lib/security/mutation-rate-limit", () => ({
    enforceAuthenticatedMutationRateLimit:
        mocks.enforceAuthenticatedMutationRateLimit,
    enforcePreAuthIpRateLimit: mocks.enforcePreAuthIpRateLimit,
}));

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
            getCategories: mocks.getCategories,
            getItems: mocks.getItems,
            createCategory: mocks.createCategory,
            deleteCategory: mocks.deleteCategory,
            createItem: mocks.createItem,
            adjustStock: mocks.adjustStock,
        },
    };
});

import { GET as getStockCategories, POST as postStockCategories, DELETE as deleteStockCategory } from "@/app/api/stock/categories/route";
import { GET as getStockItems, POST as postStockItem } from "@/app/api/stock/items/route";
import { POST as adjustStockItem } from "@/app/api/stock/items/[id]/adjust/route";
import { POST as cancelLeaveRequest } from "@/app/api/line/leave/cancel/route";
import { POST as requestLeaveNotTaken, PUT as confirmLeaveNotTaken } from "@/app/api/line/leave/not-taken/route";

const DASHBOARD_USER = {
    id: 7,
    email: "employee@example.com",
    name: "พนักงานทดสอบ",
    role: "USER",
} as const;

const DASHBOARD_AUTH = {
    ok: true as const,
    user: DASHBOARD_USER,
    employeeId: 21,
};

const LIFF_USER_AUTH = {
    ok: true as const,
    user: {
        id: 7,
        email: "employee@example.com",
        name: "พนักงานทดสอบ",
        role: "USER",
    },
    employeeId: 21,
};

const LIFF_ADMIN_AUTH = {
    ok: true as const,
    user: {
        id: 8,
        email: "admin@example.com",
        name: "ผู้ดูแลทดสอบ",
        role: "ADMIN",
    },
    employeeId: 31,
};

function request(
    path: string,
    init?: ConstructorParameters<typeof NextRequest>[1],
): NextRequest {
    return new NextRequest(`http://localhost${path}`, init);
}

function activeTransactionUser(
    auth: typeof LIFF_USER_AUTH | typeof LIFF_ADMIN_AUTH,
): {
    id: number;
    role: string;
    isActive: true;
    deletedAt: null;
    employee: { id: number; status: "ACTIVE"; deletedAt: null };
} {
    return {
        id: auth.user.id,
        role: auth.user.role,
        isActive: true,
        deletedAt: null,
        employee: {
            id: auth.employeeId,
            status: "ACTIVE",
            deletedAt: null,
        },
    };
}

async function expectLastAuthorizationDecision(
    resolverMock: typeof mocks.authorizationResolve | typeof mocks.authorizationResolveInTransaction,
    expected: Record<string, unknown>,
): Promise<void> {
    const result = resolverMock.mock.results[resolverMock.mock.results.length - 1];
    const value = result?.type === "return" ? await result.value : undefined;
    expect(value).toMatchObject(expected);
}

function expectDashboardStockAuthorization(capability: string): void {
    expect(mocks.authorizationResolve).toHaveBeenCalledTimes(1);
    expect(mocks.authorizationResolve).toHaveBeenCalledWith(
        {
            userId: DASHBOARD_USER.id,
            employeeId: DASHBOARD_AUTH.employeeId,
            systemRole: "USER",
            channel: "DASHBOARD",
        },
        capability,
    );
    expect(mocks.authorizationRepository.load).toHaveBeenCalledWith({
        userId: DASHBOARD_USER.id,
        capabilityKey: capability,
    });
}

function expectLiffLeaveAuthorization(
    auth: typeof LIFF_USER_AUTH | typeof LIFF_ADMIN_AUTH,
    capability: string,
): void {
    expect(mocks.requireLiffWorkforceSession).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
            where: expect.objectContaining({
                id: auth.user.id,
                employeeId: auth.employeeId,
            }),
        }),
    );
    expect(mocks.authorizationResolveInTransaction).toHaveBeenCalledTimes(1);
    expect(mocks.authorizationResolveInTransaction).toHaveBeenCalledWith(
        {
            userId: auth.user.id,
            employeeId: auth.employeeId,
            systemRole: auth.user.role,
            channel: "LIFF_SELF_SERVICE",
        },
        capability,
        mocks.prisma,
    );
    if (auth.user.role === "USER") {
        expect(mocks.prisma.userCapabilityGrant.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    userId: auth.user.id,
                    capabilityKey: capability,
                }),
            }),
        );
    }
}

function unrelatedLeaveRequest(id: string): Record<string, unknown> {
    return {
        id,
        employeeId: 99,
        leaveType: "VACATION",
        startDate: new Date("2099-01-10T00:00:00.000Z"),
        endDate: new Date("2099-01-10T00:00:00.000Z"),
        period: "FULL_DAY",
        durationHalfDays: 2,
        reason: "พักผ่อน",
        emergencyReason: null,
        specialReason: null,
        overQuotaHalfDays: 0,
        status: "PENDING",
        approverId: 20,
        exceptionApproverId: null,
        exceptionApproverAssignedAt: null,
        approvalActionVersion: 1,
        approvedAt: null,
        rejectReason: null,
        notTakenReason: null,
        notTakenRequestedAt: null,
        notTakenConfirmedAt: null,
        notTakenConfirmedById: null,
        cancellationReason: null,
        cancellationRequestedAt: null,
        cancellationConfirmedAt: null,
        cancellationConfirmedById: null,
        attachmentUrl: null,
        createdAt: new Date("2098-12-20T00:00:00.000Z"),
        updatedAt: new Date("2098-12-20T00:00:00.000Z"),
        employee: {
            id: 99,
            firstName: "พนักงาน",
            lastName: "คนอื่น",
            email: "other@example.com",
            user: { id: 99 },
        },
        approver: null,
        exceptionApprover: null,
    };
}

function unrelatedNotTakenRequest(id: string): Record<string, unknown> {
    return {
        ...unrelatedLeaveRequest(id),
        status: "APPROVED",
        endDate: new Date("2000-01-10T00:00:00.000Z"),
        approvedAt: new Date("1999-12-20T00:00:00.000Z"),
    };
}

function adminRecoveryNotTakenRequest(): Record<string, unknown> {
    return {
        ...unrelatedLeaveRequest("leave-admin-recovery"),
        employeeId: 21,
        status: "APPROVED",
        approvedAt: new Date("2098-12-20T00:00:00.000Z"),
        notTakenRequestedAt: new Date("2099-01-12T00:00:00.000Z"),
        approver: {
            id: 20,
            firstName: "ผู้อนุมัติ",
            lastName: "ไม่ใช้งาน",
            email: "manager@example.com",
            status: "INACTIVE",
            deletedAt: null,
            user: {
                id: 20,
                email: "manager@example.com",
                isActive: false,
                deletedAt: null,
            },
        },
    };
}

describe("Phase 11C.2C.2 exact Stock and Leave route authorization", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.authState.userGrants = [];

        mocks.requireActiveWorkforceOrAdminSession.mockResolvedValue(
            DASHBOARD_AUTH,
        );
        mocks.requireLiffWorkforceSession.mockResolvedValue(LIFF_USER_AUTH);
        mocks.prisma.$queryRaw.mockResolvedValue([]);
        mocks.prisma.user.findFirst.mockResolvedValue(
            activeTransactionUser(LIFF_USER_AUTH),
        );
        mocks.prisma.user.findUnique.mockResolvedValue(null);
        mocks.prisma.userCapabilityGrant.findMany.mockResolvedValue([]);
        mocks.prisma.teamMembership.findMany.mockResolvedValue([]);
        mocks.prisma.teamRoleCapabilityGrant.findMany.mockResolvedValue([]);
        mocks.prisma.employee.findUnique.mockResolvedValue({ manager: null });
        mocks.prisma.employee.findMany.mockResolvedValue([]);
        mocks.prisma.leaveRequest.findUnique.mockResolvedValue(null);
        mocks.prisma.leaveRequest.findUniqueOrThrow.mockResolvedValue(null);
        mocks.prisma.leaveRequest.update.mockResolvedValue(null);
        mocks.prisma.leaveRequest.updateMany.mockResolvedValue({ count: 0 });
        mocks.prisma.leaveQuota.findFirst.mockResolvedValue(null);
        mocks.prisma.leaveQuota.findMany.mockResolvedValue([]);
        mocks.prisma.leaveQuota.update.mockResolvedValue(null);
        mocks.prisma.notification.create.mockResolvedValue(null);
        mocks.prisma.notification.update.mockResolvedValue(null);
        mocks.prisma.notification.updateMany.mockResolvedValue({ count: 0 });
        mocks.prisma.notificationOutbox.create.mockResolvedValue(null);
        mocks.prisma.auditLog.create.mockResolvedValue(null);
        mocks.prisma.$transaction.mockImplementation(
            async (callback: (tx: typeof mocks.prisma) => Promise<unknown>) =>
                callback(mocks.prisma),
        );
        mocks.enforcePreAuthIpRateLimit.mockReturnValue(null);
        mocks.enforceAuthenticatedMutationRateLimit.mockReturnValue(null);
        mocks.processOutbox.mockResolvedValue({ processed: 0, failed: 0 });
    });

    it("LEDGER-STK-01 executes category GET through stock.catalog.read", async () => {
        mocks.getCategories.mockResolvedValue([
            { id: 2, name: "เครื่องเขียน" },
        ]);

        const response = await getStockCategories();

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            categories: [{ id: 2, name: "เครื่องเขียน" }],
        });
        expectDashboardStockAuthorization("stock.catalog.read");
        await expectLastAuthorizationDecision(mocks.authorizationResolve, {
            capability: "stock.catalog.read",
            allowed: false,
            scopes: [],
            grants: [],
            reason: "NO_APPLICABLE_GRANT",
        });
        expect(mocks.authorizationResolve.mock.invocationCallOrder[0])
            .toBeLessThan(mocks.getCategories.mock.invocationCallOrder[0]);
        expect(mocks.getCategories).toHaveBeenCalledTimes(1);
    });

    it("LEDGER-STK-02 denies category POST without stock.inventory.manage", async () => {
        const response = await postStockCategories(request(
            "/api/stock/categories",
            {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    name: "หมวดทดสอบ",
                    description: "ข้อมูลสำหรับทดสอบ",
                    userId: 999,
                    employeeId: 999,
                    role: "ADMIN",
                    capability: "stock.catalog.read",
                    channel: "LIFF_SELF_SERVICE",
                    scope: "ALL",
                }),
            },
        ));

        expect(response.status).toBe(403);
        expectDashboardStockAuthorization("stock.inventory.manage");
        await expectLastAuthorizationDecision(mocks.authorizationResolve, {
            capability: "stock.inventory.manage",
            allowed: false,
            reason: "NO_APPLICABLE_GRANT",
        });
        expect(mocks.createCategory).not.toHaveBeenCalled();
    });

    it("LEDGER-STK-03 denies category DELETE without stock.inventory.manage", async () => {
        const response = await deleteStockCategory(request(
            "/api/stock/categories?id=42&userId=999&employeeId=999&role=ADMIN&capability=stock.catalog.read&channel=LIFF_SELF_SERVICE&scope=ALL",
            { method: "DELETE" },
        ));

        expect(response.status).toBe(403);
        expectDashboardStockAuthorization("stock.inventory.manage");
        await expectLastAuthorizationDecision(mocks.authorizationResolve, {
            capability: "stock.inventory.manage",
            allowed: false,
            reason: "NO_APPLICABLE_GRANT",
        });
        expect(mocks.deleteCategory).not.toHaveBeenCalled();
    });

    it("LEDGER-STK-04 executes item GET through stock.catalog.read", async () => {
        mocks.getItems.mockResolvedValue({
            items: [],
            total: 0,
            page: 2,
            limit: 12,
        });

        const response = await getStockItems(request(
            "/api/stock/items?categoryId=2&search=paper&activeOnly=false&page=2&limit=12&userId=999&employeeId=999&role=ADMIN&capability=stock.inventory.manage&channel=LIFF_SELF_SERVICE&scope=ALL",
        ));

        expect(response.status).toBe(200);
        expect(mocks.getItems).toHaveBeenCalledWith({
            categoryId: 2,
            search: "paper",
            activeOnly: false,
            page: 2,
            limit: 12,
        });
        expectDashboardStockAuthorization("stock.catalog.read");
        await expectLastAuthorizationDecision(mocks.authorizationResolve, {
            capability: "stock.catalog.read",
            allowed: false,
            reason: "NO_APPLICABLE_GRANT",
        });
        expect(mocks.authorizationResolve.mock.invocationCallOrder[0])
            .toBeLessThan(mocks.getItems.mock.invocationCallOrder[0]);
    });

    it("LEDGER-STK-05 denies item POST without stock.inventory.manage", async () => {
        const response = await postStockItem(request(
            "/api/stock/items",
            {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    name: "วัสดุทดสอบ",
                    categoryId: 2,
                    variants: [{ unit: "ชิ้น", quantity: 10, minStock: 2 }],
                    userId: 999,
                    employeeId: 999,
                    role: "ADMIN",
                    capability: "stock.catalog.read",
                    channel: "LIFF_SELF_SERVICE",
                    scope: "ALL",
                }),
            },
        ));

        expect(response.status).toBe(403);
        expectDashboardStockAuthorization("stock.inventory.manage");
        await expectLastAuthorizationDecision(mocks.authorizationResolve, {
            capability: "stock.inventory.manage",
            allowed: false,
            reason: "NO_APPLICABLE_GRANT",
        });
        expect(mocks.createItem).not.toHaveBeenCalled();
    });

    it("LEDGER-STK-08 denies item adjustment without stock.inventory.manage", async () => {
        const response = await adjustStockItem(
            request("/api/stock/items/101/adjust", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    variantId: 101,
                    type: "IN",
                    quantity: 1,
                    minStock: 2,
                    userId: 999,
                    employeeId: 999,
                    role: "ADMIN",
                    capability: "stock.catalog.read",
                    channel: "LIFF_SELF_SERVICE",
                    scope: "ALL",
                }),
            }),
            { params: Promise.resolve({ id: "101" }) },
        );

        expect(response.status).toBe(403);
        expectDashboardStockAuthorization("stock.inventory.manage");
        await expectLastAuthorizationDecision(mocks.authorizationResolve, {
            capability: "stock.inventory.manage",
            allowed: false,
            reason: "NO_APPLICABLE_GRANT",
        });
        expect(mocks.adjustStock).not.toHaveBeenCalled();
        expect(mocks.processOutbox).not.toHaveBeenCalled();
    });

    it("LEDGER-LEV-14 denies unrelated LIFF employee cancellation through the real leave.request.cancel path", async () => {
        mocks.prisma.leaveRequest.findUnique.mockResolvedValue(
            unrelatedLeaveRequest("leave-unrelated-cancel") as never,
        );

        const response = await cancelLeaveRequest(request(
            "/api/line/leave/cancel",
            {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    leaveId: "leave-unrelated-cancel",
                    reason: "ไม่ใช้วันลาแล้ว",
                    userId: 999,
                    employeeId: 999,
                    role: "ADMIN",
                    capability: "leave.cancellation.decide",
                    channel: "DASHBOARD",
                    scope: "ALL",
                }),
            },
        ));

        expect(response.status).toBe(404);
        expectLiffLeaveAuthorization(
            LIFF_USER_AUTH,
            "leave.request.cancel",
        );
        await expectLastAuthorizationDecision(
            mocks.authorizationResolveInTransaction,
            {
                capability: "leave.request.cancel",
                allowed: false,
                reason: "NO_APPLICABLE_GRANT",
            },
        );
        expect(mocks.prisma.leaveRequest.findUnique).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: "leave-unrelated-cancel" },
            }),
        );
        expect(mocks.prisma.leaveRequest.updateMany).not.toHaveBeenCalled();
        expect(mocks.prisma.notificationOutbox.create).not.toHaveBeenCalled();
        expect(mocks.prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it("LEDGER-LEV-16 denies unrelated LIFF employee not-taken request through the real application path", async () => {
        mocks.prisma.leaveRequest.findUnique.mockResolvedValue(
            unrelatedNotTakenRequest("leave-unrelated-not-taken") as never,
        );

        const response = await requestLeaveNotTaken(request(
            "/api/line/leave/not-taken",
            {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    leaveId: "leave-unrelated-not-taken",
                    note: "ไม่ได้ใช้วันลานี้",
                    userId: 999,
                    employeeId: 999,
                    role: "ADMIN",
                    capability: "leave.cancellation.decide",
                    channel: "DASHBOARD",
                    scope: "ALL",
                }),
            },
        ));

        expect(response.status).toBe(404);
        expectLiffLeaveAuthorization(
            LIFF_USER_AUTH,
            "leave.request.not_taken",
        );
        await expectLastAuthorizationDecision(
            mocks.authorizationResolveInTransaction,
            {
                capability: "leave.request.not_taken",
                allowed: false,
                reason: "NO_APPLICABLE_GRANT",
            },
        );
        expect(mocks.prisma.leaveRequest.findUnique).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: "leave-unrelated-not-taken" },
            }),
        );
        expect(mocks.prisma.leaveRequest.updateMany).not.toHaveBeenCalled();
        expect(mocks.prisma.notificationOutbox.create).not.toHaveBeenCalled();
        expect(mocks.prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it("LEDGER-LEV-17 denies unrelated LIFF ADMIN confirmation without recovery override", async () => {
        mocks.requireLiffWorkforceSession.mockResolvedValue(LIFF_ADMIN_AUTH);
        mocks.prisma.user.findFirst.mockResolvedValue(
            activeTransactionUser(LIFF_ADMIN_AUTH),
        );
        mocks.prisma.leaveRequest.findUnique.mockResolvedValue(
            adminRecoveryNotTakenRequest() as never,
        );

        const response = await confirmLeaveNotTaken(request(
            "/api/line/leave/not-taken",
            {
                method: "PUT",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    leaveId: "leave-admin-recovery",
                    reason: "ข้อมูลจากผู้ดูแลที่ปลอมแปลง",
                    userId: 999,
                    employeeId: 999,
                    role: "ADMIN",
                    allowAdminOverride: true,
                    capability: "leave.cancellation.decide",
                    channel: "DASHBOARD",
                    scope: "ALL",
                }),
            },
        ));

        expect(response.status).toBe(403);
        expectLiffLeaveAuthorization(
            LIFF_ADMIN_AUTH,
            "leave.request.not_taken",
        );
        await expectLastAuthorizationDecision(
            mocks.authorizationResolveInTransaction,
            {
                capability: "leave.request.not_taken",
                allowed: true,
                scopes: ["OWN", "ASSIGNED"],
            },
        );
        expect(mocks.prisma.leaveRequest.findUnique).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: "leave-admin-recovery" },
            }),
        );
        expect(mocks.prisma.leaveRequest.updateMany).not.toHaveBeenCalled();
        expect(mocks.prisma.leaveQuota.update).not.toHaveBeenCalled();
        expect(mocks.prisma.notificationOutbox.create).not.toHaveBeenCalled();
        expect(mocks.prisma.auditLog.create).not.toHaveBeenCalled();
    });
});
