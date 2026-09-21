import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import GlobalError from "@/app/error";

const navigationMocks = vi.hoisted(() => ({
    router: {
        push: vi.fn(),
    },
}));

vi.mock("next/navigation", () => ({
    useRouter: () => navigationMocks.router,
}));

describe("app error recovery", () => {
    const error = new Error("test application error");

    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, "error").mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("retries the error boundary when the retry action is clicked", () => {
        const reset = vi.fn();

        render(<GlobalError error={error} reset={reset} />);

        fireEvent.click(screen.getByRole("button", { name: "ลองใหม่อีกครั้ง" }));

        expect(reset).toHaveBeenCalledTimes(1);
    });

    it("navigates to the home page with the App Router", () => {
        render(<GlobalError error={error} reset={vi.fn()} />);

        fireEvent.click(screen.getByRole("button", { name: "กลับหน้าหลัก" }));

        expect(navigationMocks.router.push).toHaveBeenCalledWith("/");
    });
});
