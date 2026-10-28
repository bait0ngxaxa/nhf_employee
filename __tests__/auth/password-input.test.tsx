import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ResetPasswordForm } from "@/modules/auth/client";

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
    useSearchParams: () => new URLSearchParams("token=test-token"),
}));

describe("password visibility toggle", () => {
    it("shows and hides each password field independently", () => {
        render(<ResetPasswordForm />);

        const password = screen.getByLabelText("รหัสผ่านใหม่");
        const confirmPassword = screen.getByLabelText("ยืนยันรหัสผ่านใหม่");
        expect(password).toHaveAttribute("type", "password");
        expect(confirmPassword).toHaveAttribute("type", "password");

        fireEvent.click(screen.getByRole("button", { name: "แสดงรหัสผ่าน" }));
        expect(password).toHaveAttribute("type", "text");
        expect(confirmPassword).toHaveAttribute("type", "password");
        expect(screen.getByRole("button", { name: "ซ่อนรหัสผ่าน" })).toHaveAttribute("aria-pressed", "true");

        fireEvent.click(screen.getByRole("button", { name: "แสดงรหัสผ่านยืนยัน" }));
        expect(confirmPassword).toHaveAttribute("type", "text");

        fireEvent.click(screen.getByRole("button", { name: "ซ่อนรหัสผ่าน" }));
        expect(password).toHaveAttribute("type", "password");
    });
});
