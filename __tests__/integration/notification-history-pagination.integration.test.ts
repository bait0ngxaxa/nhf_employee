import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import {
    listHistoryForUser,
} from "@/modules/notification";
import type {
    NotificationHistoryResult,
} from "@/modules/notification";

const TEST_EMAIL = "notification-history-pagination@integration.test";
const CREATED_AT = new Date("2026-09-09T10:00:00.000Z");

function assertDedicatedDatabase(): void {
    const rawUrl = process.env.DATABASE_URL;
    if (!rawUrl) {
        throw new Error("DATABASE_URL is required for integration tests");
    }

    const url = new URL(rawUrl);
    const databaseName = decodeURIComponent(url.pathname.slice(1));
    if (
        url.protocol !== "mysql:"
        || !/(?:_integration|_test)$/.test(databaseName)
    ) {
        throw new Error(
            "Refusing to run: DATABASE_URL is not a dedicated integration database",
        );
    }
}

async function cleanFixture(): Promise<void> {
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
}

type NotificationSeed = {
    createdAt: Date;
    isRead?: boolean;
    referenceId: string;
};

async function seedNotifications(
    userId: number,
    rows: readonly NotificationSeed[],
): Promise<void> {
    await prisma.notification.createMany({
        data: rows.map((row) => ({
            userId,
            type: "SYSTEM_ALERT" as const,
            title: row.referenceId,
            message: row.referenceId,
            actionUrl: null,
            referenceId: row.referenceId,
            dedupeKey: row.referenceId,
            isRead: row.isRead ?? false,
            createdAt: row.createdAt,
        })),
    });
}

async function expectedNotificationIds(
    userId: number,
    filter: string,
): Promise<string[]> {
    const rows = await prisma.notification.findMany({
        where: {
            userId,
            ...(filter === "unread" ? { isRead: false } : {}),
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { id: true },
    });

    return rows.map(({ id }) => id);
}

async function paginateHistory(
    userId: number,
    filter: string,
): Promise<{ pages: NotificationHistoryResult[]; ids: string[] }> {
    const pages: NotificationHistoryResult[] = [];
    const ids: string[] = [];
    let cursor: string | null = null;

    for (let pageNumber = 0; pageNumber < 10; pageNumber += 1) {
        const page = await listHistoryForUser({ userId, filter, cursor });
        pages.push(page);
        ids.push(...page.notifications.map(({ id }) => id));

        if (!page.hasMore) {
            expect(page.nextCursor).toBeNull();
            return { pages, ids };
        }

        expect(page.nextCursor).not.toBeNull();
        cursor = page.nextCursor;
    }

    throw new Error("Notification history pagination did not terminate");
}

describe.sequential("Notification history pagination with real MySQL", () => {
    let userId: number;

    beforeAll(async () => {
        assertDedicatedDatabase();
        await prisma.$connect();
    });

    beforeEach(async () => {
        await cleanFixture();
        const user = await prisma.user.create({
            data: {
                email: TEST_EMAIL,
                name: "Notification Pagination Test",
                password: "integration-only",
            },
            select: { id: true },
        });
        userId = user.id;

        await seedNotifications(
            userId,
            Array.from({ length: 21 }, (_, index) => ({
                referenceId: `notification-history-${index}`,
                createdAt: CREATED_AT,
            })),
        );
    });

    afterAll(async () => {
        await cleanFixture();
        await prisma.$disconnect();
    });

    it("reaches all 21 equal-timestamp rows across history pages", async () => {
        const result = await paginateHistory(userId, "all");
        const expectedIds = await expectedNotificationIds(userId, "all");

        expect(result.pages.map(({ notifications }) => notifications.length)).toEqual([20, 1]);
        expect(result.ids).toEqual(expectedIds);
        expect(new Set(result.ids).size).toBe(21);
    });

    it("keeps unread filtering while paginating tied timestamps", async () => {
        await seedNotifications(userId, [
            {
                referenceId: "notification-history-read-1",
                createdAt: CREATED_AT,
                isRead: true,
            },
            {
                referenceId: "notification-history-read-2",
                createdAt: CREATED_AT,
                isRead: true,
            },
        ]);

        const result = await paginateHistory(userId, "unread");
        const expectedIds = await expectedNotificationIds(userId, "unread");

        expect(result.pages.map(({ notifications }) => notifications.length)).toEqual([20, 1]);
        expect(result.ids).toEqual(expectedIds);
        expect(result.ids).not.toContain(
            (await prisma.notification.findFirstOrThrow({
                where: { userId, isRead: true },
                select: { id: true },
            })).id,
        );
    });

    it("keeps mixed-timestamp history ordered and complete", async () => {
        await prisma.notification.deleteMany({ where: { userId } });
        const baseTime = CREATED_AT.getTime();
        await seedNotifications(
            userId,
            Array.from({ length: 23 }, (_, index) => ({
                referenceId: `notification-history-mixed-${index}`,
                createdAt: new Date(baseTime - index * 1000),
            })),
        );

        const result = await paginateHistory(userId, "all");
        const expectedIds = await expectedNotificationIds(userId, "all");

        expect(result.pages.map(({ notifications }) => notifications.length)).toEqual([20, 3]);
        expect(result.ids).toEqual(expectedIds);
        expect(new Set(result.ids).size).toBe(23);
    });
});
