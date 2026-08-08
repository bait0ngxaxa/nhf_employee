import bcrypt from "bcryptjs";
import crypto from "crypto";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { POST as resetPasswordRoute } from "@/app/api/auth/reset-password/route";
import { prisma } from "@/lib/db/prisma";

const TEST_EMAIL = "password-reset-concurrency@thainhf.org";

function assertDedicatedDatabase(): void {
    const rawUrl = process.env.DATABASE_URL;
    if (!rawUrl) throw new Error("ไม่พบ DATABASE_URL สำหรับ integration test");
    const url = new URL(rawUrl);
    const databaseName = decodeURIComponent(url.pathname.slice(1));
    if (url.protocol !== "mysql:" || !/(?:_integration|_test)$/.test(databaseName)) {
        throw new Error("ปฏิเสธการรัน: DATABASE_URL ไม่ใช่ฐาน integration test");
    }
}

function hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
}

function buildRequest(token: string, password: string): NextRequest {
    return new NextRequest("http://localhost/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
            token,
            password,
            confirmPassword: password,
        }),
    });
}

async function cleanFixtures(): Promise<void> {
    await prisma.auditLog.deleteMany({ where: { userEmail: TEST_EMAIL } });
    await prisma.passwordResetToken.deleteMany({ where: { email: TEST_EMAIL } });
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
}

describe.sequential("password reset token concurrency with real MySQL", () => {
    beforeAll(async () => {
        assertDedicatedDatabase();
        await prisma.$connect();
    });

    beforeEach(cleanFixtures);

    afterAll(async () => {
        await cleanFixtures();
        await prisma.$disconnect();
    });

    it("allows exactly one concurrent request to consume the same token", async () => {
        const rawToken = "concurrent-reset-token";
        const firstPassword = "FirstWinner1";
        const secondPassword = "SecondWinner1";
        const initialPassword = await bcrypt.hash("InitialPass1", 4);
        const user = await prisma.user.create({
            data: {
                email: TEST_EMAIL,
                name: "Password Reset Concurrency",
                password: initialPassword,
            },
        });
        await prisma.passwordResetToken.create({
            data: {
                token: hashToken(rawToken),
                email: TEST_EMAIL,
                expiresAt: new Date(Date.now() + 60_000),
            },
        });

        const responses = await Promise.all([
            resetPasswordRoute(buildRequest(rawToken, firstPassword)),
            resetPasswordRoute(buildRequest(rawToken, secondPassword)),
        ]);
        const successfulIndexes = responses
            .map((response, index) => response.status === 200 ? index : -1)
            .filter((index) => index >= 0);

        expect(successfulIndexes).toHaveLength(1);
        expect(responses.filter((response) => response.status === 400)).toHaveLength(1);

        const updatedUser = await prisma.user.findUniqueOrThrow({
            where: { id: user.id },
            select: { password: true, tokenVersion: true },
        });
        const winnerPassword = successfulIndexes[0] === 0
            ? firstPassword
            : secondPassword;
        const loserPassword = successfulIndexes[0] === 0
            ? secondPassword
            : firstPassword;

        await expect(bcrypt.compare(winnerPassword, updatedUser.password)).resolves.toBe(true);
        await expect(bcrypt.compare(loserPassword, updatedUser.password)).resolves.toBe(false);
        expect(updatedUser.tokenVersion).toBe(2);
    });
});
