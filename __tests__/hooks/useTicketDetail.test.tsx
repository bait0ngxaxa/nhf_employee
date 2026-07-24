import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useTicketDetail } from "@/hooks/useTicketDetail";

interface MockUser {
    id: string;
    role: string;
}

const hookMocks = vi.hoisted(() => ({
    user: { id: "7", role: "USER" } as MockUser,
    ticket: {
        id: 55,
        status: "OPEN",
        reportedBy: { id: 9 },
        assignedTo: { id: 7 },
    },
}));

vi.mock("@/components/auth/HybridAuthProvider", () => ({
    useAuth: () => ({ user: hookMocks.user }),
}));

vi.mock("swr", () => ({
    default: () => ({
        data: { ticket: hookMocks.ticket },
        error: undefined,
        mutate: vi.fn(),
        isLoading: false,
    }),
}));

vi.mock("@/lib/client/api-client", () => ({
    apiPost: vi.fn(),
    apiPatch: vi.fn(),
}));

describe("useTicketDetail comment permissions", () => {
    beforeEach(() => {
        hookMocks.user = { id: "7", role: "USER" };
    });

    it("does not allow a non-admin assignee who is not the owner", () => {
        const { result } = renderHook(() => useTicketDetail(55));

        expect(result.current.isOwner).toBe(false);
        expect(result.current.canComment).toBe(false);
    });

    it("allows the ticket owner", () => {
        hookMocks.user = { id: "9", role: "USER" };

        const { result } = renderHook(() => useTicketDetail(55));

        expect(result.current.isOwner).toBe(true);
        expect(result.current.canComment).toBe(true);
    });

    it("allows an admin", () => {
        hookMocks.user = { id: "7", role: "ADMIN" };

        const { result } = renderHook(() => useTicketDetail(55));

        expect(result.current.canComment).toBe(true);
    });
});
