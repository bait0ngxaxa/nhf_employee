// @vitest-environment node
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    auditGuard: vi.fn(),
    getCurrentUserProjection: vi.fn(),
    auditSection: vi.fn(() => null),
    notificationsSection: vi.fn(() => null),
}));

vi.mock("@/app/dashboard/_lib/route-access", () => ({
    requireDashboardAuditCapability: mocks.auditGuard,
}));
vi.mock("@/app/_lib/auth/current-user", () => ({
    getCurrentUserProjection: mocks.getCurrentUserProjection,
}));
vi.mock("@/modules/audit/client", () => ({
    AuditLogsSection: mocks.auditSection,
    AuditLogsSectionSkeleton: () => null,
}));
vi.mock("@/modules/notification/client", () => ({
    NotificationsSection: mocks.notificationsSection,
    NotificationSectionSkeleton: () => null,
}));
vi.mock("next/navigation", () => ({
    redirect: vi.fn((target: string): never => {
        throw new Error(`NEXT_REDIRECT:${target}`);
    }),
}));

import AuditDashboardPage from "@/app/dashboard/audit/page";
import NotificationsDashboardPage from "@/app/dashboard/notifications/page";

describe("Dashboard capability-driven page boundaries", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.auditGuard.mockResolvedValue(undefined);
    });

    it("uses the capability-driven Audit guard before composing the page", async () => {
        const page = await AuditDashboardPage();

        expect(mocks.auditGuard).toHaveBeenCalledTimes(1);
        expect(page).toBeTruthy();
        expect(mocks.auditSection).not.toHaveBeenCalled();
    });

    it("passes read-only Notification projection to the page surface", async () => {
        mocks.getCurrentUserProjection.mockResolvedValue({
            id: "41",
            role: "USER",
            notificationCapabilities: {
                canReadInbox: true,
                canUpdateInbox: false,
            },
        });

        const page = await NotificationsDashboardPage() as ReactElement<{
            children: ReactElement<{
                canReadInbox: boolean;
                canUpdateInbox: boolean;
            }>;
        }>;
        const section = page.props.children;

        expect(section.props.canReadInbox).toBe(true);
        expect(section.props.canUpdateInbox).toBe(false);
        expect(section.type).toBe(mocks.notificationsSection);
    });

    it("does not compose Notifications for an unauthenticated user", async () => {
        mocks.getCurrentUserProjection.mockResolvedValue(null);

        await expect(NotificationsDashboardPage()).rejects.toThrow(
            "NEXT_REDIRECT:/login",
        );
        expect(mocks.notificationsSection).not.toHaveBeenCalled();
    });

    it("does not compose Notifications without inbox read capability", async () => {
        mocks.getCurrentUserProjection.mockResolvedValue({
            id: "41",
            role: "USER",
            notificationCapabilities: {
                canReadInbox: false,
                canUpdateInbox: true,
            },
        });

        await expect(NotificationsDashboardPage()).rejects.toThrow(
            "NEXT_REDIRECT:/access-denied",
        );
        expect(mocks.notificationsSection).not.toHaveBeenCalled();
    });
});
