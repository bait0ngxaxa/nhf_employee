import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "@/components/auth/HybridAuthProvider";
import TicketList from "@/components/ticket/TicketList";
import { useTicketList } from "@/hooks/useTicketList";

vi.mock("@/components/auth/HybridAuthProvider", () => ({
    useAuth: vi.fn(),
}));

vi.mock("@/hooks/useTicketList", () => ({
    useTicketList: vi.fn(),
}));

vi.mock("@/components/ticket/TicketFiltersCard", () => ({
    TicketFiltersCard: () => <div data-testid="ticket-filters" />,
}));

vi.mock("@/components/ticket/TicketCard", () => ({
    TicketCard: () => <div data-testid="ticket-card" />,
}));

describe("TicketList error state", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        vi.mocked(useAuth).mockReturnValue({
            user: { id: "7" },
        } as never);
    });

    it("offers a retry action when loading tickets fails", () => {
        const retry = vi.fn();

        vi.mocked(useTicketList).mockReturnValue({
            tickets: [],
            loading: false,
            error: "โหลดข้อมูลไม่สำเร็จ",
            retry,
            filters: {
                status: "",
                category: "",
                priority: "",
                search: "",
            },
            setFilters: vi.fn(),
            pagination: {
                page: 1,
                limit: 10,
                total: 0,
                pages: 0,
            },
            handlePageChange: vi.fn(),
            resetFilters: vi.fn(),
            isNewTicket: vi.fn(),
        });

        render(<TicketList />);

        fireEvent.click(screen.getByRole("button", { name: "ลองใหม่" }));

        expect(screen.getByRole("alert")).toHaveTextContent(
            "โหลดรายการ tickets ไม่สำเร็จ",
        );
        expect(retry).toHaveBeenCalledTimes(1);
    });
});
