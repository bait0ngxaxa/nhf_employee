import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
    NotificationOutbox,
    PrismaClient,
} from "@prisma/client";
import { mockDeep, mockReset } from "vitest-mock-extended";

import { prisma } from "@/lib/db/prisma";
import {
    buildLeaveLineEventKey,
    dispatchLeaveLineOutbox,
    enqueueLeaveLineNotification,
    type LeaveLineEnqueueInput,
} from "@/lib/services/leave/line-notifications";
import { createLineRetryKey } from "@/lib/services/outbox/provider-key";
import type {
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
        expect(call).toEqual(expect.objectContaining({
            skipDuplicates: true,
            data: [expect.objectContaining({
                eventKey: expect.stringContaining(`:user:${userId}`),
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
});
