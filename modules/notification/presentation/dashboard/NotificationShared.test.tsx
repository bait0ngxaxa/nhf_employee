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

    it("renders IT_TICKET distinctly while retaining historical Ticket fallbacks", () => {
        render(
            <div>
                <span data-testid="it-ticket">
                    <NotificationIcon type="IT_TICKET" />
                </span>
                <span data-testid="legacy-created">
                    <NotificationIcon type="TICKET_CREATED" />
                </span>
                <span data-testid="legacy-comment">
                    <NotificationIcon type="NEW_COMMENT" />
                </span>
                <span data-testid="legacy-updated">
                    <NotificationIcon type="TICKET_UPDATED" />
                </span>
            </div>,
        );

        expect(screen.getByTestId("it-ticket").querySelector("svg")).toHaveClass(
            "text-status-info-solid",
        );
        for (const testId of ["legacy-created", "legacy-comment", "legacy-updated"]) {
            expect(screen.getByTestId(testId).querySelector("svg")).toHaveClass(
                "text-content-muted",
            );
        }
    });
});

describe("normalizeNotificationActionUrl", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("returns null when a notification has no action URL", () => {
        expect(normalizeNotificationActionUrl(null)).toBeNull();
    });

    it.each([
        ["/dashboard", "/dashboard"],
        ["/dashboard?tab=stock", "/dashboard?tab=stock"],
        [
            "/dashboard/stock?stockTab=browse&term=a%20b#items%20list",
            "/dashboard/stock?stockTab=browse&term=a%20b#items%20list",
        ],
    ])("preserves the intended internal destination %s", (actionUrl, expected) => {
        expect(normalizeNotificationActionUrl(actionUrl)).toBe(expected);
    });

    it("returns a canonical pathname while preserving query and hash encoding", () => {
        expect(
            normalizeNotificationActionUrl(
                "/dashboard/stock/../inventory?term=a%20b&tag=%E0%B8%81#items%20list",
            ),
        ).toBe("/dashboard/inventory?term=a%20b&tag=%E0%B8%81#items%20list");
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

    it.each([
        "https://evil.example/path",
        "//evil.example/path",
        "/\\\\evil.example/path",
        "/dashboard\\\\evil.example/path",
        "/dashboard\n?tab=stock",
        "/dashboard\r?tab=stock",
        "/dashboard\t?tab=stock",
        "javascript:alert(1)",
        "http://[invalid",
    ])("rejects malformed or non-internal action URL %s", (actionUrl) => {
        expect(normalizeNotificationActionUrl(actionUrl)).toBeNull();
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
