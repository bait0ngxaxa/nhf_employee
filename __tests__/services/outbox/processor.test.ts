import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
    NotificationOutbox,
    NotificationOutboxType,
    Prisma,
    PrismaClient,
} from "@prisma/client";
import { mockDeep, mockReset } from "vitest-mock-extended";
import { sendEmail } from "@/lib/email/transport";
import { lineNotificationService, sendStockLineBroadcast } from "@/lib/line";
import { prisma } from "@/lib/db/prisma";
import {
    dispatchNotification,
    processOutbox,
} from "@/lib/services/outbox/processor";
import { createOutboxLineRetryKey } from "@/lib/services/outbox/provider-key";
import { EMAIL_REQUEST_INAPP_RECIPIENTS_ENV } from "@/lib/services/email-request/notifications";
import {
    dispatchCurrentLeaveAction,
    sendLeaveCancellationRequestedNotifications,
    sendLeaveCancelledAfterApprovalNotifications,
    sendLeaveCancelledNotifications,
    sendLeaveNotTakenConfirmedNotifications,
    sendLeaveNotTakenRequestedNotifications,
} from "@/modules/leave";
import type { StockRequestResultEmailPayload } from "@/modules/stock";
import {
    MAX_OUTBOX_ATTEMPTS,
    OUTBOX_RETRY_BASE_DELAY_MS,
    STALE_OUTBOX_PROCESSING_MINUTES,
} from "@/lib/services/outbox/types";

const leaveNotificationMocks = vi.hoisted(() => ({
    createLeaveActionInAppNotification: vi.fn(),
    dispatchCurrentLeaveAction: vi.fn(),
    sendLeaveCancellationRequestedNotifications: vi.fn(),
    sendLeaveCancelledAfterApprovalNotifications: vi.fn(),
    sendLeaveResultNotifications: vi.fn(),
    sendLeaveCancelledNotifications: vi.fn(),
    sendLeaveNotTakenRequestedNotifications: vi.fn(),
    sendLeaveNotTakenConfirmedNotifications: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
    prisma: mockDeep<PrismaClient>(),
}));

const sendEmailMock = vi.hoisted(() => vi.fn());
const sendStockLineBroadcastMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/email/transport", () => ({
    sendEmail: sendEmailMock,
}));

vi.mock("@/modules/leave", async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...(actual as Record<string, unknown>),
        ...leaveNotificationMocks,
    };
});

vi.mock("@/lib/line", () => ({
    lineNotificationService: {
        sendEmailRequestNotification: vi.fn(),
    },
    sendStockLineBroadcast: sendStockLineBroadcastMock,
}));

const prismaMock = prisma as unknown as ReturnType<
    typeof mockDeep<PrismaClient>
>;

const originalEmailRequestInAppRecipients =
    process.env[EMAIL_REQUEST_INAPP_RECIPIENTS_ENV];

function restoreEmailRequestInAppRecipients(): void {
    if (originalEmailRequestInAppRecipients === undefined) {
        delete process.env[EMAIL_REQUEST_INAPP_RECIPIENTS_ENV];
        return;
    }

    process.env[EMAIL_REQUEST_INAPP_RECIPIENTS_ENV] =
        originalEmailRequestInAppRecipients;
}

function buildNotification(
    id: number,
    type: NotificationOutboxType,
    payload: string,
    eventKey: string | null = null,
): NotificationOutbox {
    return {
        id,
        type,
        eventKey,
        payload,
        status: "PENDING",
        attempts: 0,
        nextAttemptAt: new Date(),
        lastError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
}

function asNever<T>(value: T): never {
    return value as unknown as never;
}

function buildLeavePayload() {
    return {
        leaveId: "leave-1",
        employee: {
            employeeId: 10,
            userId: 1,
            email: "employee@example.com",
            name: "Employee User",
        },
        approver: {
            employeeId: 20,
            userId: 2,
            email: "manager@example.com",
            name: "Manager User",
        },
        approverName: "Manager User",
        decisionActorName: "Manager User",
        decisionActorRole: "USER",
        recoveryOverride: false,
        leaveType: "SICK",
        startDate: "2026-07-01T00:00:00.000Z",
        endDate: "2026-07-01T00:00:00.000Z",
        period: "FULL_DAY",
        durationDays: 1,
        reason: "ลาป่วย",
        emergencyReason: null,
        specialReason: null,
        overQuotaDays: 0,
        note: "ไม่ได้ลาเพราะมีงานด่วน",
    };
}

function buildStockRequestResultPayload(
    status: StockRequestResultEmailPayload["status"],
): StockRequestResultEmailPayload {
    return {
        schemaVersion: 1,
        requestId: 77,
        status,
        projectCode: "PRJ-2569/01",
        recipient: {
            userId: 3,
            name: "สมชาย",
            email: "somchai@example.com",
        },
        items: [{
            name: "กระดาษ",
            quantity: 2,
            unit: "รีม",
            variantLabel: "ขนาด: A4",
        }],
        cancelReason: status === "CANCELLED" ? "มีวัสดุทดแทนแล้ว" : null,
        actedAt: "2026-07-01T03:00:00.000Z",
    };
}

describe("processOutbox", () => {
    beforeEach(() => {
        delete process.env[EMAIL_REQUEST_INAPP_RECIPIENTS_ENV];
        mockReset(prismaMock);
        vi.clearAllMocks();
        prismaMock.user.findMany.mockResolvedValue(asNever([]));
        prismaMock.notificationOutbox.updateMany.mockResolvedValue(
            asNever({ count: 1 }),
        );
        prismaMock.notificationOutbox.findFirst.mockResolvedValue(
            asNever({ id: 1 }),
        );
        vi.mocked(dispatchCurrentLeaveAction).mockResolvedValue("SENT");
        prismaMock.$queryRaw.mockResolvedValue(asNever([]));
        prismaMock.$transaction.mockImplementation((async (
            callback: (tx: typeof prismaMock) => Promise<unknown>,
        ) => callback(prismaMock)) as never);
    });

    afterEach(() => {
        restoreEmailRequestInAppRecipients();
    });

    it("returns early when no pending notifications", async () => {
        prismaMock.notificationOutbox.findMany.mockResolvedValue(asNever([]));

        const result = await processOutbox();

        expect(result).toEqual({ processed: 0, failed: 0 });
        expect(prismaMock.notificationOutbox.updateMany).not.toHaveBeenCalled();
    });

    it("processes EMAIL_REQUEST successfully", async () => {
        vi.mocked(
            lineNotificationService.sendEmailRequestNotification,
        ).mockResolvedValue(true);
        prismaMock.notificationOutbox.findMany.mockResolvedValue(
            asNever([
                buildNotification(
                    102,
                    "EMAIL_REQUEST",
                    JSON.stringify({
                        thaiName: "Test",
                        englishName: "Test",
                        phone: "123",
                        position: "IT",
                        department: "IT",
                        replyEmail: "test@nhf.or.th",
                        requestedAt: new Date().toISOString(),
                    }),
                ),
            ]),
        );

        const result = await processOutbox();

        expect(result).toEqual({ processed: 1, failed: 0 });
        expect(
            lineNotificationService.sendEmailRequestNotification,
        ).toHaveBeenCalledTimes(1);
        expect(
            lineNotificationService.sendEmailRequestNotification,
        ).toHaveBeenCalledWith(
            expect.objectContaining({
                needsDocumentSystem: false,
                sharedDriveAccess: [],
            }),
            createOutboxLineRetryKey("EMAIL_REQUEST", 102),
        );
    });

    it("characterizes crash-after-IT-LINE acceptance with the same retry key", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-07-13T03:00:00.000Z"));
        vi.mocked(
            lineNotificationService.sendEmailRequestNotification,
        ).mockResolvedValue(true);
        const payload = JSON.stringify({
            thaiName: "Test",
            englishName: "Test",
            phone: "123",
            position: "IT",
            department: "IT",
            replyEmail: "test@nhf.or.th",
            requestedAt: "2026-07-01T03:00:00.000Z",
        });
        const notification = buildNotification(
            150,
            "EMAIL_REQUEST",
            payload,
            "email-request:150:created",
        );
        const retryNotification = {
            ...notification,
            status: "FAILED" as const,
            attempts: 1,
            nextAttemptAt: new Date("2026-07-13T02:59:00.000Z"),
            updatedAt: new Date("2026-07-13T02:50:00.000Z"),
        };

        try {
            await expect(dispatchNotification({
                ...notification,
                status: "PROCESSING",
            })).resolves.toBe("SENT");

            // The first call was accepted, but the worker lost the final SENT update.
            prismaMock.notificationOutbox.findMany
                .mockResolvedValueOnce(asNever([notification]))
                .mockResolvedValueOnce(asNever([retryNotification]));

            const result = await processOutbox();

            expect(result).toEqual({ processed: 1, failed: 0 });
            expect(
                lineNotificationService.sendEmailRequestNotification,
            ).toHaveBeenCalledTimes(2);
            expect(
                vi.mocked(lineNotificationService.sendEmailRequestNotification)
                    .mock.calls[0]?.[1],
            ).toBe(
                vi.mocked(lineNotificationService.sendEmailRequestNotification)
                    .mock.calls[1]?.[1],
            );
            expect(
                vi.mocked(lineNotificationService.sendEmailRequestNotification)
                    .mock.calls[0]?.[1],
            ).toBe(createOutboxLineRetryKey(
                "EMAIL_REQUEST",
                150,
                "email-request:150:created",
            ));
            expect(prismaMock.notificationOutbox.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 150, status: "PROCESSING" },
                    data: { status: "SENT", lastError: null },
                }),
            );
        } finally {
            vi.useRealTimers();
        }
    });

    it("characterizes crash-after-Stock-broadcast acceptance with a row retry key", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-07-13T03:00:00.000Z"));
        vi.mocked(sendStockLineBroadcast).mockResolvedValue(true);
        const payload = JSON.stringify({
            alertedAt: "2026-07-01T03:00:00.000Z",
            itemCount: 1,
            items: [{
                itemId: 10,
                name: "ปากกา",
                sku: "PEN-001",
                quantity: 3,
                minStock: 5,
                unit: "ด้าม",
            }],
        });
        const notification = buildNotification(151, "STOCK_LOW_LINE", payload);
        const retryNotification = {
            ...notification,
            status: "FAILED" as const,
            attempts: 1,
            nextAttemptAt: new Date("2026-07-13T02:59:00.000Z"),
            updatedAt: new Date("2026-07-13T02:50:00.000Z"),
        };

        try {
            await expect(dispatchNotification({
                ...notification,
                status: "PROCESSING",
            })).resolves.toBe("SENT");
            prismaMock.notificationOutbox.findMany
                .mockResolvedValueOnce(asNever([notification]))
                .mockResolvedValueOnce(asNever([retryNotification]));

            await expect(processOutbox()).resolves.toEqual({
                processed: 1,
                failed: 0,
            });

            expect(sendStockLineBroadcast).toHaveBeenCalledTimes(2);
            expect(vi.mocked(sendStockLineBroadcast).mock.calls[0]?.[1]).toBe(
                vi.mocked(sendStockLineBroadcast).mock.calls[1]?.[1],
            );
            expect(vi.mocked(sendStockLineBroadcast).mock.calls[0]?.[1]).toBe(
                createOutboxLineRetryKey("STOCK_LOW_LINE", 151),
            );
        } finally {
            vi.useRealTimers();
        }
    });

    it("characterizes crash-after-SMTP-acceptance with repeated Message-ID ambiguity", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-07-13T03:00:00.000Z"));
        vi.mocked(sendEmail).mockResolvedValue(true);
        const payload = buildStockRequestResultPayload("ISSUED");
        const notification = {
            ...buildNotification(
                152,
                "STOCK_REQUEST_RESULT_EMAIL",
                JSON.stringify(payload),
                "stock-request:77:ISSUED:email",
            ),
            status: "PROCESSING" as const,
            updatedAt: new Date("2026-07-13T02:50:00.000Z"),
        };
        const retryNotification = {
            ...notification,
            status: "FAILED" as const,
            attempts: 1,
            nextAttemptAt: new Date("2026-07-13T02:59:00.000Z"),
        };

        try {
            await expect(dispatchNotification(notification)).resolves.toBe("SENT");

            // The SMTP provider call was accepted, but the worker lost the final SENT update.
            prismaMock.notificationOutbox.findMany
                .mockResolvedValueOnce(asNever([notification]))
                .mockResolvedValueOnce(asNever([retryNotification]));

            await expect(processOutbox()).resolves.toEqual({
                processed: 1,
                failed: 0,
            });

            expect(sendEmail).toHaveBeenCalledTimes(2);
            expect(vi.mocked(sendEmail).mock.calls[0]?.[0].messageId).toBe(
                vi.mocked(sendEmail).mock.calls[1]?.[0].messageId,
            );
            expect(vi.mocked(sendEmail).mock.calls[0]?.[0].messageId).toBe(
                "<nhf-stock-request-77-issued@notifications.thainhf.org>",
            );
            expect(prismaMock.notificationOutbox.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 152, status: "PROCESSING" },
                    data: { status: "SENT", lastError: null },
                }),
            );
        } finally {
            vi.useRealTimers();
        }
    });

    it("creates email request in-app notification only for configured recipients before failed LINE delivery", async () => {
        process.env[EMAIL_REQUEST_INAPP_RECIPIENTS_ENV] =
            "it-admin@example.com,helpdesk@example.com";
        vi.mocked(
            lineNotificationService.sendEmailRequestNotification,
        ).mockResolvedValue(false);
        prismaMock.user.findMany.mockResolvedValue(asNever([{ id: 10 }, { id: 11 }]));
        prismaMock.notification.create.mockResolvedValue(asNever({ id: "n-1" }));
        prismaMock.notificationOutbox.findMany.mockResolvedValue(
            asNever([
                buildNotification(
                    112,
                    "EMAIL_REQUEST",
                    JSON.stringify({
                        thaiName: "สมชาย ใจดี",
                        englishName: "Somchai Jaidee",
                        phone: "123",
                        position: "IT Officer",
                        department: "IT",
                        replyEmail: "somchai@nhf.or.th",
                        requestedAt: "2026-07-01T03:00:00.000Z",
                    }),
                ),
            ]),
        );

        const result = await processOutbox();

        expect(result).toEqual({ processed: 0, failed: 1 });
        expect(prismaMock.user.findMany).toHaveBeenCalledWith({
            where: {
                email: {
                    in: ["it-admin@example.com", "helpdesk@example.com"],
                },
                isActive: true,
                deletedAt: null,
            },
            select: { id: true },
        });
        expect(prismaMock.user.findMany).not.toHaveBeenCalledWith(
            expect.objectContaining({ where: { role: "ADMIN" } }),
        );
        expect(prismaMock.notification.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                userId: 10,
                type: "SYSTEM_ALERT",
                title: "มีคำขออีเมลพนักงานใหม่",
                referenceId: "somchai@nhf.or.th",
            }),
        });
        expect(prismaMock.notification.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                userId: 11,
                type: "SYSTEM_ALERT",
                title: "มีคำขออีเมลพนักงานใหม่",
                referenceId: "somchai@nhf.or.th",
            }),
        });
        expect(prismaMock.notificationOutbox.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 112, status: "PROCESSING" },
                data: expect.objectContaining({
                    status: "FAILED",
                    lastError: "LINE email request notification failed",
                }),
            }),
        );

        const inAppOrder = prismaMock.notification.create.mock.invocationCallOrder[0];
        const lineOrder =
            vi.mocked(lineNotificationService.sendEmailRequestNotification).mock
                .invocationCallOrder[0];
        expect(inAppOrder).toBeLessThan(lineOrder);
    });

    it("marks EMAIL_REQUEST failed for invalid shared drive payload", async () => {
        prismaMock.notificationOutbox.findMany.mockResolvedValue(
            asNever([
                buildNotification(
                    104,
                    "EMAIL_REQUEST",
                    JSON.stringify({
                        thaiName: "Test",
                        englishName: "Test",
                        phone: "123",
                        position: "IT",
                        department: "IT",
                        replyEmail: "test@nhf.or.th",
                        sharedDriveAccess: ["unknown_drive"],
                        requestedAt: new Date().toISOString(),
                    }),
                ),
            ]),
        );

        const result = await processOutbox();

        expect(result).toEqual({ processed: 0, failed: 1 });
        expect(
            lineNotificationService.sendEmailRequestNotification,
        ).not.toHaveBeenCalled();
        expect(prismaMock.notificationOutbox.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 104, status: "PROCESSING" },
                data: expect.objectContaining({
                    status: "FAILED",
                    lastError: "Invalid EMAIL_REQUEST sharedDriveAccess payload",
                }),
            }),
        );
    });

    it("marks notification FAILED when dispatch throws", async () => {
        prismaMock.notificationOutbox.findMany.mockResolvedValue(
            asNever([
                buildNotification(
                    103,
                    "LEAVE_CANCELLED",
                    JSON.stringify(buildLeavePayload()),
                ),
            ]),
        );
        vi.mocked(sendLeaveCancelledNotifications).mockRejectedValueOnce(
            new Error("Network failure"),
        );

        const result = await processOutbox();

        expect(result).toEqual({ processed: 0, failed: 1 });
        expect(prismaMock.notificationOutbox.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 103, status: "PROCESSING" },
                data: expect.objectContaining({
                    status: "FAILED",
                    lastError: "Network failure",
                }),
            }),
        );
    });

    it("processes LEAVE_CANCELLED successfully", async () => {
        prismaMock.notificationOutbox.findMany.mockResolvedValue(
            asNever([
                buildNotification(
                    107,
                    "LEAVE_CANCELLED",
                    JSON.stringify(buildLeavePayload()),
                ),
            ]),
        );

        const result = await processOutbox();

        expect(result).toEqual({ processed: 1, failed: 0 });
        expect(sendLeaveCancelledNotifications).toHaveBeenCalledWith(
            expect.objectContaining({ leaveId: "leave-1" }),
        );
    });

    it("supersedes a claimed leave action whose recipient identity is stale", async () => {
        vi.mocked(dispatchCurrentLeaveAction).mockResolvedValueOnce("SUPERSEDED");
        prismaMock.notificationOutbox.findMany.mockResolvedValue(asNever([
            buildNotification(120, "LEAVE_ACTION", JSON.stringify(buildLeavePayload())),
        ]));
        prismaMock.leaveRequest.findUnique.mockResolvedValue(asNever({
            id: "leave-1",
            status: "PENDING",
            approverId: 30,
            approver: {
                id: 30,
                firstName: "New",
                lastName: "Approver",
                email: "employee-record@example.com",
                status: "ACTIVE",
                deletedAt: null,
                user: {
                    id: 3,
                    email: "new-approver@example.com",
                    isActive: true,
                    deletedAt: null,
                },
            },
        }));

        const result = await processOutbox();

        expect(result).toEqual({ processed: 1, failed: 0 });
        expect(dispatchCurrentLeaveAction).toHaveBeenCalledWith(
            120,
            expect.objectContaining({ leaveId: "leave-1" }),
        );
        expect(prismaMock.notificationOutbox.updateMany).toHaveBeenCalledWith({
            where: { id: 120, status: "PROCESSING" },
            data: {
                status: "SUPERSEDED",
                lastError: "Superseded notification",
            },
        });
    });

    it("dispatches a claimed leave action through the Leave public contract", async () => {
        prismaMock.notificationOutbox.findMany.mockResolvedValue(asNever([
            buildNotification(124, "LEAVE_ACTION", JSON.stringify(buildLeavePayload())),
        ]));
        prismaMock.leaveRequest.findUnique.mockResolvedValue(asNever({
            id: "leave-1",
            status: "PENDING",
            approverId: 20,
            exceptionApproverId: null,
            approvalActionVersion: 1,
            approver: {
                id: 20,
                firstName: "Current",
                lastName: "Approver",
                email: "employee-record@example.com",
                status: "ACTIVE",
                deletedAt: null,
                user: {
                    id: 2,
                    email: "current-approver@example.com",
                    isActive: true,
                    deletedAt: null,
                },
            },
        }));

        const result = await processOutbox();

        expect(result).toEqual({ processed: 1, failed: 0 });
        expect(dispatchCurrentLeaveAction).toHaveBeenCalledWith(
            124,
            expect.objectContaining({
                approver: expect.objectContaining({
                    userId: 2,
                    email: "manager@example.com",
                }),
            }),
        );
    });

    it("processes not-taken leave events successfully", async () => {
        const payload = buildLeavePayload();
        prismaMock.notificationOutbox.findMany.mockResolvedValue(
            asNever([
                buildNotification(
                    108,
                    "LEAVE_NOT_TAKEN_REQUESTED",
                    JSON.stringify(payload),
                ),
                buildNotification(
                    109,
                    "LEAVE_NOT_TAKEN_CONFIRMED",
                    JSON.stringify(payload),
                ),
            ]),
        );

        const result = await processOutbox();

        expect(result).toEqual({ processed: 2, failed: 0 });
        expect(sendLeaveNotTakenRequestedNotifications).toHaveBeenCalledTimes(1);
        expect(sendLeaveNotTakenConfirmedNotifications).toHaveBeenCalledTimes(1);
    });

    it("processes approved-leave cancellation events successfully", async () => {
        const payload = buildLeavePayload();
        prismaMock.notificationOutbox.findMany.mockResolvedValue(
            asNever([
                buildNotification(
                    130,
                    "LEAVE_CANCELLATION_REQUESTED",
                    JSON.stringify(payload),
                ),
                buildNotification(
                    131,
                    "LEAVE_CANCELLED_AFTER_APPROVAL",
                    JSON.stringify(payload),
                ),
            ]),
        );

        const result = await processOutbox();

        expect(result).toEqual({ processed: 2, failed: 0 });
        expect(sendLeaveCancellationRequestedNotifications).toHaveBeenCalledTimes(1);
        expect(sendLeaveCancelledAfterApprovalNotifications).toHaveBeenCalledTimes(1);
    });

    it("marks leave event failed for invalid payload", async () => {
        prismaMock.notificationOutbox.findMany.mockResolvedValue(
            asNever([
                buildNotification(
                    110,
                    "LEAVE_NOT_TAKEN_REQUESTED",
                    JSON.stringify({ leaveId: "leave-1" }),
                ),
            ]),
        );

        const result = await processOutbox();

        expect(result).toEqual({ processed: 0, failed: 1 });
        expect(sendLeaveNotTakenRequestedNotifications).not.toHaveBeenCalled();
        expect(prismaMock.notificationOutbox.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 110, status: "PROCESSING" },
                data: expect.objectContaining({
                    status: "FAILED",
                    lastError: "Invalid LEAVE_NOT_TAKEN_REQUESTED payload",
                }),
            }),
        );
    });

    it("processes STOCK_REQUEST_LINE successfully", async () => {
        vi.mocked(sendStockLineBroadcast).mockResolvedValue(true);
        prismaMock.notificationOutbox.findMany.mockResolvedValue(
            asNever([
                buildNotification(
                    105,
                    "STOCK_REQUEST_LINE",
                    JSON.stringify({
                        requestId: 77,
                        projectCode: "PRJ-2569/01",
                        requesterName: "สมชาย",
                        requestedAt: new Date().toISOString(),
                        itemCount: 1,
                        totalQuantity: 2,
                        items: [
                            {
                                name: "กระดาษ",
                                quantity: 2,
                                unit: "รีม",
                            },
                        ],
                    }),
                ),
            ]),
        );

        const result = await processOutbox();

        expect(result).toEqual({ processed: 1, failed: 0 });
        expect(sendStockLineBroadcast).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "flex",
                altText: "มีคำขอเบิกวัสดุใหม่ #77",
            }),
            createOutboxLineRetryKey("STOCK_REQUEST_LINE", 105),
        );
    });

    it("creates stock request in-app notification before failed LINE delivery", async () => {
        vi.mocked(sendStockLineBroadcast).mockResolvedValue(false);
        prismaMock.user.findMany.mockResolvedValue(asNever([{ id: 1 }]));
        prismaMock.notification.create.mockResolvedValue(asNever({ id: "n-1" }));
        prismaMock.notificationOutbox.findMany.mockResolvedValue(
            asNever([
                buildNotification(
                    113,
                    "STOCK_REQUEST_LINE",
                    JSON.stringify({
                        requestId: 77,
                        projectCode: "PRJ-2569/01",
                        requesterName: "สมชาย",
                        requestedAt: "2026-07-01T03:00:00.000Z",
                        itemCount: 1,
                        totalQuantity: 2,
                        items: [
                            {
                                name: "กระดาษ",
                                quantity: 2,
                                unit: "รีม",
                            },
                        ],
                    }),
                ),
            ]),
        );

        const result = await processOutbox();

        expect(result).toEqual({ processed: 0, failed: 1 });
        expect(prismaMock.notification.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                userId: 1,
                type: "STOCK_REQUEST_NEW",
                title: "คำขอเบิกวัสดุใหม่",
                referenceId: "77",
            }),
        });
        expect(prismaMock.notificationOutbox.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    id: 113,
                    status: "PROCESSING",
                }),
                data: expect.objectContaining({
                    status: "FAILED",
                    lastError: "LINE stock request notification failed",
                }),
            }),
        );

        const inAppOrder = prismaMock.notification.create.mock.invocationCallOrder[0];
        const lineOrder = vi.mocked(sendStockLineBroadcast).mock.invocationCallOrder[0];
        expect(inAppOrder).toBeLessThan(lineOrder);
    });

    it("processes STOCK_LOW_LINE successfully", async () => {
        vi.mocked(sendStockLineBroadcast).mockResolvedValue(true);
        prismaMock.notificationOutbox.findMany.mockResolvedValue(
            asNever([
                buildNotification(
                    106,
                    "STOCK_LOW_LINE",
                    JSON.stringify({
                        alertedAt: new Date().toISOString(),
                        itemCount: 1,
                        items: [
                            {
                                itemId: 10,
                                name: "ปากกา",
                                sku: "PEN-001",
                                quantity: 3,
                                minStock: 5,
                                unit: "ด้าม",
                            },
                        ],
                    }),
                ),
            ]),
        );

        const result = await processOutbox();

        expect(result).toEqual({ processed: 1, failed: 0 });
        expect(sendStockLineBroadcast).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "flex",
                altText: "สต็อกต่ำถึงจุดสั่งซื้อ: ปากกา",
            }),
            createOutboxLineRetryKey("STOCK_LOW_LINE", 106),
        );
    });

    it("processes variant STOCK_LOW_LINE payload successfully", async () => {
        vi.mocked(sendStockLineBroadcast).mockResolvedValue(true);
        prismaMock.notificationOutbox.findMany.mockResolvedValue(
            asNever([
                buildNotification(
                    116,
                    "STOCK_LOW_LINE",
                    JSON.stringify({
                        alertedAt: new Date().toISOString(),
                        itemCount: 1,
                        items: [{
                            itemId: 10,
                            variantId: 101,
                            itemName: "หมึกพิมพ์",
                            variantSku: "INK-BLACK",
                            variantLabel: "สี: ดำ",
                            quantity: 1,
                            minStock: 5,
                            unit: "ตลับ",
                        }],
                    }),
                ),
            ]),
        );

        const result = await processOutbox();

        expect(result).toEqual({ processed: 1, failed: 0 });
        expect(sendStockLineBroadcast).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "flex",
                altText: "สต็อกต่ำถึงจุดสั่งซื้อ: หมึกพิมพ์",
            }),
            createOutboxLineRetryKey("STOCK_LOW_LINE", 116),
        );
    });

    it("creates low stock in-app notification before failed LINE delivery", async () => {
        vi.mocked(sendStockLineBroadcast).mockResolvedValue(false);
        prismaMock.user.findMany.mockResolvedValue(asNever([{ id: 1 }]));
        prismaMock.notification.create.mockResolvedValue(asNever({ id: "n-1" }));
        prismaMock.notificationOutbox.findMany.mockResolvedValue(
            asNever([
                buildNotification(
                    114,
                    "STOCK_LOW_LINE",
                    JSON.stringify({
                        alertedAt: "2026-07-01T03:00:00.000Z",
                        itemCount: 1,
                        items: [
                            {
                                itemId: 10,
                                name: "ปากกา",
                                sku: "PEN-001",
                                quantity: 3,
                                minStock: 5,
                                unit: "ด้าม",
                            },
                        ],
                    }),
                ),
            ]),
        );

        const result = await processOutbox();

        expect(result).toEqual({ processed: 0, failed: 1 });
        expect(prismaMock.notification.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                userId: 1,
                type: "SYSTEM_ALERT",
                title: "วัสดุใกล้หมดสต็อก",
                referenceId: "PEN-001",
            }),
        });

        const inAppOrder = prismaMock.notification.create.mock.invocationCallOrder[0];
        const lineOrder = vi.mocked(sendStockLineBroadcast).mock.invocationCallOrder[0];
        expect(inAppOrder).toBeLessThan(lineOrder);
    });

    it("processes a valid issued stock request result email", async () => {
        vi.mocked(sendEmail).mockResolvedValue(true);
        const payload = buildStockRequestResultPayload("ISSUED");
        prismaMock.notificationOutbox.findMany.mockResolvedValue(
            asNever([
                buildNotification(
                    120,
                    "STOCK_REQUEST_RESULT_EMAIL",
                    JSON.stringify(payload),
                    "stock-request:77:ISSUED:email",
                ),
            ]),
        );

        const result = await processOutbox();

        expect(result).toEqual({ processed: 1, failed: 0 });
        expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
            messageId: "<nhf-stock-request-77-issued@notifications.thainhf.org>",
        }));
        expect(prismaMock.notification.create).not.toHaveBeenCalled();
        expect(prismaMock.notificationOutbox.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 120, status: "PROCESSING" },
                data: { status: "SENT", lastError: null },
            }),
        );
    });

    it("processes a valid cancelled stock request result email", async () => {
        vi.mocked(sendEmail).mockResolvedValue(true);
        const payload = buildStockRequestResultPayload("CANCELLED");
        prismaMock.notificationOutbox.findMany.mockResolvedValue(
            asNever([
                buildNotification(
                    121,
                    "STOCK_REQUEST_RESULT_EMAIL",
                    JSON.stringify(payload),
                    "stock-request:77:CANCELLED:email",
                ),
            ]),
        );

        const result = await processOutbox();

        expect(result).toEqual({ processed: 1, failed: 0 });
        expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
            messageId: "<nhf-stock-request-77-cancelled@notifications.thainhf.org>",
        }));
        expect(prismaMock.notification.create).not.toHaveBeenCalled();
    });

    it("retries a stock request result email when the email service returns false", async () => {
        vi.mocked(sendEmail).mockResolvedValue(false);
        const payload = buildStockRequestResultPayload("ISSUED");
        prismaMock.notificationOutbox.findMany.mockResolvedValue(
            asNever([
                buildNotification(
                    122,
                    "STOCK_REQUEST_RESULT_EMAIL",
                    JSON.stringify(payload),
                ),
            ]),
        );

        const result = await processOutbox();

        expect(result).toEqual({ processed: 0, failed: 1 });
        expect(prismaMock.notificationOutbox.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 122, status: "PROCESSING" },
                data: expect.objectContaining({
                    status: "FAILED",
                    lastError: "STOCK_REQUEST_RESULT_EMAIL failed",
                }),
            }),
        );
        expect(prismaMock.notification.create).not.toHaveBeenCalled();
    });

    it("rejects malformed stock request result email payloads", async () => {
        prismaMock.notificationOutbox.findMany.mockResolvedValue(
            asNever([
                buildNotification(
                    123,
                    "STOCK_REQUEST_RESULT_EMAIL",
                    JSON.stringify({
                        ...buildStockRequestResultPayload("ISSUED"),
                        status: "UNKNOWN",
                    }),
                ),
            ]),
        );

        const result = await processOutbox();

        expect(result).toEqual({ processed: 0, failed: 1 });
        expect(sendEmail).not.toHaveBeenCalled();
        expect(prismaMock.notificationOutbox.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 123, status: "PROCESSING" },
                data: expect.objectContaining({
                    status: "FAILED",
                    lastError: "Invalid STOCK_REQUEST_RESULT_EMAIL payload",
                }),
            }),
        );
    });

    it("uses the existing retry flow for invalid stock request result JSON", async () => {
        prismaMock.notificationOutbox.findMany.mockResolvedValue(
            asNever([
                buildNotification(
                    124,
                    "STOCK_REQUEST_RESULT_EMAIL",
                    "{invalid-json",
                ),
            ]),
        );

        const result = await processOutbox();

        expect(result).toEqual({ processed: 0, failed: 1 });
        expect(sendEmail).not.toHaveBeenCalled();
        expect(prismaMock.notificationOutbox.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 124, status: "PROCESSING" },
                data: expect.objectContaining({
                    status: "FAILED",
                    lastError: "Invalid payload JSON",
                }),
            }),
        );
    });

    it("moves a failed stock request result email to dead letter after retries", async () => {
        vi.mocked(sendEmail).mockResolvedValue(false);
        const payload = buildStockRequestResultPayload("CANCELLED");
        prismaMock.notificationOutbox.findMany.mockResolvedValue(
            asNever([{
                ...buildNotification(
                    125,
                    "STOCK_REQUEST_RESULT_EMAIL",
                    JSON.stringify(payload),
                ),
                attempts: 2,
            }]),
        );

        const result = await processOutbox();

        expect(result).toEqual({ processed: 0, failed: 1 });
        expect(prismaMock.notificationOutbox.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 125, status: "PROCESSING" },
                data: expect.objectContaining({
                    status: "DEAD",
                    attempts: { increment: 1 },
                    lastError: "STOCK_REQUEST_RESULT_EMAIL failed",
                }),
            }),
        );
    });

    it("skips notification when claim fails", async () => {
        prismaMock.notificationOutbox.findMany.mockResolvedValue(
            asNever([
                buildNotification(
                    104,
                    "LEAVE_CANCELLED",
                    JSON.stringify(buildLeavePayload()),
                ),
            ]),
        );
        prismaMock.notificationOutbox.updateMany.mockResolvedValue(
            asNever({ count: 0 }),
        );

        const result = await processOutbox();

        expect(result).toEqual({ processed: 0, failed: 0 });
        expect(sendLeaveCancelledNotifications).not.toHaveBeenCalled();
    });

    it("only selects retries whose backoff has elapsed", async () => {
        const now = new Date("2026-07-13T03:00:00.000Z");
        vi.setSystemTime(now);
        prismaMock.notificationOutbox.findMany.mockResolvedValue(asNever([]));

        await processOutbox();

        expect(prismaMock.notificationOutbox.findMany).toHaveBeenCalledWith({
            where: {
                status: { in: ["PENDING", "FAILED"] },
                attempts: { lt: 3 },
                nextAttemptAt: { lte: now },
            },
            take: 10,
            orderBy: { createdAt: "asc" },
        });
        vi.useRealTimers();
    });

    it("records exponential backoff and the last dispatch error", async () => {
        const now = new Date("2026-07-13T03:00:00.000Z");
        vi.setSystemTime(now);
        prismaMock.notificationOutbox.findMany.mockResolvedValue(
            asNever([
                buildNotification(
                    115,
                    "LEAVE_CANCELLED",
                    JSON.stringify(buildLeavePayload()),
                ),
            ]),
        );
        vi.mocked(sendLeaveCancelledNotifications).mockRejectedValueOnce(
            new Error("SMTP unavailable"),
        );

        await processOutbox();

        expect(prismaMock.notificationOutbox.updateMany).toHaveBeenCalledWith({
            where: { id: 115, status: "PROCESSING" },
            data: {
                status: "FAILED",
                attempts: { increment: 1 },
                lastError: "SMTP unavailable",
                nextAttemptAt: new Date("2026-07-13T03:01:00.000Z"),
            },
        });
        vi.useRealTimers();
    });

    it.each([
        { attempts: 0, nextStatus: "FAILED", terminal: false },
        { attempts: 1, nextStatus: "FAILED", terminal: false },
        { attempts: 2, nextStatus: "DEAD", terminal: true },
    ] as const)(
        "recovers stale PROCESSING at attempt $attempts with the bounded transition",
        async ({ attempts, nextStatus, terminal }) => {
            const now = new Date("2026-07-13T03:00:00.000Z");
            vi.useFakeTimers();
            vi.setSystemTime(now);
            const infoSpy = vi
                .spyOn(console, "warn")
                .mockImplementation(() => undefined);
            const notification = {
                ...buildNotification(
                    140 + attempts,
                    "LEAVE_CANCELLED",
                    JSON.stringify(buildLeavePayload()),
                ),
                status: "PROCESSING" as const,
                attempts,
                updatedAt: new Date(
                    now.getTime()
                        - (STALE_OUTBOX_PROCESSING_MINUTES * 60_000 + 1),
                ),
            };
            prismaMock.notificationOutbox.findMany
                .mockResolvedValueOnce(asNever([notification]))
                .mockResolvedValueOnce(asNever([]));

            try {
                const result = await processOutbox();

                expect(result).toEqual({ processed: 0, failed: 0 });
                const recoveryCall = prismaMock.notificationOutbox.updateMany
                    .mock.calls[0]?.[0];
                expect(recoveryCall).toEqual({
                    where: {
                        id: notification.id,
                        status: "PROCESSING",
                        updatedAt: {
                            lt: new Date(
                                now.getTime()
                                    - STALE_OUTBOX_PROCESSING_MINUTES * 60_000,
                            ),
                        },
                        attempts,
                    },
                    data: expect.objectContaining({
                        status: nextStatus,
                        lastError: "Processing timeout",
                        ...(terminal
                            ? {}
                            : {
                                nextAttemptAt: new Date(
                                    now.getTime() + OUTBOX_RETRY_BASE_DELAY_MS,
                                ),
                            }),
                    }),
                });
                if (terminal) {
                    expect(recoveryCall?.data).not.toHaveProperty(
                        "nextAttemptAt",
                    );
                } else {
                    expect(recoveryCall?.data).toEqual(expect.objectContaining({
                        attempts: { increment: 1 },
                    }));
                }

                const eventNames = infoSpy.mock.calls.map(([event]) => event);
                expect(eventNames).toContain("outbox_stale_recovered");
                expect(eventNames).toContain(
                    terminal
                        ? "outbox_dead_lettered"
                        : "outbox_retry_scheduled",
                );
                expect(infoSpy.mock.calls).toContainEqual([
                    "outbox_stale_recovered",
                    expect.objectContaining({
                        event: "outbox_stale_recovered",
                        outboxId: notification.id,
                        outboxType: notification.type,
                        attempt: Math.min(
                            attempts + 1,
                            MAX_OUTBOX_ATTEMPTS,
                        ),
                        nextStatus,
                    }),
                ]);
            } finally {
                infoSpy.mockRestore();
                vi.useRealTimers();
            }
        },
    );

    it("leaves fresh and terminal non-PROCESSING rows untouched during stale recovery", async () => {
        const now = new Date("2026-07-13T03:00:00.000Z");
        vi.useFakeTimers();
        vi.setSystemTime(now);
        const infoSpy = vi
            .spyOn(console, "warn")
            .mockImplementation(() => undefined);
        prismaMock.notificationOutbox.findMany
            .mockResolvedValueOnce(asNever([]))
            .mockResolvedValueOnce(asNever([]));

        try {
            await processOutbox();

            expect(prismaMock.notificationOutbox.updateMany).not.toHaveBeenCalled();
            expect(prismaMock.notificationOutbox.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        status: "PROCESSING",
                        updatedAt: {
                            lt: new Date(
                                now.getTime()
                                    - STALE_OUTBOX_PROCESSING_MINUTES * 60_000,
                            ),
                        },
                    },
                }),
            );
            expect(infoSpy).not.toHaveBeenCalled();
        } finally {
            infoSpy.mockRestore();
            vi.useRealTimers();
        }
    });

    it("does not increment an already exhausted stale PROCESSING row", async () => {
        const now = new Date("2026-07-13T03:00:00.000Z");
        vi.useFakeTimers();
        vi.setSystemTime(now);
        const notification = {
            ...buildNotification(
                144,
                "LEAVE_CANCELLED",
                JSON.stringify(buildLeavePayload()),
            ),
            status: "PROCESSING" as const,
            attempts: MAX_OUTBOX_ATTEMPTS,
            updatedAt: new Date(
                now.getTime()
                    - (STALE_OUTBOX_PROCESSING_MINUTES * 60_000 + 1),
            ),
        };
        prismaMock.notificationOutbox.findMany
            .mockResolvedValueOnce(asNever([notification]))
            .mockResolvedValueOnce(asNever([]));

        try {
            await processOutbox();

            const recoveryData = prismaMock.notificationOutbox.updateMany
                .mock.calls[0]?.[0].data;
            expect(recoveryData).toEqual({
                status: "DEAD",
                lastError: "Processing timeout",
            });
        } finally {
            vi.useRealTimers();
        }
    });

    it("emits safe structured metadata for repeated provider attempts and retries", async () => {
        const infoSpy = vi
            .spyOn(console, "warn")
            .mockImplementation(() => undefined);
        const notification = {
            ...buildNotification(
                145,
                "LEAVE_CANCELLED",
                JSON.stringify(buildLeavePayload()),
            ),
            status: "FAILED" as const,
            attempts: 1,
        };
        prismaMock.notificationOutbox.findMany
            .mockResolvedValueOnce(asNever([]))
            .mockResolvedValueOnce(asNever([notification]));
        prismaMock.notificationOutbox.updateMany
            .mockResolvedValueOnce(asNever({ count: 1 }))
            .mockResolvedValueOnce(asNever({ count: 1 }));
        vi.mocked(sendLeaveCancelledNotifications).mockRejectedValueOnce(
            new Error("temporary provider failure"),
        );

        try {
            await processOutbox();

            expect(infoSpy.mock.calls).toContainEqual([
                "outbox_provider_attempt",
                expect.objectContaining({
                    event: "outbox_provider_attempt",
                    outboxId: 145,
                    outboxType: "LEAVE_CANCELLED",
                    attempt: 2,
                    nextStatus: "PROCESSING",
                    isRetry: true,
                }),
            ]);
            const retryEvents = infoSpy.mock.calls.filter(
                ([event]) => event === "outbox_retry_scheduled",
            );
            expect(retryEvents).toEqual([
                [
                    "outbox_retry_scheduled",
                    expect.objectContaining({
                        event: "outbox_retry_scheduled",
                        outboxId: 145,
                        outboxType: "LEAVE_CANCELLED",
                        attempt: 2,
                        nextStatus: "FAILED",
                    }),
                ],
            ]);
            expect(
                prismaMock.notificationOutbox.updateMany.mock.calls[0]?.[0],
            ).toEqual(expect.objectContaining({
                where: expect.objectContaining({
                    id: 145,
                    status: { in: ["PENDING", "FAILED"] },
                }),
                data: { status: "PROCESSING" },
            }));
            expect(
                prismaMock.notificationOutbox.updateMany.mock.calls[1]?.[0],
            ).toEqual(expect.objectContaining({
                where: { id: 145, status: "PROCESSING" },
                data: expect.objectContaining({
                    status: "FAILED",
                    attempts: { increment: 1 },
                }),
            }));
            const retryEventIndex = infoSpy.mock.calls.findIndex(
                ([event]) => event === "outbox_retry_scheduled",
            );
            expect(
                prismaMock.notificationOutbox.updateMany
                    .mock.invocationCallOrder[1],
            ).toBeLessThan(
                infoSpy.mock.invocationCallOrder[retryEventIndex],
            );
            const loggedMetadata = JSON.stringify(infoSpy.mock.calls);
            expect(loggedMetadata).not.toContain("employee@example.com");
            expect(loggedMetadata).not.toContain("ลาป่วย");
        } finally {
            infoSpy.mockRestore();
        }
    });

    it("emits a safe DEAD event after a terminal provider failure", async () => {
        const infoSpy = vi
            .spyOn(console, "warn")
            .mockImplementation(() => undefined);
        const notification = {
            ...buildNotification(
                146,
                "LEAVE_CANCELLED",
                JSON.stringify(buildLeavePayload()),
            ),
            attempts: MAX_OUTBOX_ATTEMPTS - 1,
        };
        prismaMock.notificationOutbox.findMany
            .mockResolvedValueOnce(asNever([]))
            .mockResolvedValueOnce(asNever([notification]));
        prismaMock.notificationOutbox.updateMany
            .mockResolvedValueOnce(asNever({ count: 1 }))
            .mockResolvedValueOnce(asNever({ count: 1 }));
        vi.mocked(sendLeaveCancelledNotifications).mockRejectedValueOnce(
            new Error("permanent provider failure"),
        );

        try {
            await processOutbox();

            const deadLetterEvents = infoSpy.mock.calls.filter(
                ([event]) => event === "outbox_dead_lettered",
            );
            expect(deadLetterEvents).toEqual([
                [
                    "outbox_dead_lettered",
                    expect.objectContaining({
                        event: "outbox_dead_lettered",
                        outboxId: 146,
                        outboxType: "LEAVE_CANCELLED",
                        attempt: MAX_OUTBOX_ATTEMPTS,
                        nextStatus: "DEAD",
                        nextAttemptAt: null,
                    }),
                ],
            ]);
            expect(
                prismaMock.notificationOutbox.updateMany.mock.calls[1]?.[0],
            ).toEqual(expect.objectContaining({
                where: { id: 146, status: "PROCESSING" },
                data: expect.objectContaining({
                    status: "DEAD",
                    attempts: { increment: 1 },
                }),
            }));
            const deadLetterEventIndex = infoSpy.mock.calls.findIndex(
                ([event]) => event === "outbox_dead_lettered",
            );
            expect(
                prismaMock.notificationOutbox.updateMany
                    .mock.invocationCallOrder[1],
            ).toBeLessThan(
                infoSpy.mock.invocationCallOrder[deadLetterEventIndex],
            );
            expect(JSON.stringify(infoSpy.mock.calls)).not.toContain(
                "permanent provider failure",
            );
        } finally {
            infoSpy.mockRestore();
        }
    });

    it("does not emit retry or DEAD events when the failure transition is lost", async () => {
        const infoSpy = vi
            .spyOn(console, "warn")
            .mockImplementation(() => undefined);
        const notification = buildNotification(
            147,
            "LEAVE_CANCELLED",
            JSON.stringify(buildLeavePayload()),
        );
        prismaMock.notificationOutbox.findMany
            .mockResolvedValueOnce(asNever([]))
            .mockResolvedValueOnce(asNever([notification]));
        prismaMock.notificationOutbox.updateMany
            .mockResolvedValueOnce(asNever({ count: 1 }))
            .mockResolvedValueOnce(asNever({ count: 0 }));
        vi.mocked(sendLeaveCancelledNotifications).mockRejectedValueOnce(
            new Error("lost transition"),
        );

        try {
            await expect(processOutbox()).resolves.toEqual({
                processed: 0,
                failed: 1,
            });

            expect(infoSpy).not.toHaveBeenCalledWith(
                "outbox_retry_scheduled",
                expect.anything(),
            );
            expect(infoSpy).not.toHaveBeenCalledWith(
                "outbox_dead_lettered",
                expect.anything(),
            );
            expect(
                prismaMock.notificationOutbox.updateMany.mock.calls[1]?.[0],
            ).toEqual(expect.objectContaining({
                where: { id: 147, status: "PROCESSING" },
                data: expect.objectContaining({ status: "FAILED" }),
            }));
        } finally {
            infoSpy.mockRestore();
        }
    });

    it("propagates failure-transition persistence errors without emitting state events", async () => {
        const infoSpy = vi
            .spyOn(console, "warn")
            .mockImplementation(() => undefined);
        const persistenceError = new Error("Outbox persistence unavailable");
        const notification = buildNotification(
            148,
            "LEAVE_CANCELLED",
            JSON.stringify(buildLeavePayload()),
        );
        prismaMock.notificationOutbox.findMany
            .mockResolvedValueOnce(asNever([]))
            .mockResolvedValueOnce(asNever([notification]));
        prismaMock.notificationOutbox.updateMany
            .mockResolvedValueOnce(asNever({ count: 1 }))
            .mockRejectedValueOnce(persistenceError);
        vi.mocked(sendLeaveCancelledNotifications).mockRejectedValueOnce(
            new Error("provider failure before persistence"),
        );

        try {
            await expect(processOutbox()).rejects.toBe(persistenceError);

            expect(infoSpy).not.toHaveBeenCalledWith(
                "outbox_retry_scheduled",
                expect.anything(),
            );
            expect(infoSpy).not.toHaveBeenCalledWith(
                "outbox_dead_lettered",
                expect.anything(),
            );
        } finally {
            infoSpy.mockRestore();
        }
    });

    it("retries a due failed entry without a new API mutation", async () => {
        const failedNotification = {
            ...buildNotification(
                119,
                "LEAVE_CANCELLED",
                JSON.stringify(buildLeavePayload()),
            ),
            status: "FAILED" as const,
            attempts: 1,
            nextAttemptAt: new Date("2026-07-13T02:59:00.000Z"),
            lastError: "SMTP unavailable",
        };
        prismaMock.notificationOutbox.findMany.mockResolvedValue(
            asNever([failedNotification]),
        );

        const result = await processOutbox();

        expect(result).toEqual({ processed: 1, failed: 0 });
        expect(sendLeaveCancelledNotifications).toHaveBeenCalledTimes(1);
        expect(prismaMock.notificationOutbox.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 119, status: "PROCESSING" },
                data: expect.objectContaining({ status: "SENT", lastError: null }),
            }),
        );
    });

    it("moves an outbox entry to dead letter after the retry limit", async () => {
        prismaMock.notificationOutbox.findMany.mockResolvedValue(
            asNever([
                {
                    ...buildNotification(
                        116,
                        "LEAVE_CANCELLED",
                        JSON.stringify(buildLeavePayload()),
                    ),
                    attempts: 2,
                },
            ]),
        );
        vi.mocked(sendLeaveCancelledNotifications).mockRejectedValueOnce(
            new Error("Permanent failure"),
        );

        await processOutbox();

        expect(prismaMock.notificationOutbox.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 116, status: "PROCESSING" },
                data: expect.objectContaining({
                    status: "DEAD",
                    attempts: { increment: 1 },
                    lastError: "Permanent failure",
                }),
            }),
        );
    });

    it("allows only one of two workers to claim the same entry", async () => {
        const notification = buildNotification(
            117,
            "LEAVE_CANCELLED",
            JSON.stringify(buildLeavePayload()),
        );
        prismaMock.notificationOutbox.findMany.mockResolvedValue(
            asNever([notification]),
        );
        let claimed = false;
        prismaMock.notificationOutbox.updateMany.mockImplementation(
            (async (args: Prisma.NotificationOutboxUpdateManyArgs) => {
                const status = args.where?.status;
                if (status === "PROCESSING") return asNever({ count: 0 });
                if (typeof status === "object" && status !== null && "in" in status) {
                    if (claimed) return asNever({ count: 0 });
                    claimed = true;
                }
                return asNever({ count: 1 });
            }) as never,
        );

        await Promise.all([processOutbox(), processOutbox()]);

        expect(sendLeaveCancelledNotifications).toHaveBeenCalledTimes(1);
    });

    it("does not dispatch a sent entry again when the worker reruns", async () => {
        const notification = buildNotification(
            118,
            "LEAVE_CANCELLED",
            JSON.stringify(buildLeavePayload()),
        );
        prismaMock.notificationOutbox.findMany
            .mockResolvedValueOnce(asNever([]))
            .mockResolvedValueOnce(asNever([notification]))
            .mockResolvedValueOnce(asNever([]))
            .mockResolvedValueOnce(asNever([]));

        await processOutbox();
        await processOutbox();

        expect(sendLeaveCancelledNotifications).toHaveBeenCalledTimes(1);
    });
});

