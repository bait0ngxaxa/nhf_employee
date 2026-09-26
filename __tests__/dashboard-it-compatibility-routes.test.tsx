// @vitest-environment node
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    redirect: vi.fn((target: string): never => {
        throw new Error(`NEXT_REDIRECT:${target}`);
    }),
    notFound: vi.fn((): never => {
        throw new Error("NEXT_NOT_FOUND");
    }),
    operatorGuard: vi.fn(),
    operatorDetail: vi.fn(() => null),
}));

vi.mock("next/navigation", () => ({
    redirect: mocks.redirect,
    notFound: mocks.notFound,
}));
vi.mock("@/app/dashboard/_lib/route-access", () => ({
    requireDashboardITOperatorReadAccess: mocks.operatorGuard,
}));
vi.mock("@/modules/it/client", () => ({
    ITTicketOperatorDetail: mocks.operatorDetail,
}));

import ITTicketOperatorQueueCompatibilityPage from "@/app/dashboard/it/queue/page";
import ITAnalyticsCompatibilityPage from "@/app/dashboard/it/analytics/page";
import ITTicketOperatorDetailPage from "@/app/dashboard/it/queue/[ticketId]/page";

describe("Dashboard IT compatibility routes", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("redirects the old queue URL to the unified queue tab", () => {
        expect(() => ITTicketOperatorQueueCompatibilityPage()).toThrow(
            "NEXT_REDIRECT:/dashboard/it?itTab=queue",
        );
    });

    it("redirects the old analytics URL to the unified report tab", () => {
        expect(() => ITAnalyticsCompatibilityPage()).toThrow(
            "NEXT_REDIRECT:/dashboard/it?itTab=analytics",
        );
    });

    it("keeps the nested operator Ticket detail route protected and reachable", async () => {
        const capabilities = {
            canReadOwnTickets: false,
            canReadAllTickets: true,
            canCreateOwnTickets: false,
            canCommentOwnTickets: false,
            canCommentAllTickets: false,
            canManageTickets: false,
            canReadAnalytics: false,
        };
        mocks.operatorGuard.mockResolvedValue(capabilities);

        const element = await ITTicketOperatorDetailPage({
            params: Promise.resolve({ ticketId: "25" }),
        }) as ReactElement<{ readonly ticketId: number; readonly capabilities: typeof capabilities }>;

        expect(mocks.operatorGuard).toHaveBeenCalledOnce();
        expect(element.type).toBe(mocks.operatorDetail);
        expect(element.props).toMatchObject({ ticketId: 25, capabilities });
    });

    it("still rejects malformed nested Ticket detail identifiers", async () => {
        await expect(ITTicketOperatorDetailPage({
            params: Promise.resolve({ ticketId: "0" }),
        })).rejects.toThrow("NEXT_NOT_FOUND");
        expect(mocks.operatorGuard).toHaveBeenCalledOnce();
    });
});
