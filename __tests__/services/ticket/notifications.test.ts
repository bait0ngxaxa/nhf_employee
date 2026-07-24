import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { mockDeep, mockReset } from "vitest-mock-extended";

import { emailService } from "@/lib/email";
import { lineNotificationService } from "@/lib/line";
import { prisma } from "@/lib/db/prisma";
import {
    sendTicketCreatedInAppNotification,
    sendTicketCreatedLineNotification,
    sendTicketUpdatedInAppNotification,
    sendTicketUpdatedReporterEmailNotification,
} from "@/lib/services/ticket/notifications";
import type { TicketWithRelations } from "@/lib/services/ticket/types";

vi.mock("@/lib/db/prisma", () => ({
    prisma: mockDeep<PrismaClient>(),
}));

vi.mock("@/lib/email", () => ({
    emailService: {
        sendNewTicketNotification: vi.fn(),
        sendStatusUpdateNotification: vi.fn(),
        sendITTeamNotification: vi.fn(),
    },
}));

vi.mock("@/lib/line", () => ({
    lineNotificationService: {
        sendITTeamNotification: vi.fn(),
        sendNewTicketNotification: vi.fn(),
        sendStatusUpdateNotification: vi.fn(),
    },
}));

const prismaMock = prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>;

function asNever<T>(value: T): never {
    return value as unknown as never;
}

function buildTicket(): TicketWithRelations {
    return {
        id: 123,
        title: "Printer not working",
        description: "Cannot print from floor 2",
        category: "HARDWARE",
        priority: "HIGH",
        status: "OPEN",
        reportedById: 9,
        assignedToId: null,
        resolvedAt: null,
        createdAt: new Date("2026-07-01T03:00:00.000Z"),
        updatedAt: new Date("2026-07-01T03:00:00.000Z"),
        reportedBy: {
            id: 9,
            name: "Fallback Reporter",
            email: "reporter@example.com",
            role: "USER",
            employee: {
                firstName: "สมชาย",
                lastName: "ใจดี",
                dept: { name: "IT" },
            },
        },
        assignedTo: null,
    } as unknown as TicketWithRelations;
}

describe("ticket notification delivery", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
        prismaMock.user.findMany.mockResolvedValue(asNever([{ id: 1 }]));
        prismaMock.notification.create.mockResolvedValue(asNever({ id: "n-1" }));
        vi.mocked(emailService.sendNewTicketNotification).mockResolvedValue(true);
        vi.mocked(emailService.sendStatusUpdateNotification).mockResolvedValue(true);
        vi.mocked(emailService.sendITTeamNotification).mockResolvedValue(true);
        vi.mocked(lineNotificationService.sendITTeamNotification).mockResolvedValue(true);
        vi.mocked(lineNotificationService.sendNewTicketNotification).mockResolvedValue(true);
        vi.mocked(lineNotificationService.sendStatusUpdateNotification).mockResolvedValue(true);
    });

    it("keeps created in-app delivery independent from failed LINE delivery", async () => {
        vi.mocked(lineNotificationService.sendITTeamNotification).mockResolvedValue(false);

        await sendTicketCreatedInAppNotification(buildTicket(), "created-in-app");
        await expect(sendTicketCreatedLineNotification(buildTicket())).rejects.toThrow(
            "TICKET_CREATED LINE notification failed",
        );

        expect(prismaMock.notification.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                userId: 1,
                type: "TICKET_CREATED",
                referenceId: "123",
                title: "คำขอ IT Support ใหม่",
            }),
        });

        expect(emailService.sendNewTicketNotification).not.toHaveBeenCalled();
    });

    it("keeps status in-app delivery independent from failed email delivery", async () => {
        vi.mocked(emailService.sendStatusUpdateNotification).mockResolvedValue(false);
        const ticket = { ...buildTicket(), status: "IN_PROGRESS" as const };

        await sendTicketUpdatedInAppNotification(
            ticket,
            "OPEN",
            "updated-in-app",
        );
        await expect(
            sendTicketUpdatedReporterEmailNotification(ticket, "OPEN"),
        ).rejects.toThrow("TICKET_UPDATED reporter email notification failed");

        expect(prismaMock.notification.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                userId: 9,
                type: "TICKET_UPDATED",
                referenceId: "123",
                title: "สถานะคำขอ IT Support อัปเดต",
            }),
        });

        expect(
            lineNotificationService.sendStatusUpdateNotification,
        ).not.toHaveBeenCalled();
    });
});
