import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useSWR from "swr";

import { useAuth } from "@/components/auth/HybridAuthProvider";
import {
    useITSupportDataContext,
    useITSupportUIContext,
} from "@/components/dashboard/context/it-support/ITSupportContext";
import { ITSupportProvider } from "@/components/dashboard/context/it-support/ITSupportProvider";

const navigationMocks = vi.hoisted(() => ({
    replace: vi.fn(),
    searchParams: new URLSearchParams(),
}));

vi.mock("swr");

vi.mock("@/components/auth/HybridAuthProvider", () => ({
    useAuth: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    usePathname: () => "/dashboard",
    useRouter: () => ({ replace: navigationMocks.replace }),
    useSearchParams: () => navigationMocks.searchParams,
}));

function ContextProbe() {
    const { ticketStats } = useITSupportDataContext();
    const { activeTab, selectedTicketId } = useITSupportUIContext();

    return (
        <>
            <div data-testid="active-tab">{activeTab}</div>
            <div data-testid="selected-ticket-id">{selectedTicketId}</div>
            <div data-testid="total-tickets">{ticketStats.total}</div>
        </>
    );
}

describe("ITSupportProvider", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        navigationMocks.searchParams = new URLSearchParams(
            "tab=it-support&ticketId=501",
        );
        vi.mocked(useAuth).mockReturnValue({
            user: {
                id: "7",
                role: "ADMIN",
                email: "admin@test.com",
            },
        } as never);
        vi.mocked(useSWR).mockReturnValue({
            data: {
                stats: {
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
                },
            },
            mutate: vi.fn(),
            isLoading: false,
            isValidating: false,
            error: undefined,
        });
    });

    it("uses aggregate stats and opens a deep-linked ticket outside the list", async () => {
        render(
            <ITSupportProvider>
                <ContextProbe />
            </ITSupportProvider>,
        );

        expect(useSWR).toHaveBeenCalledWith("/api/tickets/stats");
        expect(screen.getByTestId("total-tickets")).toHaveTextContent("250");
        await waitFor(() => {
            expect(screen.getByTestId("selected-ticket-id")).toHaveTextContent(
                "501",
            );
            expect(screen.getByTestId("active-tab")).toHaveTextContent("detail");
        });
    });
});
