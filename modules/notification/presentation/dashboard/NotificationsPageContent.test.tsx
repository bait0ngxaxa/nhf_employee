import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiGet, apiPatch, apiPost } from "@/lib/client/api-client";
import type { ApiResponse } from "@/lib/client/api-client";
import { API_ROUTES } from "@/lib/ssot/routes";
import { NotificationsSection } from "./NotificationsPageContent";
import type {
    NotificationItem,
    NotificationsResponse,
} from "./NotificationShared";

const routerPush = vi.hoisted(() => vi.fn());

vi.mock("@/lib/client/api-client", () => ({
    apiGet: vi.fn(),
    apiPatch: vi.fn(),
    apiPost: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: routerPush }),
}));

vi.mock("sonner", () => ({
    toast: {
        error: vi.fn(),
    },
}));

function success<T>(data: T): ApiResponse<T> {
    return {
        success: true,
        data,
        status: 200,
        requestId: "notification-history-test",
    };
}

function buildItem(
    id: string,
    title: string,
    options: Pick<NotificationItem, "isRead" | "actionUrl"> = {
        isRead: true,
        actionUrl: null,
    },
): NotificationItem {
    return {
        id,
        type: "SYSTEM_ALERT",
        title,
        message: `${title} message`,
        isRead: options.isRead,
        actionUrl: options.actionUrl,
        createdAt: "2026-09-09T10:00:00.000Z",
    };
}

describe("NotificationsSection history pagination", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        routerPush.mockReset();
    });

    it("does not request notification history without inbox read capability", () => {
        render(
            <SWRConfig value={{ provider: () => new Map() }}>
                <NotificationsSection canReadInbox={false} />
            </SWRConfig>,
        );

        expect(apiGet).not.toHaveBeenCalled();
        expect(screen.queryByRole("heading", { name: "การแจ้งเตือน" })).not.toBeInTheDocument();
    });

    it("passes an opaque cursor to Load More and appends the next page", async () => {
        const opaqueCursor = "eyJ2IjoxLCJjcmVhdGVkQXQiOiIyMDI2LTA5LTA5VDEwOjAwOjAwLjAwMFoiLCJpZCI6Im5vdGlmaWNhdGlvbi0xIn0";
        const firstPage: NotificationsResponse = {
            notifications: [buildItem("notification-1", "หน้าแรก")],
            nextCursor: opaqueCursor,
            hasMore: true,
            totalCount: 2,
        };
        const secondPage: NotificationsResponse = {
            notifications: [buildItem("notification-2", "หน้าถัดไป")],
            nextCursor: null,
            hasMore: false,
            totalCount: 2,
        };
        vi.mocked(apiGet)
            .mockResolvedValueOnce(success(firstPage))
            .mockResolvedValueOnce(success(secondPage));

        render(
            <SWRConfig value={{ provider: () => new Map() }}>
                <NotificationsSection canReadInbox />
            </SWRConfig>,
        );

        await waitFor(() => {
            expect(screen.getByText("หน้าแรก")).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole("button", { name: "โหลดเพิ่มเติม" }));

        await waitFor(() => {
            expect(screen.getByText("หน้าถัดไป")).toBeInTheDocument();
        });
        expect(screen.getByText("หน้าแรก")).toBeInTheDocument();
        expect(apiGet).toHaveBeenCalledWith(API_ROUTES.notifications.all + "?filter=all");
        expect(apiGet).toHaveBeenCalledWith(
            `${API_ROUTES.notifications.all}?filter=all&cursor=${encodeURIComponent(opaqueCursor)}`,
        );
        expect(screen.queryByRole("button", { name: "โหลดเพิ่มเติม" })).toBeNull();
    });

    it("resets the cursor when changing the history filter", async () => {
        const opaqueCursor = "eyJ2IjoxLCJjcmVhdGVkQXQiOiIyMDI2LTA5LTA5VDEwOjAwOjAwLjAwMFoiLCJpZCI6Im5vdGlmaWNhdGlvbi0xIn0";
        const allPage: NotificationsResponse = {
            notifications: [buildItem("notification-all", "รายการจากตัวกรองทั้งหมด")],
            nextCursor: opaqueCursor,
            hasMore: true,
            totalCount: 2,
        };
        const unreadPage: NotificationsResponse = {
            notifications: [buildItem("notification-unread", "รายการจากตัวกรองยังไม่อ่าน")],
            nextCursor: null,
            hasMore: false,
            totalCount: 1,
        };
        vi.mocked(apiGet)
            .mockResolvedValueOnce(success(allPage))
            .mockResolvedValueOnce(success(unreadPage));

        render(
            <SWRConfig value={{ provider: () => new Map() }}>
                <NotificationsSection canReadInbox />
            </SWRConfig>,
        );

        await waitFor(() => {
            expect(screen.getByText("รายการจากตัวกรองทั้งหมด")).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole("button", { name: "ยังไม่อ่าน" }));

        await waitFor(() => {
            expect(screen.getByText("รายการจากตัวกรองยังไม่อ่าน")).toBeInTheDocument();
        });
        expect(screen.queryByText("รายการจากตัวกรองทั้งหมด")).toBeNull();
        expect(apiGet).toHaveBeenCalledWith(
            `${API_ROUTES.notifications.all}?filter=unread`,
        );
        expect(apiGet).not.toHaveBeenCalledWith(
            `${API_ROUTES.notifications.all}?filter=unread&cursor=${encodeURIComponent(opaqueCursor)}`,
        );
    });

    it("keeps read and update behavior available together", async () => {
        const notification = buildItem("notification-1", "อ่านได้", {
            isRead: false,
            actionUrl: "/dashboard/stock",
        });
        vi.mocked(apiGet).mockResolvedValue(success({
            notifications: [notification],
            nextCursor: null,
            hasMore: false,
            totalCount: 1,
        }));
        vi.mocked(apiPatch).mockResolvedValue(success({}));
        vi.mocked(apiPost).mockResolvedValue(success({}));

        render(
            <SWRConfig value={{ provider: () => new Map() }}>
                <NotificationsSection canReadInbox canUpdateInbox />
            </SWRConfig>,
        );

        await waitFor(() => {
            expect(screen.getByText("อ่านได้")).toBeInTheDocument();
        });
        expect(screen.getByRole("button", { name: "อ่านทั้งหมด" })).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: /อ่านได้/ }));
        await waitFor(() => {
            expect(apiPatch).toHaveBeenCalledWith(
                API_ROUTES.notifications.read("notification-1"),
            );
        });
        expect(routerPush).toHaveBeenCalledWith("/dashboard/stock");

        fireEvent.click(screen.getByRole("button", { name: "อ่านทั้งหมด" }));
        await waitFor(() => {
            expect(apiPost).toHaveBeenCalledWith(API_ROUTES.notifications.markAllRead);
        });
    });

    it("lets read-only users navigate without offering or triggering mutations", async () => {
        const notification = buildItem("notification-1", "ไปยังรายการ", {
            isRead: false,
            actionUrl: "/dashboard/notifications?filter=all",
        });
        vi.mocked(apiGet).mockResolvedValue(success({
            notifications: [notification],
            nextCursor: null,
            hasMore: false,
            totalCount: 1,
        }));

        render(
            <SWRConfig value={{ provider: () => new Map() }}>
                <NotificationsSection canReadInbox canUpdateInbox={false} />
            </SWRConfig>,
        );

        await waitFor(() => {
            expect(screen.getByText("ไปยังรายการ")).toBeInTheDocument();
        });
        expect(screen.queryByRole("button", { name: "อ่านทั้งหมด" })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: /ไปยังรายการ/ }));

        await waitFor(() => {
            expect(routerPush).toHaveBeenCalledWith(
                "/dashboard/notifications?filter=all",
            );
        });
        expect(apiPatch).not.toHaveBeenCalled();
        expect(apiPost).not.toHaveBeenCalled();
    });
});
