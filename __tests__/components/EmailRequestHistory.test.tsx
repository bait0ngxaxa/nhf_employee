import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "@/components/auth/HybridAuthProvider";
import { EmailRequestHistory } from "@/components/email/EmailRequestHistory";
import { useEmailRequestHistory } from "@/hooks/useEmailRequestHistory";

vi.mock("@/components/auth/HybridAuthProvider", () => ({
    useAuth: vi.fn(),
}));

vi.mock("@/hooks/useEmailRequestHistory", () => ({
    useEmailRequestHistory: vi.fn(),
}));

describe("EmailRequestHistory", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(useAuth).mockReturnValue({
            user: {
                id: "1",
                role: "ADMIN",
                email: "admin@example.com",
                name: "Admin",
            },
            status: "authenticated",
            refreshUser: vi.fn(),
            signOut: vi.fn(),
        });
        vi.mocked(useEmailRequestHistory).mockReturnValue({
            emailRequests: [
                {
                    id: 1,
                    thaiName: "สมชาย ใจดี",
                    englishName: "Somchai Jaidee",
                    phone: "0812345678",
                    nickname: "ชาย",
                    position: "เจ้าหน้าที่บัญชี",
                    department: "บัญชี",
                    replyEmail: "reply@example.com",
                    needsDocumentSystem: true,
                    sharedDriveAccess: ["it"],
                    createdAt: "2026-07-01T03:00:00.000Z",
                    updatedAt: "2026-07-01T03:00:00.000Z",
                    requestedBy: 1,
                },
            ],
            pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
            isLoading: false,
            error: null,
            currentPage: 1,
            setCurrentPage: vi.fn(),
            refresh: vi.fn(),
        });
    });

    it("displays reply email in request history", () => {
        render(<EmailRequestHistory />);

        expect(screen.getByText("อีเมลตอบกลับ")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "reply@example.com" }))
            .toHaveAttribute("href", "mailto:reply@example.com");
    });
});
