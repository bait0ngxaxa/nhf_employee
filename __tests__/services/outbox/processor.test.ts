import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
    NotificationOutbox,
    NotificationOutboxType,
    Prisma,
    PrismaClient,
} from "@prisma/client";
import { mockDeep, mockReset } from "vitest-mock-extended";
import { lineNotificationService } from "@/lib/line";
import { prisma } from "@/lib/db/prisma";
import { processOutbox } from "@/lib/services/outbox/processor";
import { EMAIL_REQUEST_INAPP_RECIPIENTS_ENV } from "@/lib/services/email-request/notifications";
import {
    sendTicketCommentInAppNotification,
    sendTicketCreatedInAppNotification,
    sendTicketCreatedLineNotification,
    sendTicketCreatedReporterEmailNotification,
    sendTicketUpdatedReporterEmailNotification,
} from "@/lib/services/ticket/notifications";
import type {
    TicketUpdatedNotificationSnapshot,
} from "@/lib/services/ticket/update-notification-snapshot";
import {
    sendLeaveActionNotifications,
    sendLeaveCancelledNotifications,
    sendLeaveNotTakenConfirmedNotifications,
    sendLeaveNotTakenRequestedNotifications,
} from "@/lib/services/leave/notifications";

vi.mock("@/lib/db/prisma", () => ({
    prisma: mockDeep<PrismaClient>(),
}));

vi.mock("@/lib/services/ticket/notifications", () => ({
    sendTicketCommentInAppNotification: vi.fn(),
    sendTicketCreatedITEmailNotification: vi.fn(),
    sendTicketCreatedInAppNotification: vi.fn(),
    sendTicketCreatedLineNotification: vi.fn(),
    sendTicketCreatedReporterEmailNotification: vi.fn(),
    sendTicketUpdatedInAppNotification: vi.fn(),
    sendTicketUpdatedLineNotification: vi.fn(),
    sendTicketUpdatedReporterEmailNotification: vi.fn(),
}));

vi.mock("@/lib/services/leave/notifications", () => ({
    createLeaveActionInAppNotification: vi.fn(),
    sendLeaveActionNotifications: vi.fn(),
    sendLeaveResultNotifications: vi.fn(),
    sendLeaveCancelledNotifications: vi.fn(),
    sendLeaveNotTakenRequestedNotifications: vi.fn(),
    sendLeaveNotTakenConfirmedNotifications: vi.fn(),
}));

vi.mock("@/lib/line", () => ({
    lineNotificationService: {
        sendEmailRequestNotification: vi.fn(),
        sendStockRequestNotification: vi.fn(),
        sendStockLowNotification: vi.fn(),
    },
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

function buildTicketUpdatedSnapshot(): TicketUpdatedNotificationSnapshot {
    return {
        ticketId: 1,
        oldStatus: "OPEN",
        newStatus: "IN_PROGRESS",
        title: "Test Ticket",
        description: "desc",
        category: "HARDWARE",
        priority: "LOW",
        reportedBy: {
            id: 1,
            name: "U",
            email: "u@test.com",
        },
        createdAt: "2026-07-24T01:00:00.000Z",
        occurredAt: "2026-07-24T02:00:00.000Z",
    };
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
        expect(prismaMock.notificationOutbox.updateMany).toHaveBeenCalledTimes(2);
    });

    it("processes only the requested ticket-created provider", async () => {
        prismaMock.notificationOutbox.findMany.mockResolvedValue(
            asNever([
                buildNotification(
                    100,
                    "TICKET_CREATED_EMAIL_REPORTER",
                    JSON.stringify({ ticketId: 1 }),
                    "ticket:1:created:email:reporter:1",
                ),
            ]),
        );
        prismaMock.ticket.findUnique.mockResolvedValue(
            asNever({
                id: 1,
                title: "Test Ticket",
                description: "desc",
                category: "HARDWARE",
                priority: "LOW",
                status: "OPEN",
                reportedById: 1,
                assignedToId: null,
                resolution: null,
                resolvedAt: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                reportedBy: { id: 1, name: "U", email: "u@test.com", employee: null },
                assignedTo: null,
            }),
        );

        const result = await processOutbox();

        expect(result).toEqual({ processed: 1, failed: 0 });
        expect(sendTicketCreatedReporterEmailNotification).toHaveBeenCalledTimes(1);
        expect(sendTicketCreatedLineNotification).not.toHaveBeenCalled();
        expect(sendTicketCreatedInAppNotification).not.toHaveBeenCalled();
        expect(prismaMock.notificationOutbox.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 100, status: "PROCESSING" },
                data: expect.objectContaining({ status: "SENT" }),
            }),
        );
    });

    it("dispatches the immutable status snapshot without reading current ticket state", async () => {
        prismaMock.notificationOutbox.findMany.mockResolvedValue(
            asNever([
                buildNotification(
                    101,
                    "TICKET_UPDATED_EMAIL_REPORTER",
                    JSON.stringify(buildTicketUpdatedSnapshot()),
                    "ticket:1:status:v1:email:reporter:1",
                ),
            ]),
        );

        const result = await processOutbox();

        expect(result).toEqual({ processed: 1, failed: 0 });
        expect(sendTicketUpdatedReporterEmailNotification).toHaveBeenCalledWith(
            expect.objectContaining({
                ticketId: 1,
                oldStatus: "OPEN",
                newStatus: "IN_PROGRESS",
            }),
            "ticket:1:status:v1:email:reporter:1",
        );
        expect(prismaMock.ticket.findUnique).not.toHaveBeenCalled();
    });

    it("supersedes legacy status events that cannot be delivered accurately", async () => {
        prismaMock.notificationOutbox.findMany.mockResolvedValue(
            asNever([
                buildNotification(
                    102,
                    "TICKET_UPDATED_EMAIL_REPORTER",
                    JSON.stringify({ ticketId: 1, oldStatus: "OPEN" }),
                    "ticket:1:status:legacy:email:reporter:1",
                ),
            ]),
        );

        const result = await processOutbox();

        expect(result).toEqual({ processed: 1, failed: 0 });
        expect(sendTicketUpdatedReporterEmailNotification).not.toHaveBeenCalled();
        expect(prismaMock.ticket.findUnique).not.toHaveBeenCalled();
        expect(prismaMock.notificationOutbox.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 102, status: "PROCESSING" },
                data: expect.objectContaining({ status: "SUPERSEDED" }),
            }),
        );
    });

    it("retries failed ticket email without sending LINE again", async () => {
        const payload = JSON.stringify({ ticketId: 1 });
        const lineEvent = buildNotification(
            121,
            "TICKET_CREATED_LINE",
            payload,
            "ticket:1:created:line:it",
        );
        const emailEvent = buildNotification(
            122,
            "TICKET_CREATED_EMAIL_REPORTER",
            payload,
            "ticket:1:created:email:reporter:1",
        );
        prismaMock.notificationOutbox.findMany
            .mockResolvedValueOnce(asNever([lineEvent, emailEvent]))
            .mockResolvedValueOnce(asNever([
                { ...emailEvent, status: "FAILED", attempts: 1 },
            ]));
        prismaMock.ticket.findUnique.mockResolvedValue(asNever({
            id: 1,
            reportedById: 1,
        }));
        vi.mocked(sendTicketCreatedReporterEmailNotification)
            .mockRejectedValueOnce(new Error("SMTP unavailable"))
            .mockResolvedValueOnce();

        await processOutbox();
        await processOutbox();

        expect(sendTicketCreatedLineNotification).toHaveBeenCalledTimes(1);
        expect(sendTicketCreatedReporterEmailNotification).toHaveBeenCalledTimes(2);
    });

    it("processes comment notification with its provider dedupe key", async () => {
        const payload = {
            ticketId: 1,
            commentId: 88,
            recipientId: 9,
            authorId: 1,
            authorName: "Admin",
            ticketTitle: "Printer issue",
            authorIsOwner: false,
        };
        const eventKey = "ticket:1:comment:88:in-app:user:9";
        prismaMock.notificationOutbox.findMany.mockResolvedValue(
            asNever([
                buildNotification(
                    120,
                    "TICKET_COMMENT_IN_APP",
                    JSON.stringify(payload),
                    eventKey,
                ),
            ]),
        );

        const result = await processOutbox();

        expect(result).toEqual({ processed: 1, failed: 0 });
        expect(sendTicketCommentInAppNotification).toHaveBeenCalledWith(
            payload,
            eventKey,
        );
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
        );
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
                    "TICKET_CREATED_EMAIL_REPORTER",
                    JSON.stringify({ ticketId: 1 }),
                    "ticket:1:created:email:reporter:1",
                ),
            ]),
        );
        prismaMock.ticket.findUnique.mockResolvedValue(
            asNever({
                id: 1,
                title: "Test Ticket",
                description: "desc",
                category: "HARDWARE",
                priority: "LOW",
                status: "OPEN",
                reportedById: 1,
                assignedToId: null,
                resolution: null,
                resolvedAt: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                reportedBy: { id: 1, name: "U", email: "u@test.com", employee: null },
                assignedTo: null,
            }),
        );
        vi.mocked(sendTicketCreatedReporterEmailNotification).mockRejectedValue(
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
        expect(sendLeaveActionNotifications).not.toHaveBeenCalled();
        expect(prismaMock.notificationOutbox.findFirst).toHaveBeenCalledWith({
            where: { id: 120, status: "PROCESSING" },
            select: { id: true },
        });
            expect(prismaMock.notificationOutbox.updateMany).toHaveBeenCalledWith({
                where: { id: 120, status: "PROCESSING" },
                data: {
                    status: "SUPERSEDED",
                    lastError: "Superseded by stale leave-action delivery",
                },
            });
    });

    it("dispatches a claimed leave action when its recipient identity is current", async () => {
        prismaMock.notificationOutbox.findMany.mockResolvedValue(asNever([
            buildNotification(124, "LEAVE_ACTION", JSON.stringify(buildLeavePayload())),
        ]));
        prismaMock.leaveRequest.findUnique.mockResolvedValue(asNever({
            status: "PENDING",
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
        expect(sendLeaveActionNotifications).toHaveBeenCalledWith(
            expect.objectContaining({
                deliveryIdentity: "leave-1:2",
                approver: expect.objectContaining({
                    userId: 2,
                    email: "current-approver@example.com",
                }),
            }),
            { createInApp: false },
        );
        const { createLeaveActionInAppNotification } = await import(
            "@/lib/services/leave/notifications"
        );
        expect(createLeaveActionInAppNotification).toHaveBeenCalledWith(
            prismaMock,
            expect.objectContaining({ leaveId: "leave-1" }),
        );
        expect(prismaMock.$queryRaw).toHaveBeenCalled();
        const transactionOrder = prismaMock.$transaction.mock.invocationCallOrder[0];
        const sendOrder = vi.mocked(sendLeaveActionNotifications).mock.invocationCallOrder[0];
        expect(transactionOrder).toBeLessThan(sendOrder);
    });

    it("does not notify an approver who lost permission before a worker rerun", async () => {
        prismaMock.notificationOutbox.findMany.mockResolvedValue(asNever([{
            ...buildNotification(121, "LEAVE_ACTION", JSON.stringify(buildLeavePayload())),
            status: "FAILED",
            attempts: 1,
        }]));
        prismaMock.leaveRequest.findUnique.mockResolvedValue(asNever({
            id: "leave-1",
            status: "PENDING",
            approverId: 20,
            approver: {
                id: 20,
                firstName: "Former",
                lastName: "Approver",
                email: "former@example.com",
                status: "INACTIVE",
                deletedAt: null,
                user: {
                    id: 2,
                    email: "former@example.com",
                    isActive: false,
                    deletedAt: null,
                },
            },
        }));
        const result = await processOutbox();

        expect(result).toEqual({ processed: 1, failed: 0 });
        expect(sendLeaveActionNotifications).not.toHaveBeenCalled();
    });

    it("does not dispatch a claimed leave action that was already superseded", async () => {
        prismaMock.notificationOutbox.findMany.mockResolvedValue(asNever([
            buildNotification(122, "LEAVE_ACTION", JSON.stringify(buildLeavePayload())),
        ]));
        prismaMock.notificationOutbox.findFirst.mockResolvedValue(null);

        const result = await processOutbox();

        expect(result).toEqual({ processed: 1, failed: 0 });
        expect(prismaMock.notificationOutbox.findFirst).toHaveBeenCalledWith({
            where: { id: 122, status: "PROCESSING" },
            select: { id: true },
        });
        expect(prismaMock.leaveRequest.findUnique).not.toHaveBeenCalled();
        expect(sendLeaveActionNotifications).not.toHaveBeenCalled();
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
        vi.mocked(
            lineNotificationService.sendStockRequestNotification,
        ).mockResolvedValue(true);
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
        expect(
            lineNotificationService.sendStockRequestNotification,
        ).toHaveBeenCalledWith(
            expect.objectContaining({
                projectCode: "PRJ-2569/01",
                requesterName: "สมชาย",
            }),
        );
    });

    it("creates stock request in-app notification before failed LINE delivery", async () => {
        vi.mocked(
            lineNotificationService.sendStockRequestNotification,
        ).mockResolvedValue(false);
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

        const inAppOrder = prismaMock.notification.create.mock.invocationCallOrder[0];
        const lineOrder =
            vi.mocked(lineNotificationService.sendStockRequestNotification).mock
                .invocationCallOrder[0];
        expect(inAppOrder).toBeLessThan(lineOrder);
    });

    it("processes STOCK_LOW_LINE successfully", async () => {
        vi.mocked(lineNotificationService.sendStockLowNotification).mockResolvedValue(
            true,
        );
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
        expect(lineNotificationService.sendStockLowNotification).toHaveBeenCalledWith(
            expect.objectContaining({
                itemCount: 1,
                items: [
                    expect.objectContaining({
                        sku: "PEN-001",
                    }),
                ],
            }),
        );
    });

    it("processes variant STOCK_LOW_LINE payload successfully", async () => {
        vi.mocked(lineNotificationService.sendStockLowNotification).mockResolvedValue(
            true,
        );
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
        expect(lineNotificationService.sendStockLowNotification).toHaveBeenCalledWith(
            expect.objectContaining({
                items: [expect.objectContaining({
                    variantId: 101,
                    variantSku: "INK-BLACK",
                })],
            }),
        );
    });

    it("creates low stock in-app notification before failed LINE delivery", async () => {
        vi.mocked(lineNotificationService.sendStockLowNotification).mockResolvedValue(
            false,
        );
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
        const lineOrder =
            vi.mocked(lineNotificationService.sendStockLowNotification).mock
                .invocationCallOrder[0];
        expect(inAppOrder).toBeLessThan(lineOrder);
    });

    it("skips notification when claim fails", async () => {
        prismaMock.notificationOutbox.findMany.mockResolvedValue(
            asNever([
                buildNotification(
                    104,
                    "TICKET_CREATED_LINE",
                    JSON.stringify({ ticketId: 1 }),
                    "ticket:1:created:line:it",
                ),
            ]),
        );
        prismaMock.notificationOutbox.updateMany
            .mockResolvedValueOnce(asNever({ count: 1 }))
            .mockResolvedValueOnce(asNever({ count: 1 }))
            .mockResolvedValueOnce(asNever({ count: 0 }));

        const result = await processOutbox();

        expect(result).toEqual({ processed: 0, failed: 0 });
        expect(sendTicketCreatedLineNotification).not.toHaveBeenCalled();
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
                    "TICKET_CREATED_EMAIL_REPORTER",
                    JSON.stringify({ ticketId: 1 }),
                    "ticket:1:created:email:reporter:1",
                ),
            ]),
        );
        prismaMock.ticket.findUnique.mockResolvedValue(asNever({ id: 1 }));
        vi.mocked(sendTicketCreatedReporterEmailNotification).mockRejectedValue(
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
                        "TICKET_CREATED_EMAIL_REPORTER",
                        JSON.stringify({ ticketId: 1 }),
                        "ticket:1:created:email:reporter:1",
                    ),
                    attempts: 2,
                },
            ]),
        );
        prismaMock.ticket.findUnique.mockResolvedValue(asNever({ id: 1 }));
        vi.mocked(sendTicketCreatedReporterEmailNotification).mockRejectedValue(
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
            .mockResolvedValueOnce(asNever([notification]))
            .mockResolvedValueOnce(asNever([]));

        await processOutbox();
        await processOutbox();

        expect(sendLeaveCancelledNotifications).toHaveBeenCalledTimes(1);
    });
});

