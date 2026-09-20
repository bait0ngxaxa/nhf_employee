// @vitest-environment node
import type { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UserRole } from "@/lib/ssot/permissions";

const mocks = vi.hoisted(() => ({
    appendAuditInTransaction: vi.fn(),
    lockUserRows: vi.fn(),
    runSerializableTransaction: vi.fn(),
}));

vi.mock("@/modules/audit", () => ({
    appendAuditInTransaction: mocks.appendAuditInTransaction,
}));
vi.mock("@/lib/db/row-locks", () => ({
    lockUserRows: mocks.lockUserRows,
}));
vi.mock("@/lib/db/transaction", () => ({
    runSerializableTransaction: mocks.runSerializableTransaction,
}));

import {
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

    return {
        tx,
        getRole: (userId: number): UserRole | undefined => persisted.get(userId)?.role,
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
        mocks.lockUserRows.mockResolvedValue(undefined);
    });

    it("promotes an eligible USER without creating business authority", async () => {
        const harness = createHarness([account(7, "USER")]);

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
        const harness = createHarness([account(7, "USER", overrides)]);

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
            actor: actor(),
        })).resolves.toMatchObject({ userId: 7, before: "ADMIN", after: "USER" });

        expect(harness.getEligibleAdminIds()).toEqual([8]);
        expect(mocks.lockUserRows).toHaveBeenCalledWith(harness.tx, [7]);
        expect(mocks.lockUserRows).toHaveBeenCalledWith(harness.tx, [7, 8]);
    });

    it("rejects removal of the last eligible ADMIN", async () => {
        const harness = createHarness([account(7, "ADMIN")]);

        await expect(changeSystemRole({
            targetUserId: 7,
            systemRole: "USER",
            actor: actor(),
        })).rejects.toMatchObject({ code: "LAST_ELIGIBLE_ADMIN", statusCode: 409 });
        expect(harness.getRole(7)).toBe("ADMIN");
        expect(harness.tx.user.update).not.toHaveBeenCalled();
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
        const harness = createHarness([account(7, "ADMIN")]);

        await expect(changeSystemRole({
            targetUserId: 7,
            systemRole: "ADMIN",
            actor: actor(),
        })).rejects.toMatchObject({ code: "NO_STATE_CHANGE", statusCode: 409 });
        expect(harness.tx.user.update).not.toHaveBeenCalled();
    });

    it("rolls back the role when the same-transaction audit append fails", async () => {
        const harness = createHarness([account(7, "USER")]);
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

    it("serializes concurrent demotions without leaving zero eligible ADMINs", async () => {
        const harness = createHarness([account(7, "ADMIN"), account(8, "ADMIN")]);

        const results = await Promise.allSettled([
            changeSystemRole({ targetUserId: 7, systemRole: "USER", actor: actor(99) }),
            changeSystemRole({ targetUserId: 8, systemRole: "USER", actor: actor(100) }),
        ]);

        expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
        expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
        expect(harness.getEligibleAdminIds()).toHaveLength(1);
    });
});
