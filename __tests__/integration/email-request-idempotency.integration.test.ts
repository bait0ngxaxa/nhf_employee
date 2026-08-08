import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { createEmailRequest } from "@/lib/services/email-request/mutations";
import type { CreateEmailRequestData } from "@/lib/services/email-request/types";

const TEST_EMAIL = "email-request-idempotency@integration.test";

function assertDedicatedDatabase(): void {
    const rawUrl = process.env.DATABASE_URL;
    if (!rawUrl) throw new Error("ไม่พบ DATABASE_URL สำหรับ integration test");
    const url = new URL(rawUrl);
    const databaseName = decodeURIComponent(url.pathname.slice(1));
    if (url.protocol !== "mysql:" || !/(?:_integration|_test)$/.test(databaseName)) {
        throw new Error("ปฏิเสธการรัน: DATABASE_URL ไม่ใช่ฐาน integration test");
    }
}

async function cleanEmailRequestFixtures(): Promise<void> {
    await prisma.emailRequestIdempotency.deleteMany({
        where: { user: { email: TEST_EMAIL } },
    });
    await prisma.emailRequest.deleteMany({
        where: { user: { email: TEST_EMAIL } },
    });
    await prisma.notificationOutbox.deleteMany({
        where: { type: "EMAIL_REQUEST" },
    });
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
}

describe.sequential("email request idempotency with real MySQL", () => {
    beforeAll(async () => {
        assertDedicatedDatabase();
        await prisma.$connect();
    });

    beforeEach(cleanEmailRequestFixtures);

    afterAll(async () => {
        await cleanEmailRequestFixtures();
        await prisma.$disconnect();
    });

    it("creates one business request and one outbox event for concurrent same-key calls", async () => {
        const user = await prisma.user.create({
            data: {
                email: TEST_EMAIL,
                name: "Email Request Integration",
                password: "integration-test-only",
                role: "ADMIN",
            },
        });
        const data: CreateEmailRequestData = {
            thaiName: "สมชาย ทดสอบ",
            englishName: "Somchai Integration",
            phone: "081-2345678",
            nickname: "ชาย",
            position: "เจ้าหน้าที่",
            department: "มสช.",
            replyEmail: "somchai@example.com",
            needsDocumentSystem: true,
            sharedDriveAccess: ["it", "account"],
        };
        const actor = { id: user.id, email: user.email, role: user.role };

        const results = await Promise.all([
            createEmailRequest(data, actor, { idempotencyKey: "concurrent-key" }),
            createEmailRequest(data, actor, { idempotencyKey: "concurrent-key" }),
        ]);
        const requestIds = results.map((result) => result.emailRequest?.id);
        const emailRequestId = requestIds[0];

        expect(new Set(requestIds).size).toBe(1);
        expect(results.filter((result) => result.replayed)).toHaveLength(1);
        expect(await prisma.emailRequest.count({
            where: { requestedBy: user.id },
        })).toBe(1);
        expect(await prisma.emailRequestIdempotency.count({
            where: { userId: user.id, idempotencyKey: "concurrent-key" },
        })).toBe(1);
        expect(await prisma.notificationOutbox.count({
            where: { eventKey: `email-request:${emailRequestId}:created` },
        })).toBe(1);
    });
});
