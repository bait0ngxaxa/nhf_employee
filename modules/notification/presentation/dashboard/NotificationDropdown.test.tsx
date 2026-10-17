import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

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

    it("updates confirmed read state after navigating to an actionable notification", async () => {
        let serverItem = buildItem({
            isRead: false,
            actionUrl: "/dashboard/stock",
        });
        vi.mocked(apiGet).mockImplementation(async () => success<NotificationsData>({
            notifications: [serverItem],
            unreadCount: serverItem.isRead ? 0 : 1,
        }));
        vi.mocked(apiPatch).mockImplementation(async () => {
            serverItem = { ...serverItem, isRead: true };
            return success({});
        });

        render(
            <SWRConfig value={{ provider: () => new Map() }}>
                <NotificationDropdown canUpdateInbox />
            </SWRConfig>,
        );

        const trigger = await screen.findByRole("button", { name: /เปิดการแจ้งเตือน/ });
        fireEvent.pointerDown(trigger, { button: 0 });
        fireEvent.click(await screen.findByRole("menuitem", { name: /แจ้งเตือนทดสอบ/ }));

        await waitFor(() => {
            expect(routerPush).toHaveBeenCalledWith("/dashboard/stock");
            expect(apiPatch).toHaveBeenCalledWith(
                API_ROUTES.notifications.read("notification-1"),
            );
        });

        fireEvent.pointerDown(trigger, { button: 0 });
        await screen.findByRole("menuitem", { name: /แจ้งเตือนทดสอบ/ });
        expect(screen.queryByLabelText("ยังไม่อ่าน")).not.toBeInTheDocument();
    });

    it("navigates before a slow read-state request completes", async () => {
        let resolveRead: ((response: ApiResponse<unknown>) => void) | undefined;
        vi.mocked(apiPatch).mockReturnValue(new Promise((resolve) => {
            resolveRead = resolve;
        }));
        renderDropdown(true, buildItem({
            isRead: false,
            actionUrl: "/dashboard/stock",
        }));

        const trigger = await screen.findByRole("button", { name: /เปิดการแจ้งเตือน/ });
        fireEvent.pointerDown(trigger, { button: 0 });
        fireEvent.click(await screen.findByRole("menuitem", { name: /แจ้งเตือนทดสอบ/ }));

        expect(routerPush).toHaveBeenCalledWith("/dashboard/stock");
        expect(apiPatch).toHaveBeenCalledWith(
            API_ROUTES.notifications.read("notification-1"),
        );
        resolveRead?.(success({}));
    });

    it("allows reopening the same actionable notification while its PATCH is pending without duplicating the PATCH", async () => {
        let resolveRead: ((response: ApiResponse<unknown>) => void) | undefined;
        vi.mocked(apiPatch).mockReturnValue(new Promise((resolve) => {
            resolveRead = resolve;
        }));
        renderDropdown(true, buildItem({
            isRead: false,
            actionUrl: "/dashboard/stock",
        }));

        const trigger = await screen.findByRole("button", { name: /เปิดการแจ้งเตือน/ });
        fireEvent.pointerDown(trigger, { button: 0 });
        const notification = await screen.findByRole("menuitem", { name: /แจ้งเตือนทดสอบ/ });
        fireEvent.click(notification);
        expect(routerPush).toHaveBeenCalledTimes(1);
        expect(apiPatch).toHaveBeenCalledTimes(1);

        fireEvent.pointerDown(trigger, { button: 0 });
        const reopenedNotification = await screen.findByRole("menuitem", { name: /แจ้งเตือนทดสอบ/ });
        expect(reopenedNotification).toBeEnabled();
        fireEvent.click(reopenedNotification);

        expect(routerPush).toHaveBeenCalledTimes(2);
        expect(routerPush).toHaveBeenLastCalledWith("/dashboard/stock");
        expect(apiPatch).toHaveBeenCalledTimes(1);
        resolveRead?.(success({}));
    });

    it("keeps actionable notifications available during another read update", async () => {
        let resolveRead: ((response: ApiResponse<unknown>) => void) | undefined;
        const first = {
            ...buildItem({ isRead: false, actionUrl: null }),
            id: "notification-1",
            title: "อ่านสถานะช้า",
        };
        const second = {
            ...buildItem({ isRead: false, actionUrl: "/dashboard/stock" }),
            id: "notification-2",
            title: "เปิดสต็อก",
        };
        vi.mocked(apiGet).mockResolvedValue(success<NotificationsData>({
            notifications: [first, second],
            unreadCount: 2,
        }));
        vi.mocked(apiPatch)
            .mockReturnValueOnce(new Promise((resolve) => {
                resolveRead = resolve;
            }))
            .mockResolvedValueOnce(success({}));

        render(
            <SWRConfig value={{ provider: () => new Map() }}>
                <NotificationDropdown canUpdateInbox />
            </SWRConfig>,
        );

        fireEvent.pointerDown(
            await screen.findByRole("button", { name: /เปิดการแจ้งเตือน/ }),
            { button: 0 },
        );
        fireEvent.click(await screen.findByRole("menuitem", { name: /อ่านสถานะช้า/ }));
        await waitFor(() => expect(apiPatch).toHaveBeenCalledTimes(1));

        fireEvent.click(screen.getByRole("menuitem", { name: /เปิดสต็อก/ }));

        expect(routerPush).toHaveBeenCalledWith("/dashboard/stock");
        await waitFor(() => expect(apiPatch).toHaveBeenCalledTimes(2));
        resolveRead?.(success({}));
    });

    it("keeps the notification unread when best-effort persistence is rejected", async () => {
        vi.mocked(apiPatch).mockResolvedValue({
            success: false,
            error: "Forbidden",
            errorThai: "คุณไม่มีสิทธิ์ดำเนินการนี้",
            code: "FORBIDDEN",
            status: 403,
        });
        renderDropdown(true, buildItem({
            isRead: false,
            actionUrl: "/dashboard/stock",
        }));

        const trigger = await screen.findByRole("button", { name: /เปิดการแจ้งเตือน/ });
        fireEvent.pointerDown(trigger, { button: 0 });
        fireEvent.click(await screen.findByRole("menuitem", { name: /แจ้งเตือนทดสอบ/ }));

        expect(routerPush).toHaveBeenCalledWith("/dashboard/stock");
        await waitFor(() => expect(apiPatch).toHaveBeenCalled());
        fireEvent.pointerDown(trigger, { button: 0 });
        await screen.findByRole("menuitem", { name: /แจ้งเตือนทดสอบ/ });
        expect(screen.getByText("1 รายการที่ยังไม่อ่าน")).toBeInTheDocument();
        expect(screen.getByLabelText("ยังไม่อ่าน")).toBeInTheDocument();
        expect(toast.error).not.toHaveBeenCalled();
    });

    it("handles rejected best-effort requests without an unhandled rejection", async () => {
        vi.mocked(apiPatch).mockRejectedValue(new Error("Network failure"));
        renderDropdown(true, buildItem({
            isRead: false,
            actionUrl: "/dashboard/stock",
        }));

        const trigger = await screen.findByRole("button", { name: /เปิดการแจ้งเตือน/ });
        fireEvent.pointerDown(trigger, { button: 0 });
        fireEvent.click(await screen.findByRole("menuitem", { name: /แจ้งเตือนทดสอบ/ }));

        expect(routerPush).toHaveBeenCalledWith("/dashboard/stock");
        await waitFor(() => expect(apiPatch).toHaveBeenCalled());
        expect(toast.error).not.toHaveBeenCalled();
    });
});
