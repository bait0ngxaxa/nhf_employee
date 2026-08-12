import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NotificationOutbox, Prisma, PrismaClient } from "@prisma/client";
import { mockDeep, mockReset } from "vitest-mock-extended";

import { prisma } from "@/lib/db/prisma";
import {
    buildRoutineContractExpiryEmailEventKey,
    buildRoutineContractExpiryEventKey,
    buildRoutineContractExpiryLineEventKey,
    dispatchRoutineContractExpiryOutbox,
    enqueueDueRoutineContractExpiryReminders,
    getRoutineContractExpiryNotificationDate,
    getRoutineContractExpiryScheduledFor,
} from "@/lib/services/routine/contract-reminders";

const createInAppNotificationOnceMock = vi.hoisted(() => vi.fn());
const sendRoutineContractExpiryNotificationMock = vi.hoisted(() => vi.fn());
const sendLineAppMessageMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/prisma", () => ({
    prisma: mockDeep<PrismaClient>(),
}));

vi.mock("@/lib/db/transaction", () => ({
    hasPrismaErrorCode: (error: unknown, code: string): boolean =>
        typeof error === "object"
        && error !== null
        && "code" in error
        && error.code === code,
    runSerializableTransaction: vi.fn(async (
        callback: (tx: Prisma.TransactionClient) => Promise<unknown>,
    ) => callback(prisma as unknown as Prisma.TransactionClient)),
}));

vi.mock("@/lib/services/notifications/in-app", () => ({
    createInAppNotificationOnce: createInAppNotificationOnceMock,
}));

vi.mock("@/lib/email", () => ({
    sendRoutineContractExpiryNotification:
        sendRoutineContractExpiryNotificationMock,
}));

vi.mock("@/lib/line/messaging", () => ({
    sendLineAppMessage: sendLineAppMessageMock,
}));

const prismaMock = prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>;

function asNever<T>(value: T): never {
    return value as unknown as never;
}

function buildAssignee(
    userId: number,
    role: "OWNER" | "CO_OWNER" = "OWNER",
    overrides: Record<string, unknown> = {},
) {
    return {
        role,
        employee: {
            firstName: "ผู้รับผิดชอบ",
            lastName: String(userId),
            nickname: null,
            status: "ACTIVE",
            deletedAt: null,
            user: {
                id: userId,
                name: `ผู้รับผิดชอบ ${userId}`,
                email: `user-${userId}@example.com`,
                isActive: true,
                deletedAt: null,
            },
            ...overrides,
        },
    };
}

function buildTask(overrides: Record<string, unknown> = {}) {
    return {
        id: 71,
        title: "ต่ออายุบริการระบบ",
        isActive: true,
        contractEndDate: new Date("2026-12-31T00:00:00.000Z"),
        unit: { name: "มสช." },
        category: { name: "ระบบคอมพิวเตอร์" },
        assignees: [buildAssignee(17)],
        ...overrides,
    };
}

function buildPayload(overrides: Record<string, unknown> = {}) {
    return {
        taskId: 71,
        contractEndDate: "2026-12-31",
        notificationDate: "2026-11-30",
        scheduledFor: "2026-11-30T02:00:00.000Z",
        createdAt: "2026-11-30T02:00:00.000Z",
        ...overrides,
    };
}

function buildNotification(
    payload: ReturnType<typeof buildPayload> = buildPayload(),
): NotificationOutbox {
    return {
        id: 501,
        type: "ROUTINE_CONTRACT_EXPIRY_IN_APP",
        eventKey: buildRoutineContractExpiryEventKey(
            payload.taskId as number,
            payload.contractEndDate as string,
        ),
        payload: JSON.stringify(payload),
        status: "PROCESSING",
        attempts: 0,
        nextAttemptAt: new Date("2026-11-30T02:00:00.000Z"),
        lastError: null,
        createdAt: new Date("2026-11-30T02:00:00.000Z"),
        updatedAt: new Date("2026-11-30T02:00:00.000Z"),
    };
}

describe("Routine contract expiry scheduling", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
        prismaMock.notificationOutbox.create.mockResolvedValue(
            asNever({ id: 501 }),
        );
    });

    it.each([
        ["2027-03-31", "2027-02-28"],
        ["2028-03-31", "2028-02-29"],
        ["2027-04-30", "2027-03-30"],
        ["2026-12-15", "2026-11-15"],
    ])("uses calendar month arithmetic for %s", (contractEndDate, expected) => {
        expect(getRoutineContractExpiryNotificationDate(contractEndDate)).toBe(
            expected,
        );
    });

    it("does not enqueue without a contract end date", async () => {
        prismaMock.routineTask.findMany.mockResolvedValue(asNever([]));

        const result = await enqueueDueRoutineContractExpiryReminders(
            new Date("2026-11-30T02:00:00.000Z"),
        );

        expect(result.enqueued).toBe(0);
        expect(prismaMock.notificationOutbox.create).not.toHaveBeenCalled();
    });

    it("enqueues exactly one calendar month before the contract end date", async () => {
        prismaMock.routineTask.findMany.mockResolvedValue(
            asNever([buildTask()]),
        );

        const result = await enqueueDueRoutineContractExpiryReminders(
            new Date("2026-11-30T02:00:00.000Z"),
        );

        expect(result).toEqual({
            considered: 1,
            enqueued: 1,
            duplicatesSkipped: 0,
            noRecipientSkipped: 0,
            errors: 0,
        });
        expect(prismaMock.notificationOutbox.create).toHaveBeenCalledWith({
            data: {
                type: "ROUTINE_CONTRACT_EXPIRY_IN_APP",
                eventKey: "routine-contract:71:end:2026-12-31",
                payload: JSON.stringify(buildPayload()),
            },
        });
    });

    it("does not enqueue before the notification date and time", async () => {
        prismaMock.routineTask.findMany.mockResolvedValue(
            asNever([buildTask()]),
        );

        const result = await enqueueDueRoutineContractExpiryReminders(
            new Date("2026-11-30T01:59:59.999Z"),
        );

        expect(result.enqueued).toBe(0);
        expect(prismaMock.notificationOutbox.create).not.toHaveBeenCalled();
        expect(getRoutineContractExpiryScheduledFor("2026-12-31").toISOString())
            .toBe("2026-11-30T02:00:00.000Z");
    });

    it("uses the unique event key to skip repeated scheduler runs", async () => {
        prismaMock.routineTask.findMany.mockResolvedValue(
            asNever([buildTask()]),
        );
        prismaMock.notificationOutbox.create
            .mockResolvedValueOnce(asNever({ id: 501 }))
            .mockRejectedValueOnce({
                code: "P2002",
                meta: { target: ["eventKey"] },
            });
        const now = new Date("2026-11-30T02:00:00.000Z");

        const first = await enqueueDueRoutineContractExpiryReminders(now);
        const second = await enqueueDueRoutineContractExpiryReminders(now);

        expect(first.enqueued).toBe(1);
        expect(second.duplicatesSkipped).toBe(1);
        expect(prismaMock.notificationOutbox.create).toHaveBeenCalledTimes(2);
    });

    it("creates a new deterministic event when the contract end date changes", async () => {
        prismaMock.routineTask.findMany
            .mockResolvedValueOnce(asNever([buildTask()]))
            .mockResolvedValueOnce(asNever([buildTask({
                contractEndDate: new Date("2027-03-31T00:00:00.000Z"),
            })]));

        await enqueueDueRoutineContractExpiryReminders(
            new Date("2026-11-30T02:00:00.000Z"),
        );
        await enqueueDueRoutineContractExpiryReminders(
            new Date("2027-02-28T02:00:00.000Z"),
        );

        expect(prismaMock.notificationOutbox.create.mock.calls.map(
            ([input]) => input.data.eventKey,
        )).toEqual([
            "routine-contract:71:end:2026-12-31",
            "routine-contract:71:end:2027-03-31",
        ]);
    });

    it("does not enqueue when every assignee employee or user is unavailable", async () => {
        prismaMock.routineTask.findMany.mockResolvedValue(asNever([
            buildTask({
                assignees: [
                    buildAssignee(17, "OWNER", { status: "INACTIVE" }),
                    buildAssignee(18, "CO_OWNER", {
                        user: {
                            id: 18,
                            name: "บัญชีปิดใช้งาน",
                            email: "inactive@example.com",
                            isActive: false,
                            deletedAt: null,
                        },
                    }),
                ],
            }),
        ]));

        const result = await enqueueDueRoutineContractExpiryReminders(
            new Date("2026-11-30T02:00:00.000Z"),
        );

        expect(result.noRecipientSkipped).toBe(1);
        expect(prismaMock.notificationOutbox.create).not.toHaveBeenCalled();
    });
});

describe("Routine contract expiry dispatch", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
        prismaMock.notificationOutbox.findFirst.mockResolvedValue(
            asNever({ id: 501 }),
        );
        prismaMock.notificationOutbox.updateMany.mockResolvedValue(
            asNever({ count: 1 }),
        );
        prismaMock.routineTask.findUnique.mockResolvedValue(
            asNever(buildTask()),
        );
        prismaMock.lineAccountLink.findMany.mockResolvedValue(asNever([]));
        sendRoutineContractExpiryNotificationMock.mockResolvedValue(true);
        sendLineAppMessageMock.mockResolvedValue(true);
    });

    it("notifies active owners and co-owners while excluding inactive or deleted records", async () => {
        prismaMock.routineTask.findUnique.mockResolvedValue(asNever(buildTask({
            assignees: [
                buildAssignee(17, "OWNER"),
                buildAssignee(18, "CO_OWNER"),
                buildAssignee(19, "CO_OWNER", { status: "INACTIVE" }),
                buildAssignee(20, "CO_OWNER", {
                    deletedAt: new Date("2026-01-01T00:00:00.000Z"),
                }),
                buildAssignee(21, "CO_OWNER", {
                    user: {
                        id: 21,
                        name: "ผู้ใช้ปิดใช้งาน",
                        email: "inactive-user@example.com",
                        isActive: false,
                        deletedAt: null,
                    },
                }),
                buildAssignee(22, "CO_OWNER", {
                    user: {
                        id: 22,
                        name: "ผู้ใช้ถูกลบ",
                        email: "deleted-user@example.com",
                        isActive: true,
                        deletedAt: new Date("2026-01-01T00:00:00.000Z"),
                    },
                }),
            ],
        })));

        const result = await dispatchRoutineContractExpiryOutbox(
            buildNotification(),
            buildPayload(),
            new Date("2026-11-30T02:00:00.000Z"),
        );

        expect(result).toBe("SENT");
        expect(createInAppNotificationOnceMock.mock.calls.map(
            ([input]) => input.userId,
        )).toEqual([17, 18]);
        expect(createInAppNotificationOnceMock).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "ROUTINE_CONTRACT_EXPIRY",
                title: "สัญญาใกล้สิ้นสุด",
                dedupeKey: "routine-contract:71:end:2026-12-31:user:17",
            }),
            prismaMock,
        );
        const createManyInput = prismaMock.notificationOutbox.createMany.mock
            .calls[0]?.[0];
        const emailRows = createManyInput?.data;
        expect(emailRows).toEqual([
            expect.objectContaining({
                eventKey: "routine-contract:71:end:2026-12-31:user:17:email",
            }),
            expect.objectContaining({
                eventKey: "routine-contract:71:end:2026-12-31:user:18:email",
            }),
        ]);
    });

    it.each([
        ["changed", buildTask({ contractEndDate: new Date("2027-03-31T00:00:00.000Z") })],
        ["removed", buildTask({ contractEndDate: null })],
        ["inactive", buildTask({ isActive: false })],
        ["deleted", null],
    ])("supersedes an old event when the contract is %s", async (_state, task) => {
        prismaMock.routineTask.findUnique.mockResolvedValue(asNever(task));

        const result = await dispatchRoutineContractExpiryOutbox(
            buildNotification(),
            buildPayload(),
            new Date("2026-11-30T02:00:00.000Z"),
        );

        expect(result).toBe("SUPERSEDED");
        expect(createInAppNotificationOnceMock).not.toHaveBeenCalled();
        expect(sendRoutineContractExpiryNotificationMock).not.toHaveBeenCalled();
        expect(prismaMock.notificationOutbox.updateMany).toHaveBeenCalledWith({
            where: { id: 501, status: "PROCESSING" },
            data: {
                status: "SUPERSEDED",
                lastError: "Superseded stale Routine contract expiry",
            },
        });
    });

    it("revalidates the contract before an email child is delivered", async () => {
        const payload = {
            taskId: 71,
            userId: 17,
            contractEndDate: "2026-12-31",
        };
        const notification: NotificationOutbox = {
            ...buildNotification(),
            id: 502,
            type: "ROUTINE_CONTRACT_EXPIRY_EMAIL",
            eventKey: buildRoutineContractExpiryEmailEventKey(71, "2026-12-31", 17),
            payload: JSON.stringify(payload),
        };
        prismaMock.routineTask.findUnique.mockResolvedValue(asNever(buildTask({
            contractEndDate: new Date("2027-03-31T00:00:00.000Z"),
        })));

        const result = await dispatchRoutineContractExpiryOutbox(
            notification,
            payload,
        );

        expect(result).toBe("SUPERSEDED");
        expect(sendRoutineContractExpiryNotificationMock).not.toHaveBeenCalled();
    });

    it("delivers an email child with current task and recipient data", async () => {
        const payload = {
            taskId: 71,
            userId: 17,
            contractEndDate: "2026-12-31",
        };
        const notification: NotificationOutbox = {
            ...buildNotification(),
            id: 502,
            type: "ROUTINE_CONTRACT_EXPIRY_EMAIL",
            eventKey: buildRoutineContractExpiryEmailEventKey(71, "2026-12-31", 17),
            payload: JSON.stringify(payload),
        };

        const result = await dispatchRoutineContractExpiryOutbox(
            notification,
            payload,
        );

        expect(result).toBe("SENT");
        expect(sendRoutineContractExpiryNotificationMock).toHaveBeenCalledWith(
            expect.objectContaining({
                to: "user-17@example.com",
                taskTitle: "ต่ออายุบริการระบบ",
                contractEndDate: "2026-12-31",
                taskId: 71,
                userId: 17,
            }),
        );
    });

    it("delivers a LINE child only while the assignee and link remain active", async () => {
        vi.stubEnv("PUBLIC_APPROVE_URL", "https://employee.example.com");
        const payload = {
            taskId: 71,
            userId: 17,
            contractEndDate: "2026-12-31",
            retryKey: "123e4567-e89b-42d3-a456-426614174000",
        };
        const notification: NotificationOutbox = {
            ...buildNotification(),
            id: 503,
            type: "ROUTINE_CONTRACT_EXPIRY_LINE",
            eventKey: buildRoutineContractExpiryLineEventKey(71, "2026-12-31", 17),
            payload: JSON.stringify(payload),
        };
        prismaMock.user.findUnique.mockResolvedValue(asNever({
            employeeId: 101,
            isActive: true,
            deletedAt: null,
            employee: { status: "ACTIVE", deletedAt: null },
            lineAccountLink: { lineUserId: "U-contract-owner" },
        }));

        const result = await dispatchRoutineContractExpiryOutbox(
            notification,
            payload,
        );

        expect(result).toBe("SENT");
        expect(sendLineAppMessageMock).toHaveBeenCalledWith(
            "U-contract-owner",
            expect.objectContaining({ type: "flex" }),
            payload.retryKey,
        );
        expect(JSON.stringify(sendLineAppMessageMock.mock.calls[0]?.[1]))
            .toContain("https://employee.example.com/dashboard?tab=routine&taskId=71");
    });
});
