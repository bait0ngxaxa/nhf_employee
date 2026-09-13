import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiGet, apiPatch, apiPost } from "@/lib/client/api-client";
import type { ApiResponse } from "@/lib/client/api-client";
import { API_ROUTES } from "@/lib/ssot/routes";
import { NotificationDropdown } from "./NotificationDropdown";
import type { NotificationItem, NotificationsData } from "./NotificationShared";

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
        requestId: "notification-dropdown-test",
    };
}

function buildItem(
    options: Pick<NotificationItem, "isRead" | "actionUrl">,
): NotificationItem {
    return {
        id: "notification-1",
        type: "SYSTEM_ALERT",
        title: "แจ้งเตือนทดสอบ",
        message: "รายละเอียดแจ้งเตือน",
        isRead: options.isRead,
        actionUrl: options.actionUrl,
        createdAt: "2026-09-09T10:00:00.000Z",
    };
}

function renderDropdown(canUpdateInbox: boolean, item: NotificationItem): void {
    vi.mocked(apiGet).mockResolvedValue(success<NotificationsData>({
        notifications: [item],
        unreadCount: item.isRead ? 0 : 1,
    }));

    render(
        <SWRConfig value={{ provider: () => new Map() }}>
            <NotificationDropdown canUpdateInbox={canUpdateInbox} />
        </SWRConfig>,
    );
}

describe("NotificationDropdown read/update presentation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        routerPush.mockReset();
    });

    it("keeps mark-one and mark-all mutations for read+update users", async () => {
        const item = buildItem({ isRead: false, actionUrl: null });
        vi.mocked(apiPatch).mockResolvedValue(success({}));
        vi.mocked(apiPost).mockResolvedValue(success({}));
        renderDropdown(true, item);

        await waitFor(() => {
            expect(screen.getByRole("button", { name: /เปิดการแจ้งเตือน/ })).toBeInTheDocument();
        });
        fireEvent.pointerDown(
            screen.getByRole("button", { name: /เปิดการแจ้งเตือน/ }),
            { button: 0 },
        );
        await waitFor(() => {
            expect(screen.getByRole("menuitem", { name: /แจ้งเตือนทดสอบ/ })).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole("menuitem", { name: /แจ้งเตือนทดสอบ/ }));
        await waitFor(() => {
            expect(apiPatch).toHaveBeenCalledWith(
                API_ROUTES.notifications.read("notification-1"),
            );
        });
        fireEvent.click(screen.getByRole("button", { name: "อ่านทั้งหมด" }));
        await waitFor(() => {
            expect(apiPost).toHaveBeenCalledWith(API_ROUTES.notifications.markAllRead);
        });
    });

    it("navigates read-only users without mark-read or mark-all mutations", async () => {
        const item = buildItem({
            isRead: false,
            actionUrl: "/dashboard/stock",
        });
        renderDropdown(false, item);

        await waitFor(() => {
            expect(screen.getByRole("button", { name: /เปิดการแจ้งเตือน/ })).toBeInTheDocument();
        });
        fireEvent.pointerDown(
            screen.getByRole("button", { name: /เปิดการแจ้งเตือน/ }),
            { button: 0 },
        );
        await waitFor(() => {
            expect(screen.getByRole("menuitem", { name: /แจ้งเตือนทดสอบ/ })).toBeInTheDocument();
        });
        expect(screen.queryByRole("button", { name: "อ่านทั้งหมด" })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("menuitem", { name: /แจ้งเตือนทดสอบ/ }));

        await waitFor(() => {
            expect(routerPush).toHaveBeenCalledWith("/dashboard/stock");
        });
        expect(apiPatch).not.toHaveBeenCalled();
        expect(apiPost).not.toHaveBeenCalled();
    });
});
