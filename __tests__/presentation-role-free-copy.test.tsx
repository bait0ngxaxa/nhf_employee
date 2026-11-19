import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const getCurrentUserProjection = vi.hoisted(() => vi.fn());
const router = vi.hoisted(() => ({ back: vi.fn(), push: vi.fn() }));

vi.mock("@/app/_lib/auth/current-user", () => ({ getCurrentUserProjection }));
vi.mock("next/navigation", () => ({
    redirect: vi.fn(),
    useRouter: () => router,
}));

import Home from "@/app/page";
import AccessDenied from "@/app/access-denied/page";

describe("role-free public presentation copy", () => {
    it("introduces employee services and account actions", async () => {
        getCurrentUserProjection.mockResolvedValue(null);

        render(await Home());

        expect(screen.getByText(/ยื่นคำขอลา เบิกวัสดุ ติดตามงานประจำ/)).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "ลงทะเบียนบัญชี" })).toHaveAttribute("href", "/signup");
        expect(screen.getByRole("link", { name: "เข้าสู่ระบบ" })).toHaveAttribute("href", "/login");
        expect(screen.queryByText("เข้าถึงตามบทบาท")).not.toBeInTheDocument();
        expect(screen.queryByText("เวอร์ชันสำหรับพนักงานและผู้ดูแลระบบ")).not.toBeInTheDocument();
    });

    it("does not disclose an administrator category on access denied", () => {
        render(<AccessDenied />);

        expect(screen.getByText("บัญชีนี้เปิดหน้านี้ไม่ได้")).toBeInTheDocument();
        expect(screen.getByText(/ติดต่อผู้ดูแลระบบ/)).toBeInTheDocument();
        expect(screen.queryByText("ผู้ดูแลระบบเท่านั้น")).not.toBeInTheDocument();
        expect(screen.queryByText("ผู้ดูแลระบบ")).not.toBeInTheDocument();
    });
});
