import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as getNotifications } from "@/app/api/notifications/route";
import { PATCH as markAsRead } from "@/app/api/notifications/[id]/read/route";
import { POST as markAllAsRead } from "@/app/api/notifications/mark-all-read/route";
import { getApiAuthSession } from "@/lib/server-auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

// Mock auth resolver
vi.mock("@/lib/server-auth", () => ({
    getApiAuthSession: vi.fn(),
}));

// Mock prisma
vi.mock("@/lib/prisma", () => ({
    prisma: {
        notification: {
            findMany: vi.fn(),
            count: vi.fn(),
            update: vi.fn(),
            updateMany: vi.fn(),
        },
    },
}));

describe("Notification API Routes", () => {
    const mockUser = {
        id: "1",
        name: "Test User",
        email: "test@example.com",
        role: "USER",
    };
    const mockGetApiAuthSession = vi.mocked(getApiAuthSession);
    const mockFindMany = vi.mocked(prisma.notification.findMany);
    const mockCount = vi.mocked(prisma.notification.count);
    const mockUpdate = vi.mocked(prisma.notification.update);
    const mockUpdateMany = vi.mocked(prisma.notification.updateMany);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("GET /api/notifications", () => {
        it("should return unauthorized if no session exists", async () => {
            mockGetApiAuthSession.mockResolvedValue(null);
            const req = new NextRequest("http://localhost/api/notifications");
            const res = await getNotifications(req);
            
            expect(res.status).toBe(401);
            const data = await res.json();
            expect(data.error).toBe("Unauthorized");
        });

        it("should return notifications and unread count for authenticated user", async () => {
            mockGetApiAuthSession.mockResolvedValue({ user: mockUser });
            
            const mockNotifications = [
                { id: "1", title: "Test 1", message: "Msg 1", isRead: false, createdAt: new Date() },
                { id: "2", title: "Test 2", message: "Msg 2", isRead: true, createdAt: new Date() },
            ];
            
            mockFindMany.mockResolvedValue(mockNotifications as never);
            mockCount.mockResolvedValue(1);

            const req = new NextRequest("http://localhost/api/notifications");
            const res = await getNotifications(req);
            
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.notifications).toHaveLength(2);
            expect(data.unreadCount).toBe(1);
            
            expect(prisma.notification.findMany).toHaveBeenCalledWith(expect.objectContaining({
                where: { userId: 1 },
                orderBy: { createdAt: "desc" },
                take: 10
            }));
        });
    });

    describe("PATCH /api/notifications/[id]/read", () => {
        it("should mark a single notification as read", async () => {
            mockGetApiAuthSession.mockResolvedValue({ user: mockUser });
            
            const mockNotificationId = "notif-123";
            const params = Promise.resolve({ id: mockNotificationId });

            mockUpdate.mockResolvedValue({
                id: mockNotificationId,
                isRead: true,
            } as never);

            const req = new NextRequest(`http://localhost/api/notifications/${mockNotificationId}/read`, {
                method: "PATCH"
            });
            
            const res = await markAsRead(req, { params });
            
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
            
            expect(prisma.notification.update).toHaveBeenCalledWith({
                where: { id: mockNotificationId, userId: 1 },
                data: { isRead: true }
            });
        });

        it("should return unauthorized for patch without session", async () => {
            mockGetApiAuthSession.mockResolvedValue(null);
            const params = Promise.resolve({ id: "123" });
            const req = new NextRequest("http://localhost/api/notifications/123/read", { method: "PATCH" });
            
            const res = await markAsRead(req, { params });
            expect(res.status).toBe(401);
        });
    });

    describe("POST /api/notifications/mark-all-read", () => {
        it("should mark all user's notifications as read", async () => {
            mockGetApiAuthSession.mockResolvedValue({ user: mockUser });
            mockUpdateMany.mockResolvedValue({ count: 5 } as never);

            const req = new NextRequest("http://localhost/api/notifications/mark-all-read", {
                method: "POST"
            });
            
            const res = await markAllAsRead(req);
            
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
            expect(data.updatedCount).toBe(5);
            
            expect(prisma.notification.updateMany).toHaveBeenCalledWith({
                where: { userId: 1, isRead: false },
                data: { isRead: true }
            });
        });
    });
});
