import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/tickets/stats/route";
import { requireApiSession } from "@/lib/auth/api";
import { ticketService } from "@/lib/services/ticket";

vi.mock("@/lib/auth/api", () => ({
    requireApiSession: vi.fn(),
}));

vi.mock("@/lib/services/ticket", () => ({
    ticketService: {
        getTicketStats: vi.fn(),
    },
}));

describe("GET /api/tickets/stats", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns aggregate ticket stats for the authenticated access scope", async () => {
        const user = {
            id: 7,
            role: "ADMIN",
            email: "admin@test.com",
        };
        vi.mocked(requireApiSession).mockResolvedValue({
            ok: true,
            user,
        } as never);
        vi.mocked(ticketService.getTicketStats).mockResolvedValue({
            total: 250,
            open: 120,
            inProgress: 60,
            resolved: 50,
            closed: 20,
            cancelled: 0,
            highPriority: 45,
            urgentPriority: 9,
            userTickets: 18,
            newTickets: 12,
        });

        const response = await GET();

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            stats: expect.objectContaining({
                total: 250,
                open: 120,
                resolved: 50,
            }),
        });
        expect(ticketService.getTicketStats).toHaveBeenCalledWith(user);
    });
});
