import {
    Role,
    TicketCategory,
    TicketPriority,
} from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { getTickets } from "@/lib/services/ticket/queries";

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
});
