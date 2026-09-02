import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
    NotificationOutbox,
    PrismaClient,
} from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { mockDeep, mockReset } from "vitest-mock-extended";

import { prisma } from "@/lib/db/prisma";
import {
    buildLeaveLineEventKey,
    dispatchLeaveLineOutbox,
    enqueueLeaveLineNotification,
    type LeaveLineEnqueueInput,
} from "@/lib/services/leave/line-notifications";
import { createLineRetryKey } from "@/lib/services/outbox/provider-key";
import {
    persistLeaveExceptionApprover,
    resolveLeaveExceptionApprover,
} from "@/lib/services/leave/exception-approver";
import {
    buildLegacyLeaveActionDeliveryIdentity,
    buildLeaveActionDeliveryIdentity,
} from "@/lib/services/leave/notification-payloads";
import type {
    LeaveActionLinePayload,
    LeaveCancelledAfterApprovalLinePayload,
    LeaveCancellationRequestedLinePayload,
    LeaveNotTakenRequestedLinePayload,
    LeaveNotTakenConfirmedLinePayload,
    LeaveResultLinePayload,
} from "@/lib/services/leave/notification-payloads";

const sendAppLineNotificationMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/prisma", () => ({
    prisma: mockDeep<PrismaClient>(),
}));

vi.mock("@/lib/line/app-notification", () => ({
    sendAppLineNotification: sendAppLineNotificationMock,
}));

const prismaMock = prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>;

const employee = {
    employeeId: 10,
    userId: 1,
    email: "employee@example.com",
    name: "สมชาย ใจดี",
};
const approver = {
    employeeId: 20,
    userId: 2,
    email: "manager@example.com",
    name: "ผู้จัดการ ใจดี",
};
const leaveDetails = {
    leaveId: "leave-1",
    leaveType: "VACATION" as const,
    startDate: "2026-07-01T00:00:00.000Z",
    endDate: "2026-07-02T00:00:00.000Z",
    period: "FULL_DAY" as const,
    durationDays: 2,
};

function asNever<T>(value: T): never {
    return value as unknown as never;
}

function buildLineNotification(
    payload: LeaveResultLinePayload,
): NotificationOutbox {
    return {
        id: 700,
        type: "LEAVE_RESULT_LINE",
        eventKey: buildLeaveLineEventKey(
            "LEAVE_RESULT_LINE",
            payload.leaveId,
            payload.employee.userId ?? 0,
        ),
        payload: JSON.stringify(payload),
        status: "PROCESSING",
        attempts: 0,
        nextAttemptAt: new Date(),
        lastError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
}

describe("Leave LINE outbox", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
        vi.stubEnv("NEXT_PUBLIC_LINE_LIFF_ID", "nhfapp-liff-id");
        prismaMock.notificationOutbox.createMany.mockResolvedValue(
            asNever({ count: 1 }),
        );
        prismaMock.notificationOutbox.findFirst.mockResolvedValue(
            asNever({ id: 700 }),
        );
        prismaMock.notificationOutbox.updateMany.mockResolvedValue(
            asNever({ count: 1 }),
        );
        prismaMock.$transaction.mockImplementation((async (
            callback: (client: PrismaClient) => Promise<unknown>,
        ) => callback(prismaMock as never)) as never);
        sendAppLineNotificationMock.mockResolvedValue({ status: "SENT" });
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it.each([
        ["LEAVE_ACTION_LINE", 2, { reason: "พักผ่อน", emergencyReason: null, specialReason: null, overQuotaDays: 0 }],
        ["LEAVE_RESULT_LINE", 1, { approverName: "ผู้จัดการ ใจดี", status: "APPROVED", reason: null }],
        ["LEAVE_CANCELLED_LINE", 2, {}],
        ["LEAVE_CANCELLATION_REQUESTED_LINE", 2, { note: "มีเหตุจำเป็น" }],
        ["LEAVE_CANCELLED_AFTER_APPROVAL_LINE", 1, { decisionActorName: "ผู้จัดการ ใจดี", decisionActorRole: "USER", recoveryOverride: false }],
        ["LEAVE_NOT_TAKEN_REQUESTED_LINE", 2, { note: "ไม่ได้ใช้วันลา" }],
        ["LEAVE_NOT_TAKEN_CONFIRMED_LINE", 1, { decisionActorName: "ผู้จัดการ ใจดี", decisionActorRole: "USER", recoveryOverride: false }],
    ])("uses the intended recipient for %s", async (type, userId, details) => {
        const payload = {
            ...leaveDetails,
            employee,
            approver,
            ...details,
        } as LeaveLineEnqueueInput["payload"];
        await enqueueLeaveLineNotification({
            type: type as LeaveLineEnqueueInput["type"],
            payload,
        } as LeaveLineEnqueueInput, prismaMock);

        const rawCall: unknown =
            prismaMock.notificationOutbox.createMany.mock.calls[0]?.[0];
        if (!rawCall) {
            throw new Error("Leave LINE outbox call was not recorded");
        }
        const call = rawCall as {
                data: Array<{ eventKey: string; payload: string; type: string }>;
                skipDuplicates: boolean;
            };
        const expectedEventKey = buildLeaveLineEventKey(
            type as LeaveLineEnqueueInput["type"],
            payload.leaveId,
            userId,
        );
        expect(call).toEqual(expect.objectContaining({
            skipDuplicates: true,
            data: [expect.objectContaining({
                eventKey: expectedEventKey,
                type,
            })],
        }));
        if (!call?.data[0]) {
            throw new Error("Leave LINE outbox row was not created");
        }
        const row = call.data[0];
        const storedPayload = JSON.parse(row.payload) as { retryKey: string };
        expect(storedPayload.retryKey).toBe(createLineRetryKey(row.eventKey));
    });

    it("delivers a result to the employee through the Leave LIFF URL", async () => {
        const eventKey = buildLeaveLineEventKey("LEAVE_RESULT_LINE", "leave-1", 1);
        const payload: LeaveResultLinePayload = {
            ...leaveDetails,
            employee,
            approverName: approver.name,
            status: "APPROVED",
            reason: null,
            retryKey: createLineRetryKey(eventKey),
        };
        const result = await dispatchLeaveLineOutbox(
            buildLineNotification(payload),
            payload,
        );

        expect(result).toBe("SENT");
        expect(sendAppLineNotificationMock).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 1,
                retryKey: payload.retryKey,
                message: expect.objectContaining({ type: "flex" }),
            }),
        );
        const message = sendAppLineNotificationMock.mock.calls[0]?.[0]
            .message as { contents: { body?: { contents: unknown[] } } };
        expect(JSON.stringify(message)).toContain(
            "https://liff.line.me/nhfapp-liff-id/leave?requestId=leave-1",
        );
    });

    it("supersedes an unavailable employee without retrying forever", async () => {
        sendAppLineNotificationMock.mockResolvedValue({
            status: "SKIPPED",
            reason: "UNLINKED",
        });
        const eventKey = buildLeaveLineEventKey("LEAVE_RESULT_LINE", "leave-1", 1);
        const payload: LeaveResultLinePayload = {
            ...leaveDetails,
            employee,
            approverName: approver.name,
            status: "REJECTED",
            reason: "ติดภารกิจ",
            retryKey: createLineRetryKey(eventKey),
        };

        await expect(dispatchLeaveLineOutbox(
            buildLineNotification(payload),
            payload,
        )).resolves.toBe("SUPERSEDED");
        expect(prismaMock.notificationOutbox.updateMany).toHaveBeenCalledWith({
            where: { id: 700, status: "PROCESSING" },
            data: {
                status: "SUPERSEDED",
                lastError: "Superseded Leave LINE delivery for unavailable recipient",
            },
        });
    });

    it("keeps final-state Leave LINE result notifications deliverable", async () => {
        const cancelledEventKey = buildLeaveLineEventKey(
            "LEAVE_CANCELLED_AFTER_APPROVAL_LINE",
            leaveDetails.leaveId,
            1,
        );
        const cancelledPayload: LeaveCancelledAfterApprovalLinePayload = {
            ...leaveDetails,
            employee,
            decisionActorName: approver.name,
            decisionActorRole: "USER",
            recoveryOverride: false,
            retryKey: createLineRetryKey(cancelledEventKey),
        };
        const cancelledNotification: NotificationOutbox = {
            ...buildLineNotification({
                ...leaveDetails,
                employee,
                approverName: approver.name,
                status: "APPROVED",
                reason: null,
                retryKey: createLineRetryKey(
                    buildLeaveLineEventKey("LEAVE_RESULT_LINE", leaveDetails.leaveId, 1),
                ),
            }),
            type: "LEAVE_CANCELLED_AFTER_APPROVAL_LINE",
            eventKey: cancelledEventKey,
            payload: JSON.stringify(cancelledPayload),
        };

        await expect(dispatchLeaveLineOutbox(
            cancelledNotification,
            cancelledPayload,
        )).resolves.toBe("SENT");

        vi.clearAllMocks();
        const notTakenEventKey = buildLeaveLineEventKey(
            "LEAVE_NOT_TAKEN_CONFIRMED_LINE",
            leaveDetails.leaveId,
            1,
        );
        const notTakenPayload: LeaveNotTakenConfirmedLinePayload = {
            ...leaveDetails,
            employee,
            decisionActorName: approver.name,
            decisionActorRole: "USER",
            recoveryOverride: false,
            retryKey: createLineRetryKey(notTakenEventKey),
        };
        const notTakenNotification: NotificationOutbox = {
            ...cancelledNotification,
            type: "LEAVE_NOT_TAKEN_CONFIRMED_LINE",
            eventKey: notTakenEventKey,
            payload: JSON.stringify(notTakenPayload),
        };

        await expect(dispatchLeaveLineOutbox(
            notTakenNotification,
            notTakenPayload,
        )).resolves.toBe("SENT");
        expect(sendAppLineNotificationMock).toHaveBeenCalledTimes(1);
    });

    function buildLeaveActionPayload(
        userId: number,
        deliveryIdentity: string,
        employeeId = approver.employeeId,
    ): LeaveActionLinePayload {
        const eventKey = buildLeaveLineEventKey(
            "LEAVE_ACTION_LINE",
            leaveDetails.leaveId,
            userId,
            deliveryIdentity,
        );
        return {
            ...leaveDetails,
            employee,
            approver: { ...approver, employeeId, userId },
            deliveryIdentity,
            reason: "พักผ่อน",
            emergencyReason: null,
            specialReason: null,
            overQuotaDays: 0,
            retryKey: createLineRetryKey(eventKey),
        };
    }

    function buildAssignmentDeliveryIdentity(
        userId: number,
        generation: number,
    ): string {
        return buildLeaveActionDeliveryIdentity(
            leaveDetails.leaveId,
            userId,
            generation,
        );
    }

    function buildCancellationPayload(
        overrides: Partial<LeaveCancellationRequestedLinePayload> = {},
    ): LeaveCancellationRequestedLinePayload {
        const payload = {
            ...leaveDetails,
            employee,
            approver,
            note: "มีเหตุจำเป็น",
            ...overrides,
        };
        const eventKey = buildLeaveLineEventKey(
            "LEAVE_CANCELLATION_REQUESTED_LINE",
            payload.leaveId,
            payload.approver.userId,
        );
        return { ...payload, retryKey: createLineRetryKey(eventKey) };
    }

    function buildNotTakenPayload(
        overrides: Partial<LeaveNotTakenRequestedLinePayload> = {},
    ): LeaveNotTakenRequestedLinePayload {
        const payload = {
            ...leaveDetails,
            employee,
            approver,
            note: "ไม่ได้ใช้วันลา",
            ...overrides,
        };
        const eventKey = buildLeaveLineEventKey(
            "LEAVE_NOT_TAKEN_REQUESTED_LINE",
            payload.leaveId,
            payload.approver.userId,
        );
        return { ...payload, retryKey: createLineRetryKey(eventKey) };
    }

    it("uses persisted assignment generations to deduplicate retries and allow A-B-A", async () => {
        const originalApprover = buildCurrentApproverRecord(20, 2);
        const unavailableOriginalApprover = {
            ...originalApprover,
            status: "INACTIVE" as const,
            user: null,
        };
        const recoveryApprover = buildCurrentApproverRecord(30, 3);
        const state = {
            approverId: originalApprover.id,
            exceptionApproverId: null as number | null,
            approvalActionVersion: 1,
        };
        const firstAIdentity = buildLeaveActionDeliveryIdentity(
            leaveDetails.leaveId,
            originalApprover.user.id,
            state.approvalActionVersion,
        );

        vi.mocked(prismaMock.employee.findUnique).mockResolvedValue({
            manager: recoveryApprover,
        } as never);
        vi.mocked(prismaMock.leaveRequest.findUnique).mockImplementation((async () => ({
            approverId: state.approverId,
            exceptionApproverId: state.exceptionApproverId,
        }) as never) as never);
        vi.mocked(prismaMock.leaveRequest.update).mockImplementation((async (args: { data: unknown }) => {
            const data = args.data as {
                exceptionApproverId?: number | null;
                approvalActionVersion?: { increment: number };
            };
            state.exceptionApproverId = data.exceptionApproverId ?? null;
            if (data.approvalActionVersion?.increment) {
                state.approvalActionVersion += data.approvalActionVersion.increment;
            }
            return state as never;
        }) as never);

        const firstResolution = await resolveLeaveExceptionApprover(
            prismaMock as unknown as Prisma.TransactionClient,
            {
                employeeId: employee.employeeId,
                originalApprover: unavailableOriginalApprover,
                existingApprover: null,
                reuseExisting: false,
            },
        );
        if (!firstResolution) throw new Error("Expected recovery approver");
        await persistLeaveExceptionApprover(
            prismaMock as unknown as Prisma.TransactionClient,
            leaveDetails.leaveId,
            firstResolution,
        );
        const bIdentity = buildLeaveActionDeliveryIdentity(
            leaveDetails.leaveId,
            recoveryApprover.user.id,
            state.approvalActionVersion,
        );

        const secondResolution = await resolveLeaveExceptionApprover(
            prismaMock as unknown as Prisma.TransactionClient,
            {
                employeeId: employee.employeeId,
                originalApprover,
                existingApprover: recoveryApprover,
                reuseExisting: false,
            },
        );
        if (!secondResolution) throw new Error("Expected original approver");
        await persistLeaveExceptionApprover(
            prismaMock as unknown as Prisma.TransactionClient,
            leaveDetails.leaveId,
            secondResolution,
        );
        const secondAIdentity = buildLeaveActionDeliveryIdentity(
            leaveDetails.leaveId,
            originalApprover.user.id,
            state.approvalActionVersion,
        );
        expect(state.approvalActionVersion).toBe(3);

        const rows: Array<{ eventKey: string; payload: string }> = [];
        vi.mocked(prismaMock.notificationOutbox.createMany).mockImplementation((async (args: { data: unknown }) => {
            const data = args.data as Array<{ eventKey: string; payload: string }>;
            for (const row of data) {
                if (!rows.some((existing) => existing.eventKey === row.eventKey)) {
                    rows.push(row);
                }
            }
            return { count: data.length } as never;
        }) as never);
        const deliveries = [
            buildLeaveActionPayload(2, firstAIdentity),
            buildLeaveActionPayload(3, bIdentity, recoveryApprover.id),
            buildLeaveActionPayload(2, secondAIdentity),
        ];

        for (const payload of deliveries) {
            await enqueueLeaveLineNotification({
                type: "LEAVE_ACTION_LINE",
                payload,
            }, prismaMock);
        }

        const firstA = rows[0];
        const b = rows[1];
        const secondA = rows[2];
        if (!firstA || !b || !secondA) {
            throw new Error("Leave action LINE rows were not recorded");
        }

        expect(firstA.eventKey).not.toBe(secondA.eventKey);
        expect(firstA.eventKey).not.toBe(b.eventKey);
        expect(b.eventKey).not.toBe(secondA.eventKey);
        expect(JSON.parse(firstA.payload)).toEqual(expect.objectContaining({
            deliveryIdentity: firstAIdentity,
            retryKey: createLineRetryKey(firstA.eventKey),
        }));
        expect(JSON.parse(secondA.payload)).toEqual(expect.objectContaining({
            deliveryIdentity: secondAIdentity,
            retryKey: createLineRetryKey(secondA.eventKey),
        }));

        await enqueueLeaveLineNotification({
            type: "LEAVE_ACTION_LINE",
            payload: deliveries[0],
        }, prismaMock);

        expect(rows).toHaveLength(3);
        const retryArgs = prismaMock.notificationOutbox.createMany.mock.calls[3]?.[0] as {
            data: Array<{ eventKey: string }>;
            skipDuplicates: boolean;
        };
        expect(retryArgs.data[0]?.eventKey).toBe(firstA.eventKey);
        expect(retryArgs.skipDuplicates).toBe(true);
    });

    it("supersedes a Leave LINE row with a mismatched deterministic retry key", async () => {
        const payload = buildLeaveActionPayload(
            2,
            buildLeaveActionDeliveryIdentity("leave-1", 2, 1),
        );
        const mismatchedPayload = {
            ...payload,
            retryKey: createLineRetryKey("different-event"),
        };
        const notification = buildProcessingNotification(
            "LEAVE_ACTION_LINE",
            mismatchedPayload,
        );

        await expect(dispatchLeaveLineOutbox(
            notification,
            mismatchedPayload,
        )).resolves.toBe("SUPERSEDED");
        expect(sendAppLineNotificationMock).not.toHaveBeenCalled();
        expect(prismaMock.notificationOutbox.updateMany).toHaveBeenCalledWith({
            where: { id: 700, status: "PROCESSING" },
            data: {
                status: "SUPERSEDED",
                lastError: "Superseded mismatched Leave LINE retry key",
            },
        });
    });

    function buildCurrentApproverRecord(
        employeeId = 20,
        userId = 2,
    ) {
        return {
            id: employeeId,
            firstName: "ผู้จัดการ",
            lastName: "ใจดี",
            nickname: null,
            email: "manager@example.com",
            status: "ACTIVE" as const,
            deletedAt: null,
            user: {
                id: userId,
                email: "manager@example.com",
                isActive: true,
                deletedAt: null,
            },
        };
    }

    function configureCurrentLeaveRequest(
        overrides: Record<string, unknown> = {},
    ): void {
        prismaMock.leaveRequest.findUnique.mockResolvedValue(asNever({
            id: "leave-1",
            status: "PENDING",
            startDate: new Date("2026-12-01T00:00:00.000Z"),
            notTakenRequestedAt: null,
            notTakenConfirmedAt: null,
            cancellationRequestedAt: null,
            cancellationConfirmedAt: null,
            approverId: 20,
            exceptionApproverId: null,
            approvalActionVersion: 1,
            approver: buildCurrentApproverRecord(),
            exceptionApprover: null,
            ...overrides,
        }));
    }

    function buildProcessingNotification(
        type: "LEAVE_ACTION_LINE"
            | "LEAVE_CANCELLATION_REQUESTED_LINE"
            | "LEAVE_NOT_TAKEN_REQUESTED_LINE",
        payload: LeaveActionLinePayload
            | LeaveCancellationRequestedLinePayload
            | LeaveNotTakenRequestedLinePayload,
    ): NotificationOutbox {
        const deliveryIdentity = type === "LEAVE_ACTION_LINE"
            ? (payload as LeaveActionLinePayload).deliveryIdentity
            : undefined;
        return {
            id: 700,
            type,
            eventKey: buildLeaveLineEventKey(
                type,
                payload.leaveId,
                payload.approver.userId,
                deliveryIdentity,
            ),
            payload: JSON.stringify(payload),
            status: "PROCESSING",
            attempts: 0,
            nextAttemptAt: new Date(),
            lastError: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
    }

    it("supersedes stale normal approval LINE without calling the provider", async () => {
        const payload = buildLeaveActionPayload(
            2,
            buildLeaveActionDeliveryIdentity("leave-1", 2, 1),
        );
        configureCurrentLeaveRequest({ status: "APPROVED" });

        await expect(dispatchLeaveLineOutbox(
            buildProcessingNotification("LEAVE_ACTION_LINE", payload),
            payload,
        )).resolves.toBe("SUPERSEDED");
        expect(sendAppLineNotificationMock).not.toHaveBeenCalled();
    });

    it("supersedes a resolved cancellation request LINE without calling the provider", async () => {
        const payload = buildCancellationPayload();
        configureCurrentLeaveRequest({
            status: "APPROVED",
            cancellationRequestedAt: new Date("2026-08-01T00:00:00.000Z"),
        });

        await expect(dispatchLeaveLineOutbox(
            buildProcessingNotification("LEAVE_CANCELLATION_REQUESTED_LINE", payload),
            payload,
        )).resolves.toBe("SUPERSEDED");
        expect(sendAppLineNotificationMock).not.toHaveBeenCalled();
    });

    it("supersedes a resolved not-taken request LINE without calling the provider", async () => {
        const payload = buildNotTakenPayload();
        configureCurrentLeaveRequest({
            status: "APPROVED",
            notTakenRequestedAt: new Date("2026-08-01T00:00:00.000Z"),
            notTakenConfirmedAt: new Date("2026-08-02T00:00:00.000Z"),
        });

        await expect(dispatchLeaveLineOutbox(
            buildProcessingNotification("LEAVE_NOT_TAKEN_REQUESTED_LINE", payload),
            payload,
        )).resolves.toBe("SUPERSEDED");
        expect(sendAppLineNotificationMock).not.toHaveBeenCalled();
    });

    it.each([
        ["LEAVE_CANCELLATION_REQUESTED_LINE", buildCancellationPayload],
        ["LEAVE_NOT_TAKEN_REQUESTED_LINE", buildNotTakenPayload],
    ])("supersedes %s when the current approver changed", async (type, buildPayload) => {
        const payload = buildPayload();
        const actionableType = type as
            | "LEAVE_CANCELLATION_REQUESTED_LINE"
            | "LEAVE_NOT_TAKEN_REQUESTED_LINE";
        configureCurrentLeaveRequest({
            status: actionableType === "LEAVE_CANCELLATION_REQUESTED_LINE"
                ? "CANCELLATION_REQUESTED"
                : "APPROVED",
            cancellationRequestedAt: actionableType === "LEAVE_CANCELLATION_REQUESTED_LINE"
                ? new Date("2026-08-01T00:00:00.000Z")
                : null,
            notTakenRequestedAt: actionableType === "LEAVE_NOT_TAKEN_REQUESTED_LINE"
                ? new Date("2026-08-01T00:00:00.000Z")
                : null,
            approverId: 30,
            approver: buildCurrentApproverRecord(30, 3),
        });

        await expect(dispatchLeaveLineOutbox(
            buildProcessingNotification(actionableType, payload),
            payload,
        )).resolves.toBe("SUPERSEDED");
        expect(sendAppLineNotificationMock).not.toHaveBeenCalled();
    });

    it("sends a current approval action LINE", async () => {
        const payload = buildLeaveActionPayload(
            2,
            buildLeaveActionDeliveryIdentity("leave-1", 2, 1),
        );
        configureCurrentLeaveRequest({ status: "PENDING" });

        await expect(dispatchLeaveLineOutbox(
            buildProcessingNotification("LEAVE_ACTION_LINE", payload),
            payload,
        )).resolves.toBe("SENT");
        expect(sendAppLineNotificationMock).toHaveBeenCalledWith(expect.objectContaining({
            userId: 2,
            retryKey: payload.retryKey,
        }));
        expect(JSON.stringify(sendAppLineNotificationMock.mock.calls[0]?.[0])).toContain(
            "action=approve",
        );
    });

    it("supersedes the first A generation after production state returns to A", async () => {
        const firstAIdentity = buildAssignmentDeliveryIdentity(2, 1);
        const currentAIdentity = buildAssignmentDeliveryIdentity(2, 3);
        const payload = buildLeaveActionPayload(2, firstAIdentity);
        configureCurrentLeaveRequest({
            approvalActionVersion: 3,
            status: "PENDING",
            approverId: 20,
            exceptionApproverId: null,
        });

        await expect(dispatchLeaveLineOutbox(
            buildProcessingNotification("LEAVE_ACTION_LINE", payload),
            payload,
        )).resolves.toBe("SUPERSEDED");
        expect(firstAIdentity).not.toBe(currentAIdentity);
        expect(sendAppLineNotificationMock).not.toHaveBeenCalled();
    });

    it("sends the current A generation with its canonical event and retry keys", async () => {
        const currentAIdentity = buildAssignmentDeliveryIdentity(2, 3);
        const payload = buildLeaveActionPayload(2, currentAIdentity);
        configureCurrentLeaveRequest({
            approvalActionVersion: 3,
            status: "PENDING",
            approverId: 20,
            exceptionApproverId: null,
        });

        const notification = buildProcessingNotification("LEAVE_ACTION_LINE", payload);
        await expect(dispatchLeaveLineOutbox(
            notification,
            payload,
        )).resolves.toBe("SENT");
        const eventKey = notification.eventKey;
        if (!eventKey) throw new Error("Expected canonical Leave LINE event key");
        expect(eventKey).toBe(
            buildLeaveLineEventKey("LEAVE_ACTION_LINE", "leave-1", 2, currentAIdentity),
        );
        expect(payload.retryKey).toBe(createLineRetryKey(eventKey));
        expect(sendAppLineNotificationMock).toHaveBeenCalledWith(expect.objectContaining({
            userId: 2,
            retryKey: payload.retryKey,
        }));
    });

    it("accepts a legacy action identity only for the initial current assignment", async () => {
        const legacyIdentity = buildLegacyLeaveActionDeliveryIdentity("leave-1", 2);
        const payload = buildLeaveActionPayload(2, legacyIdentity);
        configureCurrentLeaveRequest({
            approvalActionVersion: 1,
            status: "PENDING",
            approverId: 20,
            exceptionApproverId: null,
        });

        await expect(dispatchLeaveLineOutbox(
            buildProcessingNotification("LEAVE_ACTION_LINE", payload),
            payload,
        )).resolves.toBe("SENT");
        expect(sendAppLineNotificationMock).toHaveBeenCalledWith(expect.objectContaining({
            userId: 2,
            retryKey: payload.retryKey,
        }));
    });

    it("supersedes a legacy action identity after the persisted generation advances", async () => {
        const legacyIdentity = buildLegacyLeaveActionDeliveryIdentity("leave-1", 2);
        const payload = buildLeaveActionPayload(2, legacyIdentity);
        configureCurrentLeaveRequest({
            approvalActionVersion: 3,
            status: "PENDING",
            approverId: 20,
            exceptionApproverId: null,
        });

        await expect(dispatchLeaveLineOutbox(
            buildProcessingNotification("LEAVE_ACTION_LINE", payload),
            payload,
        )).resolves.toBe("SUPERSEDED");
        expect(sendAppLineNotificationMock).not.toHaveBeenCalled();
    });

    it("uses the exception approver as the current Leave action recipient", async () => {
        const bIdentity = buildAssignmentDeliveryIdentity(3, 2);
        const payload = buildLeaveActionPayload(3, bIdentity, 30);
        configureCurrentLeaveRequest({
            approvalActionVersion: 2,
            status: "PENDING",
            approverId: 20,
            exceptionApproverId: 30,
            exceptionApprover: buildCurrentApproverRecord(30, 3),
        });

        await expect(dispatchLeaveLineOutbox(
            buildProcessingNotification("LEAVE_ACTION_LINE", payload),
            payload,
        )).resolves.toBe("SENT");
        expect(sendAppLineNotificationMock).toHaveBeenCalledWith(expect.objectContaining({
            userId: 3,
            retryKey: payload.retryKey,
        }));
    });

    it("sends current cancellation and not-taken action LINE notifications", async () => {
        const cancellationPayload = buildCancellationPayload();
        configureCurrentLeaveRequest({
            status: "CANCELLATION_REQUESTED",
            cancellationRequestedAt: new Date("2026-08-01T00:00:00.000Z"),
        });
        await expect(dispatchLeaveLineOutbox(
            buildProcessingNotification(
                "LEAVE_CANCELLATION_REQUESTED_LINE",
                cancellationPayload,
            ),
            cancellationPayload,
        )).resolves.toBe("SENT");
        expect(JSON.stringify(sendAppLineNotificationMock.mock.calls[0]?.[0])).toContain(
            "action=review",
        );

        vi.clearAllMocks();
        const notTakenPayload = buildNotTakenPayload();
        configureCurrentLeaveRequest({
            status: "APPROVED",
            notTakenRequestedAt: new Date("2026-08-01T00:00:00.000Z"),
        });
        await expect(dispatchLeaveLineOutbox(
            buildProcessingNotification("LEAVE_NOT_TAKEN_REQUESTED_LINE", notTakenPayload),
            notTakenPayload,
        )).resolves.toBe("SENT");
        expect(JSON.stringify(sendAppLineNotificationMock.mock.calls[0]?.[0])).toContain(
            "action=not-taken",
        );
    });
});
