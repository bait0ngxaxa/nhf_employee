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
    it("uses capability-oriented landing copy", async () => {
        getCurrentUserProjection.mockResolvedValue(null);

        render(await Home());

        expect(screen.getByText("เข้าถึงตามสิทธิ์ที่ได้รับ")).toBeInTheDocument();
        expect(screen.getByText("แสดงเฉพาะงานและบริการที่บัญชีนี้ใช้งานได้")).toBeInTheDocument();
        expect(screen.getByText("สำหรับการทำงานภายใน NHF")).toBeInTheDocument();
        expect(screen.queryByText("เข้าถึงตามบทบาท")).not.toBeInTheDocument();
        expect(screen.queryByText("เวอร์ชันสำหรับพนักงานและผู้ดูแลระบบ")).not.toBeInTheDocument();
    });

    it("does not disclose an administrator category on access denied", () => {
        render(<AccessDenied />);

        expect(screen.getByText(/คุณยังไม่มีสิทธิ์เข้าถึงส่วนนี้/)).toBeInTheDocument();
        expect(screen.queryByText("ผู้ดูแลระบบเท่านั้น")).not.toBeInTheDocument();
        expect(screen.queryByText("ผู้ดูแลระบบ")).not.toBeInTheDocument();
    });
});
