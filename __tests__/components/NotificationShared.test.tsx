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
                <span data-testid="contract-expiry">
                    <NotificationIcon type="ROUTINE_CONTRACT_EXPIRY" />
                </span>
            </div>,
        );

        expect(screen.getByTestId("pending").querySelector("svg")).toHaveClass(
            "text-notification-leave-request-icon",
        );
        expect(screen.getByTestId("success").querySelector("svg")).toHaveClass(
            "text-notification-success-icon",
        );
        expect(screen.getByTestId("cancelled").querySelector("svg")).toHaveClass(
            "text-notification-cancelled-icon",
        );
        expect(screen.getByTestId("contract-expiry").querySelector("svg")).toHaveClass(
            "text-notification-contract-expiry-icon",
        );
    });
});
