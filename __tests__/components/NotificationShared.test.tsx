import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NotificationIcon } from "@/components/dashboard/notifications/NotificationShared";

describe("NotificationIcon", () => {
    it("maps leave workflow notifications to meaningful icon tones", () => {
        render(
            <div>
                <span data-testid="pending">
                    <NotificationIcon type="LEAVE_NOT_TAKEN_REQUESTED" />
                </span>
                <span data-testid="success">
                    <NotificationIcon type="LEAVE_NOT_TAKEN_CONFIRMED" />
                </span>
                <span data-testid="cancelled">
                    <NotificationIcon type="LEAVE_CANCELLED" />
                </span>
            </div>,
        );

        expect(screen.getByTestId("pending").querySelector("svg")).toHaveClass(
            "text-sky-500",
        );
        expect(screen.getByTestId("success").querySelector("svg")).toHaveClass(
            "text-emerald-500",
        );
        expect(screen.getByTestId("cancelled").querySelector("svg")).toHaveClass(
            "text-rose-500",
        );
    });
});
