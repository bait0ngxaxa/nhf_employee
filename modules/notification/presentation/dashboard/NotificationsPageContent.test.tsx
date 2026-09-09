import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiGet } from "@/lib/client/api-client";
import type { ApiResponse } from "@/lib/client/api-client";
import { API_ROUTES } from "@/lib/ssot/routes";
import { NotificationsSection } from "./NotificationsPageContent";
import type {
    NotificationItem,
    NotificationsResponse,
} from "./NotificationShared";

vi.mock("@/lib/client/api-client", () => ({
    apiGet: vi.fn(),
    apiPatch: vi.fn(),
    apiPost: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn() }),
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

function buildItem(id: string, title: string): NotificationItem {
    return {
        id,
        type: "SYSTEM_ALERT",
        title,
        message: `${title} message`,
        isRead: true,
        actionUrl: null,
        createdAt: "2026-09-09T10:00:00.000Z",
    };
}

describe("NotificationsSection history pagination", () => {
    beforeEach(() => {
        vi.clearAllMocks();
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
                <NotificationsSection />
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
                <NotificationsSection />
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
});
