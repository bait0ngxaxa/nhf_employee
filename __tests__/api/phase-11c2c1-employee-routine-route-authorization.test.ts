import { NextRequest } from "next/server";
import type * as NextServerModule from "next/server";
import type * as AuthorizationModule from "@/modules/authorization";
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

    const transaction = {
        $queryRaw: vi.fn().mockResolvedValue([]),
        user: {
            findUnique: vi.fn(),
        },
        userCapabilityGrant: {
            findMany: vi.fn().mockResolvedValue([]),
        },
        teamMembership: {
            findMany: vi.fn().mockResolvedValue([]),
        },
        teamRoleCapabilityGrant: {
            findMany: vi.fn().mockResolvedValue([]),
        },
        routineTaskCreateIdempotency: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn(),
        },
        routineUnit: {
            findFirst: vi.fn().mockResolvedValue(null),
        },
        routineCategory: {
            findFirst: vi.fn().mockResolvedValue(null),
        },
        routineTask: {
            create: vi.fn(),
        },
    };

    const prisma = {
        $transaction: vi.fn(),
        user: {
            findUnique: vi.fn(),
        },
        routineTask: {
            findMany: vi.fn().mockResolvedValue([]),
            count: vi.fn().mockResolvedValue(0),
            findFirst: vi.fn().mockResolvedValue(null),
        },
        routineOccurrence: {
            findMany: vi.fn().mockResolvedValue([]),
            count: vi.fn().mockResolvedValue(0),
            findFirst: vi.fn().mockResolvedValue(null),
            findUnique: vi.fn().mockResolvedValue(null),
        },
    };

    return {
        after: vi.fn(),
        applyRoutineImportBatch: vi.fn(),
        authorizationRepository,
        authorizationResolve: vi.fn(),
        authorizationResolveInTransaction: vi.fn(),
        authState,
        cancelRoutineImportBatch: vi.fn(),
        createEmployeeExport: vi.fn(),
        enforceAuthenticatedMutationRateLimit: vi.fn(),
        getRoutineImportBatch: vi.fn(),
        getRoutineImportRows: vi.fn(),
        logDataExport: vi.fn(),
        prisma,
        requireApiSession: vi.fn(),
        transaction,
        updateRoutineImportRow: vi.fn(),
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

vi.mock("@/lib/auth/api", () => ({
    requireApiSession: mocks.requireApiSession,
}));

vi.mock("@/lib/db/prisma", () => ({
    prisma: mocks.prisma,
}));

vi.mock("@/lib/security/mutation-rate-limit", () => ({
    enforceAuthenticatedMutationRateLimit:
        mocks.enforceAuthenticatedMutationRateLimit,
}));

vi.mock("@/lib/server/audit", () => ({
    logDataExport: mocks.logDataExport,
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

vi.mock("@/modules/employee", async (importOriginal) => ({
    ...(await importOriginal()),
    createEmployeeExport: mocks.createEmployeeExport,
}));

vi.mock("@/modules/routine", async (importOriginal) => ({
    ...(await importOriginal()),
    applyRoutineImportBatch: mocks.applyRoutineImportBatch,
    cancelRoutineImportBatch: mocks.cancelRoutineImportBatch,
    getRoutineImportBatch: mocks.getRoutineImportBatch,
    getRoutineImportRows: mocks.getRoutineImportRows,
    updateRoutineImportRow: mocks.updateRoutineImportRow,
}));

import { GET as getEmployeeExport } from "@/app/api/employees/export/route";
import { GET as getRoutineTasks } from "@/app/api/routines/tasks/route";
import { POST as postRoutineTask } from "@/app/api/routines/tasks/route";
import { GET as getRoutineOccurrences } from "@/app/api/routines/occurrences/route";
import { GET as getRoutineOccurrence } from "@/app/api/routines/occurrences/[id]/route";
import { GET as getRoutineImportBatch } from "@/app/api/routines/imports/[batchId]/route";
import { GET as getRoutineImportRows } from "@/app/api/routines/imports/[batchId]/rows/route";
import { PATCH as updateRoutineImportRow } from "@/app/api/routines/imports/[batchId]/rows/[rowId]/route";
import { POST as applyRoutineImportBatch } from "@/app/api/routines/imports/[batchId]/apply/route";
import { POST as cancelRoutineImportBatch } from "@/app/api/routines/imports/[batchId]/cancel/route";

const USER = {
    id: 5,
    email: "user@example.com",
    name: "ผู้ใช้ทดสอบ",
    role: "USER",
} as const;

const ACTIVE_WORKFORCE_RECORD = {
    isActive: true,
    deletedAt: null,
    employee: {
        id: 21,
        firstName: "สมชาย",
        lastName: "ใจดี",
        nickname: null,
        status: "ACTIVE",
        deletedAt: null,
    },
};

const ACTIVE_TRANSACTION_USER = {
    id: USER.id,
    role: USER.role,
    isActive: true,
    deletedAt: null,
    employee: {
        id: 21,
        status: "ACTIVE",
        deletedAt: null,
    },
};

function request(
    path: string,
    init?: ConstructorParameters<typeof NextRequest>[1],
): NextRequest {
    return new NextRequest(`http://localhost${path}`, init);
}

function expectDashboardAuthorization(
    capability: string,
    employeeId: number | null = 21,
): void {
    expect(mocks.authorizationResolve).toHaveBeenCalledWith(
        {
            userId: USER.id,
            employeeId,
            systemRole: "USER",
            channel: "DASHBOARD",
        },
        capability,
    );
}

function expectDashboardTransactionAuthorization(capability: string): void {
    expect(mocks.authorizationResolveInTransaction).toHaveBeenCalledWith(
        {
            userId: USER.id,
            employeeId: 21,
            systemRole: "USER",
            channel: "DASHBOARD",
        },
        capability,
        mocks.transaction,
    );
}

describe("Phase 11C.2C.1 exact Employee and Routine route authorization", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.authState.userGrants = [];

        mocks.requireApiSession.mockResolvedValue({
            ok: true,
            user: USER,
            session: {
                user: {
                    ...USER,
                    id: String(USER.id),
                },
            },
        });
        mocks.prisma.user.findUnique.mockResolvedValue(
            ACTIVE_WORKFORCE_RECORD,
        );
        mocks.transaction.user.findUnique.mockResolvedValue(
            ACTIVE_TRANSACTION_USER,
        );
        mocks.prisma.$transaction.mockImplementation(
            async (callback: (tx: unknown) => Promise<unknown>) =>
                callback(mocks.transaction),
        );
        mocks.enforceAuthenticatedMutationRateLimit.mockReturnValue(null);
        mocks.createEmployeeExport.mockResolvedValue({
            status: "ready",
            recordCount: 0,
            auditFilters: { search: null, status: null },
            response: new Response("csv"),
        });
        mocks.logDataExport.mockResolvedValue(undefined);
    });

    describe("LEDGER-EMP-04 GET /api/employees/export", () => {
        it("LEDGER-EMP-04 executes GET /api/employees/export with the permanent employee.export Dashboard default and ignores authority-shaped query input", async () => {
            const response = await getEmployeeExport(request(
                "/api/employees/export?search=%E0%B8%AA%E0%B8%A1%E0%B8%8A%E0%B8%B2%E0%B8%A2&status=ACTIVE&userId=999&employeeId=999&systemRole=ADMIN&channel=LIFF_SELF_SERVICE&capability=employee.delete&scope=ALL",
            ));

            expect(response.status).toBe(200);
            expect(mocks.requireApiSession).toHaveBeenCalledTimes(1);
            expectDashboardAuthorization("employee.export", null);
            expect(mocks.authorizationResolve).toHaveBeenCalledTimes(1);
            expect(mocks.authorizationRepository.load).toHaveBeenCalledWith({
                userId: USER.id,
                capabilityKey: "employee.export",
            });
            const resolverDecision = await mocks.authorizationResolve.mock.results[0]?.value;
            expect(resolverDecision).toMatchObject({
                capability: "employee.export",
                allowed: false,
                scopes: [],
                grants: [],
                reason: "NO_APPLICABLE_GRANT",
            });
            expect(mocks.requireApiSession.mock.invocationCallOrder[0])
                .toBeLessThan(
                    mocks.authorizationResolve.mock.invocationCallOrder[0],
                );
            expect(mocks.authorizationResolve.mock.invocationCallOrder[0])
                .toBeLessThan(
                    mocks.createEmployeeExport.mock.invocationCallOrder[0],
                );
            expect(mocks.createEmployeeExport).toHaveBeenCalledWith({
                search: "สมชาย",
                status: "ACTIVE",
                page: 1,
                limit: 10,
            });
            expect(mocks.logDataExport).toHaveBeenCalledWith(
                "Employee",
                USER.id,
                USER.email,
                expect.any(Object),
            );
        });
    });

    it("LEDGER-ROU-01 denies unrelated task workload through GET /api/routines/tasks", async () => {
        mocks.authState.userGrants = [{
            userId: USER.id,
            capabilityKey: "routine.task.read",
            scope: "CREATED",
        }];

        const response = await getRoutineTasks(request(
            "/api/routines/tasks?status=active&userId=999&employeeId=999&systemRole=ADMIN&capability=routine.occurrence.read&channel=LIFF_SELF_SERVICE",
        ));

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            tasks: [],
            pagination: { total: 0 },
        });
        expectDashboardAuthorization("routine.task.read");
        expect(mocks.prisma.routineTask.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    createdById: USER.id,
                    isActive: true,
                }),
            }),
        );
    });

    it("LEDGER-ROU-02 reaches the real task.create authorization path before rejecting an unavailable resource", async () => {
        const response = await postRoutineTask(request("/api/routines/tasks", {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "idempotency-key": "route-auth-task-create-1",
            },
            body: JSON.stringify({
                unitId: 1,
                categoryId: 1,
                title: "ตรวจสอบระบบ",
                scheduleType: "MONTHLY_DAY",
                scheduleConfig: { day: 10, monthOffset: 0 },
                assignees: [{ employeeId: 999, role: "OWNER" }],
                reminderRules: [],
                userId: 999,
                employeeId: 999,
                capability: "routine.import.manage",
                scope: "ALL",
            }),
        }));

        expect(response.status).toBe(400);
        expectDashboardTransactionAuthorization("routine.task.create");
        expect(mocks.transaction.routineTask.create).not.toHaveBeenCalled();
        expect(mocks.transaction.routineTaskCreateIdempotency.findUnique)
            .toHaveBeenCalledWith(expect.any(Object));
    });

    it("LEDGER-ROU-06 denies unrelated occurrence workload through GET /api/routines/occurrences", async () => {
        const response = await getRoutineOccurrences(request(
            "/api/routines/occurrences?scope=all&assigneeId=999&userId=999&capability=routine.task.read",
        ));

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            occurrences: [],
            pagination: { total: 0 },
        });
        expectDashboardAuthorization("routine.occurrence.read");
        expect(mocks.prisma.routineOccurrence.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    assignees: { some: { employeeId: 21 } },
                }),
            }),
        );
    });

    it("LEDGER-ROU-07 selects routine.task.read for GET /api/routines/occurrences?view=tasks", async () => {
        const response = await getRoutineOccurrences(request(
            "/api/routines/occurrences?view=tasks&scope=mine&capability=routine.occurrence.read&channel=LIFF_SELF_SERVICE",
        ));

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            tasks: [],
            pagination: { total: 0 },
        });
        expectDashboardAuthorization("routine.task.read");
        expect(mocks.authorizationResolve).not.toHaveBeenCalledWith(
            expect.any(Object),
            "routine.occurrence.read",
        );
        expect(mocks.prisma.routineTask.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    assignees: { some: { employeeId: 21 } },
                }),
            }),
        );
    });

    it("preserves the frozen NO_APPLICABLE_GRANT to ALL bridge only for the task work-item view", async () => {
        mocks.prisma.routineOccurrence.findUnique.mockResolvedValue({
            taskId: 71,
            task: { isActive: true },
        });

        const response = await getRoutineOccurrences(request(
            "/api/routines/occurrences?view=tasks&scope=all&taskId=71&occurrenceId=91",
        ));

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            tasks: [],
            pagination: { total: 0 },
        });
        expectDashboardAuthorization("routine.task.read");
        const taskQuery = mocks.prisma.routineTask.findMany.mock.calls[0]?.[0];
        expect(taskQuery).toEqual(expect.objectContaining({
            where: expect.objectContaining({
                id: 71,
                isActive: true,
            }),
        }));
        expect(taskQuery?.where).not.toHaveProperty("createdById");
        expect(taskQuery?.where).not.toHaveProperty("assignees");
    });

    it("LEDGER-ROU-08 denies an unrelated actor through GET /api/routines/occurrences/:id", async () => {
        const response = await getRoutineOccurrence(
            request("/api/routines/occurrences/91"),
            { params: Promise.resolve({ id: "91" }) },
        );

        expect(response.status).toBe(404);
        expectDashboardAuthorization("routine.occurrence.read");
        expect(mocks.prisma.routineOccurrence.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    id: 91,
                    assignees: { some: { employeeId: 21 } },
                }),
            }),
        );
    });

    it("LEDGER-ROU-14 denies batch data from GET /api/routines/imports/:batchId", async () => {
        const response = await getRoutineImportBatch(
            request("/api/routines/imports/17"),
            { params: Promise.resolve({ batchId: "17" }) },
        );

        expect(response.status).toBe(403);
        expectDashboardAuthorization("routine.import.manage");
        expect(mocks.getRoutineImportBatch).not.toHaveBeenCalled();
    });

    it("LEDGER-ROU-15 denies batch rows from GET /api/routines/imports/:batchId/rows", async () => {
        const response = await getRoutineImportRows(
            request("/api/routines/imports/17/rows?page=1&limit=10&capability=routine.task.read"),
            { params: Promise.resolve({ batchId: "17" }) },
        );

        expect(response.status).toBe(403);
        expectDashboardAuthorization("routine.import.manage");
        expect(mocks.getRoutineImportRows).not.toHaveBeenCalled();
    });

    it("LEDGER-ROU-16 denies row mutation from PATCH /api/routines/imports/:batchId/rows/:rowId", async () => {
        const response = await updateRoutineImportRow(
            request("/api/routines/imports/17/rows/23", {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    version: 1,
                    selected: true,
                    userId: 999,
                    capability: "routine.task.create",
                }),
            }),
            { params: Promise.resolve({ batchId: "17", rowId: "23" }) },
        );

        expect(response.status).toBe(403);
        expectDashboardAuthorization("routine.import.manage");
        expect(mocks.updateRoutineImportRow).not.toHaveBeenCalled();
    });

    it("LEDGER-ROU-17 denies applying a batch from POST /api/routines/imports/:batchId/apply", async () => {
        const response = await applyRoutineImportBatch(
            request("/api/routines/imports/17/apply", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    confirm: true,
                    userId: 999,
                    capability: "routine.task.create",
                }),
            }),
            { params: Promise.resolve({ batchId: "17" }) },
        );

        expect(response.status).toBe(403);
        expectDashboardAuthorization("routine.import.manage");
        expect(mocks.applyRoutineImportBatch).not.toHaveBeenCalled();
    });

    it("LEDGER-ROU-18 denies cancelling a batch from POST /api/routines/imports/:batchId/cancel", async () => {
        const response = await cancelRoutineImportBatch(
            request("/api/routines/imports/17/cancel?capability=routine.task.create", {
                method: "POST",
            }),
            { params: Promise.resolve({ batchId: "17" }) },
        );

        expect(response.status).toBe(403);
        expectDashboardAuthorization("routine.import.manage");
        expect(mocks.cancelRoutineImportBatch).not.toHaveBeenCalled();
    });
});
