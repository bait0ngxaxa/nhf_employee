import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "@/modules/auth/client";
import { EmailRequestHistory } from "./EmailRequestHistory";
import { useEmailRequestHistory } from "./useEmailRequestHistory";

vi.mock("@/modules/auth/client", () => ({
    useAuth: vi.fn(),
}));

vi.mock("./useEmailRequestHistory", () => ({
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
                    documentSystemDecision: "REQUIRED",
                    sharedDriveDecision: "REQUIRED",
                    accessVersion: 1,
                    canUpdateAccessRequirements: true,
                    sharedDriveAccess: ["it"],
                    createdAt: "2026-07-01T03:00:00.000Z",
                    updatedAt: "2026-07-01T03:00:00.000Z",
                    requestedBy: 1,
                    user: { id: 1, name: "ผู้ส่งคำร้อง", email: "sender@example.com" },
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

        const table = screen.getByRole("table");
        expect(within(table).getByRole("columnheader", { name: "ติดต่อ" })).toBeInTheDocument();
        expect(within(table).getByRole("link", { name: "reply@example.com" }))
            .toHaveAttribute("href", "mailto:reply@example.com");

        const mobileList = screen.getByRole("list", {
            name: "ประวัติคำร้องพนักงานใหม่สำหรับหน้าจอขนาดเล็ก",
        });
        expect(within(mobileList).getByText("ติดต่อ")).toBeInTheDocument();
        expect(within(mobileList).getByRole("link", { name: "reply@example.com" }))
            .toHaveAttribute("href", "mailto:reply@example.com");
    });

    it("shows nickname and phone with six desktop columns and the same mobile hierarchy, without a fake workflow status", () => {
        render(<EmailRequestHistory />);
        expect(screen.getAllByText("สมชาย ใจดี (ชาย)")).toHaveLength(2);
        expect(screen.getAllByRole("link", { name: "0812345678" })).toHaveLength(2);
        expect(within(screen.getByRole("table")).getAllByRole("columnheader")).toHaveLength(6);
        expect(screen.queryByText("เสร็จสิ้น")).not.toBeInTheDocument();
        expect(screen.getByRole("list", { name: "ประวัติคำร้องพนักงานใหม่สำหรับหน้าจอขนาดเล็ก" })).toHaveClass("xl:hidden");
    });

    it.each(["UNDECIDED", "NOT_REQUIRED", "REQUIRED"] as const)("renders decision %s distinctly", (decision) => {
        const state = vi.mocked(useEmailRequestHistory)();
        vi.mocked(useEmailRequestHistory).mockReturnValue({ ...state, emailRequests: state.emailRequests.map((row) => ({ ...row,
            documentSystemDecision: decision, sharedDriveDecision: decision, sharedDriveAccess: decision === "REQUIRED" ? ["it"] : [] })) });
        render(<EmailRequestHistory />);
        const label = { UNDECIDED: "ยังไม่ได้ระบุ", NOT_REQUIRED: "ไม่ต้องใช้", REQUIRED: "ต้องใช้" }[decision];
        expect(screen.getAllByText(`สารบรรณ: ${label}`)).toHaveLength(2);
        expect(screen.getAllByText(`Shared Drive: ${label}`)).toHaveLength(2);
    });

    it("opens complete detail from desktop and offers one coherent editor", () => {
        render(<EmailRequestHistory />);
        fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: "ดูรายละเอียด" }));
        const sheet = within(screen.getByRole("dialog"));
        expect(sheet.getByText("คำร้องพนักงานใหม่ #1")).toBeInTheDocument();
        for (const value of ["สมชาย ใจดี", "ชาย", "Somchai Jaidee", "0812345678", "เจ้าหน้าที่บัญชี", "บัญชี", "reply@example.com", "ต้องใช้: it", "ผู้ส่งคำร้อง"]) {
            expect(sheet.getByText(value)).toBeInTheDocument();
        }
        fireEvent.click(sheet.getByRole("button", { name: "แก้ไขสิทธิ์การใช้งาน" }));
        expect(sheet.getByRole("button", { name: "บันทึกและแจ้งทีม IT" })).toBeInTheDocument();
        expect(sheet.getByRole("checkbox", { name: "it" })).toBeChecked();
        fireEvent.click(within(sheet.getByRole("group", { name: "Shared Drive" })).getByRole("radio", { name: "ไม่ต้องใช้" }));
        expect(sheet.queryByRole("checkbox")).not.toBeInTheDocument();
    });

    it("opens details from mobile and hides editing without row authority", () => {
        const state = vi.mocked(useEmailRequestHistory)();
        vi.mocked(useEmailRequestHistory).mockReturnValue({ ...state, emailRequests: state.emailRequests.map((row) => ({ ...row, canUpdateAccessRequirements: false })) });
        render(<EmailRequestHistory />);
        fireEvent.click(within(screen.getByRole("list", { name: "ประวัติคำร้องพนักงานใหม่สำหรับหน้าจอขนาดเล็ก" })).getByRole("button", { name: "ดูรายละเอียด" }));
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "แก้ไขสิทธิ์การใช้งาน" })).not.toBeInTheDocument();
    });
});
