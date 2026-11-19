import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const getCurrentUserProjection = vi.hoisted(() => vi.fn());
const router = vi.hoisted(() => ({ back: vi.fn(), push: vi.fn() }));

vi.mock("@/app/_lib/auth/current-user", () => ({ getCurrentUserProjection }));
vi.mock("next/navigation", () => ({
    redirect: vi.fn(),
    useRouter: () => router,
}));

import Home from "@/app/page";
import AccessDenied from "@/app/access-denied/page";
import { LiffModuleLanding } from "@/components/liff/LiffModuleLanding";
import { FEATURE_KEYS, isFeatureEnabled } from "@/lib/ssot/features";
import { PermissionState } from "@/components/ui/state";

describe("role-free public presentation copy", () => {
    afterEach(() => vi.unstubAllEnvs());

    it.each([
        [true, true],
        [false, true],
        [true, false],
        [false, false],
    ])("describes available services with Leave %s and Routine %s", async (leave, routine) => {
        vi.stubEnv("NEXT_PUBLIC_FEATURE_LEAVE", String(leave));
        vi.stubEnv("NEXT_PUBLIC_FEATURE_ROUTINE", String(routine));
        expect(isFeatureEnabled(FEATURE_KEYS.leave)).toBe(leave);
        expect(isFeatureEnabled(FEATURE_KEYS.routine)).toBe(routine);
        getCurrentUserProjection.mockResolvedValue(null);

        render(await Home());

        expect(screen.getByText(/บริการที่เปิดให้ใช้งาน/)).toBeVisible();
        if (!leave) expect(screen.queryByText(/ยื่นคำขอลา/)).not.toBeInTheDocument();
        if (!routine) expect(screen.queryByText(/ติดตามงานประจำ/)).not.toBeInTheDocument();
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

        fireEvent.click(screen.getByRole("button", { name: "กลับสู่แดชบอร์ด" }));
        expect(router.push).toHaveBeenCalledWith("/dashboard");
    });

    it("distinguishes a disabled LINE service from an account that cannot open it", () => {
        const view = render(<LiffModuleLanding module="routine" reason="disabled" />);

        expect(screen.getByRole("heading", { name: /บน LINE ปิดอยู่/ })).toBeVisible();
        expect(screen.queryByText(/ติดต่อผู้ดูแลระบบ/)).not.toBeInTheDocument();
        expect(screen.getByRole("link", { name: /กลับหน้าบริการ/ })).toHaveAttribute("href", "/liff");

        view.rerender(<LiffModuleLanding module="routine" reason="account-unavailable" />);

        expect(screen.getByRole("heading", { name: /บัญชีนี้เปิด/ })).toBeVisible();
        expect(screen.getByText(/ติดต่อผู้ดูแลระบบ/)).toBeVisible();
        expect(screen.queryByText(/ปิดอยู่/)).not.toBeInTheDocument();
        expect(screen.getByRole("link", { name: /กลับหน้าบริการ/ })).toHaveAttribute("href", "/liff");
    });

    it("gives signed-in users a useful next step when an action is unavailable", () => {
        render(<PermissionState />);

        expect(screen.getByRole("status")).toHaveTextContent(/บัญชีนี้/);
        expect(screen.getByRole("status")).toHaveTextContent(/ติดต่อผู้ดูแลระบบ/);
        expect(screen.getByRole("status")).not.toHaveTextContent(/เข้าสู่ระบบ/);
    });
});
