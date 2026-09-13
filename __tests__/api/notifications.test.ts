import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET as getAllNotifications } from "@/app/api/notifications/all/route";
import { PATCH as markAsRead } from "@/app/api/notifications/[id]/read/route";
import { POST as markAllAsRead } from "@/app/api/notifications/mark-all-read/route";
import { GET as getNotifications } from "@/app/api/notifications/route";
import { getApiAuthSession } from "@/lib/auth/server";
import {
    listHistoryForUser,
    listLatestForUser,
    markAllReadForUser,
    markReadForUser,
} from "@/modules/notification";

const notificationMocks = vi.hoisted(() => ({
    createForUserOnce: vi.fn(),
    listHistoryForUser: vi.fn(),
    listLatestForUser: vi.fn(),
    markAllReadForUser: vi.fn(),
    markReadForUser: vi.fn(),
    buildNotificationAuthorizationContext: vi.fn(),
    assertNotificationCapabilityForMigration: vi.fn(),
    assertNotificationCapabilityScope: vi.fn(),
    NotificationCapabilityDeniedError: class NotificationCapabilityDeniedError extends Error {
        readonly statusCode = 403;

        constructor(
            readonly capability: string,
            readonly authorizationReason: string,
        ) {
            super("Forbidden");
        }
    },
}));

vi.mock("@/lib/auth/server", () => ({
    getApiAuthSession: vi.fn(),
}));

vi.mock("@/modules/notification", () => notificationMocks);

describe("Notification API Routes", () => {
    const mockUser = {
        id: "1",
        name: "Test User",
        email: "test@example.com",
        role: "USER",
    };
    const mockGetApiAuthSession = vi.mocked(getApiAuthSession);
    const mockListLatestForUser = vi.mocked(listLatestForUser);
    const mockListHistoryForUser = vi.mocked(listHistoryForUser);
    const mockMarkReadForUser = vi.mocked(markReadForUser);
    const mockMarkAllReadForUser = vi.mocked(markAllReadForUser);

    beforeEach(() => {
        vi.clearAllMocks();
        mockListLatestForUser.mockResolvedValue({ notifications: [], unreadCount: 0 });
        mockListHistoryForUser.mockResolvedValue({
            notifications: [],
            nextCursor: null,
            hasMore: false,
            totalCount: 0,
        });
        mockMarkReadForUser.mockResolvedValue({} as never);
        mockMarkAllReadForUser.mockResolvedValue(0);
        notificationMocks.buildNotificationAuthorizationContext.mockImplementation(
            (user: { id: number; role: string }) => ({
                authorizationActor: {
                    userId: user.id,
                    employeeId: null,
                    systemRole: user.role,
                    channel: "DASHBOARD",
                },
            }),
        );
        notificationMocks.assertNotificationCapabilityForMigration.mockImplementation(
            async (
                context: {
                    authorizationActor: {
                        userId: number;
                        employeeId: number | null;
                        systemRole: string;
                        channel: string;
                    };
                },
                capability: string,
            ) => ({
                actor: context.authorizationActor,
                capability,
                decision: {
                    capability,
                    allowed: true,
                    scopes: ["OWN"],
                    grants: [],
                },
                scopes: ["OWN"],
                usedMigrationCompatibility: false,
            }),
        );
        notificationMocks.assertNotificationCapabilityScope.mockImplementation(
            (authorization) => authorization,
        );
    });

    describe("GET /api/notifications", () => {
        it("returns unauthorized if no session exists", async () => {
            mockGetApiAuthSession.mockResolvedValue(null);
            const req = new NextRequest("http://localhost/api/notifications");

            const res = await getNotifications(req);

            expect(res.status).toBe(401);
            const data = await res.json();
            expect(data.error).toBe("Unauthorized");
        });

        it("returns a bad-request response for an invalid numeric user session", async () => {
            mockGetApiAuthSession.mockResolvedValue({
                user: { ...mockUser, id: "not-a-number" },
            } as never);
            const req = new NextRequest("http://localhost/api/notifications");

            const res = await getNotifications(req);

            expect(res.status).toBe(400);
            expect(mockListLatestForUser).not.toHaveBeenCalled();
        });

        it("returns notifications and unread count for the authenticated user", async () => {
            mockGetApiAuthSession.mockResolvedValue({ user: mockUser } as never);
            const notifications = [
                { id: "1", title: "Test 1", message: "Msg 1", isRead: false },
                { id: "2", title: "Test 2", message: "Msg 2", isRead: true },
            ];
            mockListLatestForUser.mockResolvedValue({ notifications, unreadCount: 1 } as never);

            const req = new NextRequest(
                "http://localhost/api/notifications?userId=2",
            );
            const res = await getNotifications(req);

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.notifications).toEqual(notifications);
            expect(data.unreadCount).toBe(1);
            expect(mockListLatestForUser).toHaveBeenCalledWith(1);
            expect(
                notificationMocks.assertNotificationCapabilityForMigration,
            ).toHaveBeenCalledWith(
                expect.objectContaining({
                    authorizationActor: expect.objectContaining({
                        userId: 1,
                        systemRole: "USER",
                        channel: "DASHBOARD",
                    }),
                }),
                "notification.inbox.read",
            );
            expect(notificationMocks.assertNotificationCapabilityScope).toHaveBeenCalledWith(
                expect.anything(),
                "OWN",
            );
        });

        it("does not execute a read query when the read capability is denied", async () => {
            mockGetApiAuthSession.mockResolvedValue({ user: mockUser } as never);
            notificationMocks.assertNotificationCapabilityForMigration.mockRejectedValue(
                new notificationMocks.NotificationCapabilityDeniedError(
                    "notification.inbox.read",
                    "CHANNEL_NOT_SUPPORTED",
                ),
            );

            const req = new NextRequest("http://localhost/api/notifications");
            const res = await getNotifications(req);

            expect(res.status).toBe(403);
            expect(mockListLatestForUser).not.toHaveBeenCalled();
        });

        it("keeps the sanitized error response when the Notification query fails", async () => {
            mockGetApiAuthSession.mockResolvedValue({ user: mockUser } as never);
            mockListLatestForUser.mockRejectedValue(new Error("database details"));
            const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

            try {
                const req = new NextRequest("http://localhost/api/notifications");
                const res = await getNotifications(req);

                expect(res.status).toBe(500);
                const data = await res.json();
                expect(data.error).toBeDefined();
            } finally {
                errorSpy.mockRestore();
            }
        });
    });

    describe("GET /api/notifications/all", () => {
        it("keeps the response shape when loading the first all-history page", async () => {
            mockGetApiAuthSession.mockResolvedValue({ user: mockUser } as never);
            const result = {
                notifications: [{ id: "notification-1" }],
                nextCursor: null,
                hasMore: false,
                totalCount: 1,
            };
            mockListHistoryForUser.mockResolvedValue(result as never);

            const req = new NextRequest(
                "http://localhost/api/notifications/all?filter=all",
            );
            const res = await getAllNotifications(req);

            expect(res.status).toBe(200);
            expect(await res.json()).toEqual(result);
            expect(mockListHistoryForUser).toHaveBeenCalledWith({
                userId: 1,
                filter: "all",
                cursor: null,
            });
            expect(
                notificationMocks.assertNotificationCapabilityForMigration,
            ).toHaveBeenCalledWith(expect.anything(), "notification.inbox.read");
        });

        it("passes a new opaque composite cursor unchanged for all history", async () => {
            mockGetApiAuthSession.mockResolvedValue({ user: mockUser } as never);
            const compositeCursor = Buffer.from(JSON.stringify({
                v: 1,
                createdAt: "2026-08-01T00:00:00.000Z",
                id: "notification-1",
            }), "utf8").toString("base64url");
            const result = {
                notifications: [{ id: "notification-1" }],
                nextCursor: compositeCursor,
                hasMore: true,
                totalCount: 21,
            };
            mockListHistoryForUser.mockResolvedValue(result as never);

            const req = new NextRequest(
                `http://localhost/api/notifications/all?filter=all&cursor=${encodeURIComponent(compositeCursor)}`,
            );
            const res = await getAllNotifications(req);

            expect(res.status).toBe(200);
            expect(await res.json()).toEqual(result);
            expect(mockListHistoryForUser).toHaveBeenCalledWith({
                userId: 1,
                filter: "all",
                cursor: compositeCursor,
            });
        });

        it("keeps legacy ISO timestamp cursors for unread history", async () => {
            mockGetApiAuthSession.mockResolvedValue({ user: mockUser } as never);
            const legacyCursor = "2026-09-01T00:00:00.000Z";
            const result = {
                notifications: [{ id: "notification-1" }],
                nextCursor: legacyCursor,
                hasMore: true,
                totalCount: 21,
            };
            mockListHistoryForUser.mockResolvedValue(result as never);

            const req = new NextRequest(
                `http://localhost/api/notifications/all?filter=unread&cursor=${legacyCursor}`,
            );
            const res = await getAllNotifications(req);

            expect(res.status).toBe(200);
            expect(await res.json()).toEqual(result);
            expect(mockListHistoryForUser).toHaveBeenCalledWith({
                userId: 1,
                filter: "unread",
                cursor: legacyCursor,
            });
        });
    });

    describe("PATCH /api/notifications/[id]/read", () => {
        it("marks a single notification as read for the authenticated user", async () => {
            mockGetApiAuthSession.mockResolvedValue({ user: mockUser } as never);
            const notification = { id: "notif-123", isRead: true };
            mockMarkReadForUser.mockResolvedValue(notification as never);
            const params = Promise.resolve({ id: "notif-123" });
            const req = new NextRequest("http://localhost/api/notifications/notif-123/read", {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ userId: 2 }),
            });

            const res = await markAsRead(req, { params });

            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({ success: true, notification });
            expect(mockMarkReadForUser).toHaveBeenCalledWith("notif-123", 1);
            expect(
                notificationMocks.assertNotificationCapabilityForMigration,
            ).toHaveBeenCalledWith(expect.anything(), "notification.inbox.update");
        });

        it("does not allow the read capability to authorize a mutation", async () => {
            mockGetApiAuthSession.mockResolvedValue({ user: mockUser } as never);
            notificationMocks.assertNotificationCapabilityForMigration.mockImplementation(
                async (_context: unknown, capability: string) => {
                    if (capability === "notification.inbox.update") {
                        throw new notificationMocks.NotificationCapabilityDeniedError(
                            capability,
                            "NO_APPLICABLE_GRANT",
                        );
                    }
                    return {};
                },
            );

            const res = await markAsRead(
                new NextRequest("http://localhost/api/notifications/notif-123/read", {
                    method: "PATCH",
                }),
                { params: Promise.resolve({ id: "notif-123" }) },
            );

            expect(res.status).toBe(403);
            expect(mockMarkReadForUser).not.toHaveBeenCalled();
        });

        it("returns unauthorized for patch without a session", async () => {
            mockGetApiAuthSession.mockResolvedValue(null);
            const params = Promise.resolve({ id: "123" });
            const req = new NextRequest("http://localhost/api/notifications/123/read", {
                method: "PATCH",
            });

            const res = await markAsRead(req, { params });

            expect(res.status).toBe(401);
        });

        it("keeps the generic mark-read error response for persistence failures", async () => {
            mockGetApiAuthSession.mockResolvedValue({ user: mockUser } as never);
            mockMarkReadForUser.mockRejectedValue(new Error("database details"));
            const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

            try {
                const req = new NextRequest("http://localhost/api/notifications/123/read", {
                    method: "PATCH",
                });
                const res = await markAsRead(req, { params: Promise.resolve({ id: "123" }) });

                expect(res.status).toBe(500);
            } finally {
                errorSpy.mockRestore();
            }
        });
    });

    describe("POST /api/notifications/mark-all-read", () => {
        it("returns the count from the user-scoped mark-all command", async () => {
            mockGetApiAuthSession.mockResolvedValue({ user: mockUser } as never);
            mockMarkAllReadForUser.mockResolvedValue(5);
            const req = new NextRequest("http://localhost/api/notifications/mark-all-read", {
                method: "POST",
            });

            const res = await markAllAsRead(req);

            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({ success: true, updatedCount: 5 });
            expect(mockMarkAllReadForUser).toHaveBeenCalledWith(1);
            expect(
                notificationMocks.assertNotificationCapabilityForMigration,
            ).toHaveBeenCalledWith(expect.anything(), "notification.inbox.update");
        });

        it("keeps zero unread rows as a successful result", async () => {
            mockGetApiAuthSession.mockResolvedValue({ user: mockUser } as never);
            mockMarkAllReadForUser.mockResolvedValue(0);
            const req = new NextRequest("http://localhost/api/notifications/mark-all-read", {
                method: "POST",
            });

            const res = await markAllAsRead(req);

            expect(res.status).toBe(200);
            expect(await res.json()).toEqual({ success: true, updatedCount: 0 });
        });

        it("keeps the generic mark-all error response for persistence failures", async () => {
            mockGetApiAuthSession.mockResolvedValue({ user: mockUser } as never);
            mockMarkAllReadForUser.mockRejectedValue(new Error("database details"));
            const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

            try {
                const req = new NextRequest("http://localhost/api/notifications/mark-all-read", {
                    method: "POST",
                });
                const res = await markAllAsRead(req);

                expect(res.status).toBe(500);
            } finally {
                errorSpy.mockRestore();
            }
        });
    });
});
