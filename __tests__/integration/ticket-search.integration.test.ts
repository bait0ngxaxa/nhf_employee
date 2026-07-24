import {
    Role,
    TicketCategory,
    TicketPriority,
    TicketStatus,
} from "@prisma/client";
import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
} from "vitest";

import { prisma } from "@/lib/db/prisma";
import { getTickets } from "@/lib/services/ticket/queries";
import { updateTicket } from "@/lib/services/ticket/mutations";

const TEST_EMAIL = "ticket-search-integration@example.com";

function assertDedicatedDatabase(): void {
    const rawUrl = process.env.DATABASE_URL;
    if (!rawUrl) throw new Error("ไม่พบ DATABASE_URL สำหรับ integration test");

    const url = new URL(rawUrl);
    const databaseName = decodeURIComponent(url.pathname.slice(1));
    if (
        url.protocol !== "mysql:"
        || !/(?:_integration|_test)$/.test(databaseName)
    ) {
        throw new Error(
            "ปฏิเสธการรัน: DATABASE_URL ไม่ใช่ฐาน integration test",
        );
    }
}

async function cleanTicketSearchFixture(): Promise<void> {
    await prisma.notificationOutbox.deleteMany();

    const user = await prisma.user.findUnique({
        where: { email: TEST_EMAIL },
        select: { id: true },
    });
    if (!user) return;

    await prisma.ticket.deleteMany({ where: { reportedById: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
}

describe.sequential("ticket search with real MySQL", () => {
    beforeAll(async () => {
        assertDedicatedDatabase();
        await prisma.$connect();
    });

    beforeEach(async () => {
        await cleanTicketSearchFixture();
    });

    afterAll(async () => {
        await cleanTicketSearchFixture();
        await prisma.$disconnect();
    });

    it("ค้นหา ticket ด้วย contains โดยไม่ส่ง mode ที่ MySQL ไม่รองรับ", async () => {
        const user = await prisma.user.create({
            data: {
                email: TEST_EMAIL,
                name: "Ticket Search Integration",
                password: "integration-test-only",
                role: Role.ADMIN,
            },
        });
        await prisma.ticket.create({
            data: {
                title: "Office PRINTER is offline",
                description: "เครื่องพิมพ์ชั้นสองใช้งานไม่ได้",
                category: TicketCategory.PRINTER,
                priority: TicketPriority.HIGH,
                reportedById: user.id,
            },
        });

        const result = await getTickets(
            { page: 1, limit: 10, search: "printer" },
            { id: user.id, role: user.role, email: user.email },
        );

        expect(result.pagination.total).toBe(1);
        expect(result.tickets).toHaveLength(1);
        expect(result.tickets[0]?.title).toBe("Office PRINTER is offline");
    });

    it("เก็บ resolvedAt เมื่อเปลี่ยนจาก RESOLVED เป็น CLOSED", async () => {
        const user = await prisma.user.create({
            data: {
                email: TEST_EMAIL,
                name: "Ticket Lifecycle Integration",
                password: "integration-test-only",
                role: Role.ADMIN,
            },
        });
        const ticket = await prisma.ticket.create({
            data: {
                title: "Lifecycle test",
                description: "ตรวจสอบ lifecycle timestamps",
                category: TicketCategory.SOFTWARE,
                priority: TicketPriority.HIGH,
                reportedById: user.id,
            },
        });
        const actor = { id: user.id, role: user.role, email: user.email };

        const resolved = await updateTicket(
            ticket.id,
            { status: TicketStatus.RESOLVED },
            actor,
        );
        const resolvedAt = resolved.ticket?.resolvedAt;
        expect(resolvedAt).toBeInstanceOf(Date);

        const closed = await updateTicket(
            ticket.id,
            { status: TicketStatus.CLOSED },
            actor,
        );

        expect(closed.ticket?.resolvedAt).toEqual(resolvedAt);
        expect(closed.ticket?.closedAt).toBeInstanceOf(Date);
        expect(closed.ticket?.cancelledAt).toBeNull();
    });

    it("ให้ optimistic locking ยอมรับ writer เดียวต่อ snapshot", async () => {
        const user = await prisma.user.create({
            data: {
                email: TEST_EMAIL,
                name: "Ticket OCC Integration",
                password: "integration-test-only",
                role: Role.ADMIN,
            },
        });
        const ticket = await prisma.ticket.create({
            data: {
                title: "OCC test",
                description: "ตรวจสอบ concurrent update",
                category: TicketCategory.SOFTWARE,
                priority: TicketPriority.HIGH,
                reportedById: user.id,
            },
        });

        const [first, second] = await Promise.all([
            prisma.ticket.updateMany({
                where: {
                    id: ticket.id,
                    status: ticket.status,
                    updatedAt: ticket.updatedAt,
                },
                data: { status: TicketStatus.RESOLVED },
            }),
            prisma.ticket.updateMany({
                where: {
                    id: ticket.id,
                    status: ticket.status,
                    updatedAt: ticket.updatedAt,
                },
                data: { status: TicketStatus.IN_PROGRESS },
            }),
        ]);

        expect(first.count + second.count).toBe(1);
    });
});
