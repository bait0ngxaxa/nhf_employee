import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
    formatNotificationBadge,
    NotificationIcon,
    normalizeNotificationActionUrl,
} from "./NotificationShared";

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

describe("normalizeNotificationActionUrl", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("returns null when a notification has no action URL", () => {
        expect(normalizeNotificationActionUrl(null)).toBeNull();
    });

    it("preserves a valid action URL", () => {
        const actionUrl = "/dashboard/stock?stockTab=browse";

        expect(normalizeNotificationActionUrl(actionUrl)).toBe(actionUrl);
    });

    it("normalizes the legacy IT equipment tab alias", () => {
        expect(
            normalizeNotificationActionUrl("/dashboard?tab=it-equipment"),
        ).toBe("/dashboard?tab=stock");
    });

    it("falls back to the dashboard when the target tab is disabled", () => {
        vi.stubEnv("NEXT_PUBLIC_FEATURE_ROUTINE", "false");

        expect(
            normalizeNotificationActionUrl("/dashboard?tab=routine"),
        ).toBe("/dashboard");
    });

    it("returns the normalized URL when it cannot be parsed", () => {
        const malformedUrl = "http://[invalid";

        expect(normalizeNotificationActionUrl(malformedUrl)).toBe(malformedUrl);
    });
});

describe("formatNotificationBadge", () => {
    it.each([
        [0, "0"],
        [1, "1"],
        [99, "99"],
        [100, "99+"],
    ])("formats %s as %s", (count, expected) => {
        expect(formatNotificationBadge(count)).toBe(expected);
    });
});
