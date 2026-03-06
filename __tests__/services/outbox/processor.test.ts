import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NotificationOutbox, PrismaClient } from "@prisma/client";
import { mockDeep, mockReset } from "vitest-mock-extended";
import { lineNotificationService } from "@/lib/line";
import { prisma } from "@/lib/prisma";
import { processOutbox } from "@/lib/services/outbox/processor";
import {
    sendTicketCreatedNotifications,
    sendTicketUpdatedNotifications,
} from "@/lib/services/ticket/notifications";

vi.mock("@/lib/prisma", () => ({
    prisma: mockDeep<PrismaClient>(),
}));

vi.mock("@/lib/services/ticket/notifications", () => ({
    sendTicketCreatedNotifications: vi.fn(),
    sendTicketUpdatedNotifications: vi.fn(),
}));

vi.mock("@/lib/line", () => ({
    lineNotificationService: {
        sendEmailRequestNotification: vi.fn(),
    },
}));

const prismaMock = prisma as unknown as ReturnType<
    typeof mockDeep<PrismaClient>
>;

function buildNotification(
    id: number,
    type: string,
    payload: string,
): NotificationOutbox {
    return {
        id,
        type,
        payload,
        status: "PENDING",
        attempts: 0,
        error: null,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
}

function asNever<T>(value: T): never {
    return value as unknown as never;
}

describe("processOutbox", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
        prismaMock.notificationOutbox.updateMany.mockResolvedValue(
            asNever({ count: 1 }),
        );
    });

    it("returns early when no pending notifications", async () => {
        prismaMock.notificationOutbox.findMany.mockResolvedValue(asNever([]));

        const result = await processOutbox();

        expect(result).toEqual({ processed: 0, failed: 0 });
        expect(prismaMock.notificationOutbox.updateMany).toHaveBeenCalledTimes(1);
    });

    it("processes TICKET_CREATED successfully", async () => {
        prismaMock.notificationOutbox.findMany.mockResolvedValue(
            asNever([
                buildNotification(100, "TICKET_CREATED", JSON.stringify({ ticketId: 1 })),
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
        expect(sendTicketCreatedNotifications).toHaveBeenCalledTimes(1);
        expect(prismaMock.notificationOutbox.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 100, status: "PROCESSING" },
                data: expect.objectContaining({ status: "SENT" }),
            }),
        );
    });

    it("processes TICKET_UPDATED successfully", async () => {
        prismaMock.notificationOutbox.findMany.mockResolvedValue(
            asNever([
                buildNotification(
                    101,
                    "TICKET_UPDATED",
                    JSON.stringify({ ticketId: 1, oldStatus: "OPEN" }),
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
                status: "RESOLVED",
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
        expect(sendTicketUpdatedNotifications).toHaveBeenCalledWith(
            expect.objectContaining({ id: 1 }),
            "OPEN",
        );
    });

    it("processes EMAIL_REQUEST successfully", async () => {
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
    });

    it("marks notification FAILED when dispatch throws", async () => {
        prismaMock.notificationOutbox.findMany.mockResolvedValue(
            asNever([
                buildNotification(103, "TICKET_CREATED", JSON.stringify({ ticketId: 1 })),
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
        vi.mocked(sendTicketCreatedNotifications).mockRejectedValue(
            new Error("Network failure"),
        );

        const result = await processOutbox();

        expect(result).toEqual({ processed: 0, failed: 1 });
        expect(prismaMock.notificationOutbox.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 103, status: "PROCESSING" },
                data: expect.objectContaining({
                    status: "FAILED",
                    error: "Network failure",
                }),
            }),
        );
    });

    it("skips notification when claim fails", async () => {
        prismaMock.notificationOutbox.findMany.mockResolvedValue(
            asNever([
                buildNotification(104, "TICKET_CREATED", JSON.stringify({ ticketId: 1 })),
            ]),
        );
        prismaMock.notificationOutbox.updateMany
            .mockResolvedValueOnce(asNever({ count: 1 }))
            .mockResolvedValueOnce(asNever({ count: 0 }));

        const result = await processOutbox();

        expect(result).toEqual({ processed: 0, failed: 0 });
        expect(sendTicketCreatedNotifications).not.toHaveBeenCalled();
    });
});

