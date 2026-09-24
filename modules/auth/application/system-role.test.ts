// @vitest-environment node
import type { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UserRole } from "@/lib/ssot/permissions";

const mocks = vi.hoisted(() => ({
    appendAuditInTransaction: vi.fn(),
    findEmployeeIdHint: vi.fn(),
    lockEmployeeRows: vi.fn(),
    lockUserRows: vi.fn(),
    runSerializableTransaction: vi.fn(),
}));

vi.mock("@/modules/audit", () => ({
    appendAuditInTransaction: mocks.appendAuditInTransaction,
}));
vi.mock("@/lib/db/prisma", () => ({
    prisma: { user: { findUnique: mocks.findEmployeeIdHint } },
}));
vi.mock("@/lib/db/row-locks", () => ({
    lockEmployeeRows: mocks.lockEmployeeRows,
    lockUserRows: mocks.lockUserRows,
}));
vi.mock("@/lib/db/transaction", () => ({
    runSerializableTransaction: mocks.runSerializableTransaction,
}));

import {
    assertEligibleSystemAdminRemovalSafe,
    changeSystemRole,
    type SystemRoleChangeActor,
} from "./system-role";

type EmployeeState = {
    status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
    deletedAt: Date | null;
};

type AccountState = {
    id: number;
    role: UserRole;
    isActive: boolean;
    deletedAt: Date | null;
    employeeId: number | null;
    employee: EmployeeState | null;
};

function account(
    id: number,
    role: UserRole,
    overrides: Partial<Omit<AccountState, "id" | "role">> = {},
): AccountState {
    return {
        id,
        role,
        isActive: true,
        deletedAt: null,
        employeeId: overrides.employee === null ? null : overrides.employeeId ?? id + 100,
        employee: { status: "ACTIVE", deletedAt: null },
        ...overrides,
    };
}

function actor(userId = 99): SystemRoleChangeActor {
    return {
        userId,
        userEmail: "admin@example.com",
        ipAddress: "192.0.2.99",
        userAgent: "system-role-test",
    };
}

function createHarness(initialAccounts: readonly AccountState[]) {
    let persisted = new Map(initialAccounts.map((item) => [item.id, item]));
    let working = new Map(persisted);
    const tx = {
        user: {
            findUnique: vi.fn(),
            findMany: vi.fn(),
            update: vi.fn(),
        },
    } as unknown as Prisma.TransactionClient;

    tx.user.findUnique = vi.fn(async ({ where }: { where: { id?: number } }) =>
        working.get(where.id ?? 0) ?? null) as never;
    tx.user.findMany = vi.fn(async () => [...working.values()]
        .filter((item) => item.role === "ADMIN"
            && item.isActive
            && item.deletedAt === null
            && item.employee?.status === "ACTIVE"
            && item.employee.deletedAt === null)
        .map((item) => ({ id: item.id }))) as never;
    tx.user.update = vi.fn(async ({
        where,
        data,
    }: {
        where: { id: number };
        data: { role: UserRole };
    }) => {
        const current = working.get(where.id);
        if (!current) throw new Error("missing account");
        working.set(where.id, { ...current, role: data.role });
        return { ...current, role: data.role };
    }) as never;

    let transactionQueue = Promise.resolve();
    mocks.runSerializableTransaction.mockImplementation((callback: (
        transaction: Prisma.TransactionClient,
    ) => Promise<unknown>) => {
        const run = transactionQueue.then(async () => {
            working = new Map([...persisted].map(([id, item]) => [id, { ...item }]));
            const result = await callback(tx);
            persisted = new Map([...working].map(([id, item]) => [id, { ...item }]));
            return result;
        });
        transactionQueue = run.then(() => undefined, () => undefined);
        return run;
    });
    mocks.findEmployeeIdHint.mockImplementation(async ({ where }: { where: { id: number } }) => {
        const accountState = persisted.get(where.id);
        return accountState ? { employeeId: accountState.employeeId } : null;
    });

    return {
        tx,
        getRole: (userId: number): UserRole | undefined => persisted.get(userId)?.role,
        setAccount: (item: AccountState): void => {
            persisted.set(item.id, item);
            working.set(item.id, item);
        },
        getEligibleAdminIds: (): number[] => [...persisted.values()]
            .filter((item) => item.role === "ADMIN"
                && item.isActive
                && item.deletedAt === null
                && item.employee?.status === "ACTIVE"
                && item.employee.deletedAt === null)
            .map((item) => item.id),
    };
}

describe("Auth-owned system role lifecycle", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.appendAuditInTransaction.mockResolvedValue(undefined);
        mocks.findEmployeeIdHint.mockReset();
        mocks.lockEmployeeRows.mockReset().mockResolvedValue(undefined);
        mocks.lockUserRows.mockResolvedValue(undefined);
    });

    it("promotes an eligible USER without creating business authority", async () => {
        const harness = createHarness([account(7, "USER"), account(99, "ADMIN")]);

        await expect(changeSystemRole({
            targetUserId: 7,
            systemRole: "ADMIN",
            actor: actor(),
        })).resolves.toMatchObject({ userId: 7, before: "USER", after: "ADMIN" });

        expect(harness.getRole(7)).toBe("ADMIN");
        expect(harness.tx.user.update).toHaveBeenCalledWith({
            where: { id: 7 },
            data: { role: "ADMIN" },
        });
        expect(mocks.appendAuditInTransaction).toHaveBeenCalledWith(
            harness.tx,
            expect.objectContaining({
                action: "USER_ROLE_CHANGE",
                entityType: "User",
                entityId: 7,
                userId: 99,
                details: {
                    before: { systemRole: "USER" },
                    after: { systemRole: "ADMIN" },
                    metadata: { targetUserId: 7 },
                },
            }),
        );
    });

    it.each([
        ["inactive account", { isActive: false }],
        ["deleted account", { deletedAt: new Date("2026-01-01T00:00:00.000Z") }],
        ["missing employee", { employee: null }],
        ["inactive employee", { employee: { status: "INACTIVE", deletedAt: null } }],
        ["deleted employee", { employee: { status: "ACTIVE", deletedAt: new Date("2026-01-01T00:00:00.000Z") } }],
    ] as const)("rejects promotion for an %s", async (_label, overrides) => {
        const harness = createHarness([account(7, "USER", overrides), account(99, "ADMIN")]);

        await expect(changeSystemRole({
            targetUserId: 7,
            systemRole: "ADMIN",
            actor: actor(),
        })).rejects.toMatchObject({ code: "TARGET_NOT_ELIGIBLE", statusCode: 409 });
        expect(harness.getRole(7)).toBe("USER");
        expect(harness.tx.user.update).not.toHaveBeenCalled();
    });

    it("demotes an eligible ADMIN when another eligible ADMIN remains", async () => {
        const harness = createHarness([account(7, "ADMIN"), account(8, "ADMIN")]);

        await expect(changeSystemRole({
            targetUserId: 7,
            systemRole: "USER",
            actor: actor(8),
        })).resolves.toMatchObject({ userId: 7, before: "ADMIN", after: "USER" });

        expect(harness.getEligibleAdminIds()).toEqual([8]);
        expect(mocks.lockEmployeeRows).toHaveBeenCalledWith(harness.tx, [108, 107]);
        expect(mocks.lockUserRows).toHaveBeenNthCalledWith(1, harness.tx, [8, 7]);
        expect(mocks.lockUserRows).toHaveBeenCalledWith(harness.tx, [7, 8]);
    });

    it("rejects removal of the last eligible ADMIN", async () => {
        const harness = createHarness([account(7, "ADMIN")]);

        await expect(
            assertEligibleSystemAdminRemovalSafe(harness.tx, 7),
        ).rejects.toMatchObject({ code: "LAST_ELIGIBLE_ADMIN", statusCode: 409 });
        expect(harness.getRole(7)).toBe("ADMIN");
    });

    it("rejects self-demotion before changing the role", async () => {
        const harness = createHarness([account(7, "ADMIN"), account(8, "ADMIN")]);

        await expect(changeSystemRole({
            targetUserId: 7,
            systemRole: "USER",
            actor: actor(7),
        })).rejects.toMatchObject({ code: "SELF_DEMOTION", statusCode: 403 });
        expect(harness.getRole(7)).toBe("ADMIN");
        expect(harness.tx.user.update).not.toHaveBeenCalled();
    });

    it("returns a stable no-state-change error", async () => {
        const harness = createHarness([account(7, "ADMIN"), account(99, "ADMIN")]);

        await expect(changeSystemRole({
            targetUserId: 7,
            systemRole: "ADMIN",
            actor: actor(),
        })).rejects.toMatchObject({ code: "NO_STATE_CHANGE", statusCode: 409 });
        expect(harness.tx.user.update).not.toHaveBeenCalled();
    });

    it("rolls back the role when the same-transaction audit append fails", async () => {
        const harness = createHarness([account(7, "USER"), account(99, "ADMIN")]);
        const auditError = new Error("audit unavailable");
        mocks.appendAuditInTransaction.mockRejectedValueOnce(auditError);

        await expect(changeSystemRole({
            targetUserId: 7,
            systemRole: "ADMIN",
            actor: actor(),
        })).rejects.toBe(auditError);
        expect(harness.getRole(7)).toBe("USER");
        expect(harness.tx.user.update).toHaveBeenCalledTimes(1);
    });

    it("rejects a request actor after the persisted ADMIN role was revoked", async () => {
        const harness = createHarness([account(7, "USER"), account(99, "ADMIN")]);
        harness.setAccount(account(99, "USER"));

        await expect(changeSystemRole({
            targetUserId: 7,
            systemRole: "ADMIN",
            actor: actor(99),
        })).rejects.toMatchObject({ code: "ACTOR_NOT_AUTHORIZED", statusCode: 403 });

        expect(harness.getRole(7)).toBe("USER");
        expect(harness.tx.user.update).not.toHaveBeenCalled();
        expect(mocks.appendAuditInTransaction).not.toHaveBeenCalled();
    });

    it("serializes concurrent demotions without leaving zero eligible ADMINs", async () => {
        const harness = createHarness([account(7, "ADMIN"), account(8, "ADMIN")]);

        const results = await Promise.allSettled([
            changeSystemRole({ targetUserId: 7, systemRole: "USER", actor: actor(8) }),
            changeSystemRole({ targetUserId: 8, systemRole: "USER", actor: actor(7) }),
        ]);

        expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
        expect(results.find((result) => result.status === "rejected")).toMatchObject({
            reason: { code: "ACTOR_NOT_AUTHORIZED", statusCode: 403 },
        });
        expect(harness.getEligibleAdminIds()).toHaveLength(1);
    });

    it.each([
        ["missing", null],
        ["demoted", account(99, "USER")],
        ["inactive", account(99, "ADMIN", { isActive: false })],
        ["deleted", account(99, "ADMIN", { deletedAt: new Date("2026-01-01T00:00:00.000Z") })],
        ["without an Employee", account(99, "ADMIN", { employee: null })],
        ["with an inactive Employee", account(99, "ADMIN", { employee: { status: "INACTIVE", deletedAt: null } })],
        ["with a suspended Employee", account(99, "ADMIN", { employee: { status: "SUSPENDED", deletedAt: null } })],
        ["with a deleted Employee", account(99, "ADMIN", { employee: { status: "ACTIVE", deletedAt: new Date("2026-01-01T00:00:00.000Z") } })],
    ] as const)("rejects an actor who is %s", async (_label, actorState) => {
        const harness = createHarness([
            account(7, "USER"),
            ...(actorState === null ? [] : [actorState]),
        ]);

        await expect(changeSystemRole({
            targetUserId: 7,
            systemRole: "ADMIN",
            actor: actor(),
        })).rejects.toMatchObject({ code: "ACTOR_NOT_AUTHORIZED", statusCode: 403 });

        expect(harness.getRole(7)).toBe("USER");
        expect(harness.tx.user.update).not.toHaveBeenCalled();
        expect(mocks.appendAuditInTransaction).not.toHaveBeenCalled();
    });
});
