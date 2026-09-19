import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getCurrentUserProjection: vi.fn(),
    redirect: vi.fn((target: string): never => {
        throw new Error(`NEXT_REDIRECT:${target}`);
    }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/app/_lib/auth/current-user", () => ({
    getCurrentUserProjection: mocks.getCurrentUserProjection,
}));
vi.mock("@/components/dashboard/feedback/EmailRequestSectionSkeleton", () => ({
    EmailRequestSectionSkeleton: () => <div data-testid="email-request-skeleton" />,
}));
vi.mock("@/components/dashboard/sections/EmailRequestSection", () => ({
    EmailRequestSection: ({ capabilities }: {
        capabilities: { canReadRequests: boolean; canCreateRequests: boolean };
    }) => <output data-testid="email-request-capabilities">{JSON.stringify(capabilities)}</output>,
}));

import EmailRequestDashboardPage from "@/app/dashboard/email-request/page";

describe("Email Request Dashboard route access", () => {
    it("allows a configured USER through the projected create capability", async () => {
        mocks.getCurrentUserProjection.mockResolvedValue({
            id: "7",
            role: "USER",
            emailRequestCapabilities: {
                canReadRequests: false,
                canCreateRequests: true,
            },
        });

        render(await EmailRequestDashboardPage());

        expect(screen.getByTestId("email-request-capabilities")).toHaveTextContent(
            JSON.stringify({ canReadRequests: false, canCreateRequests: true }),
        );
    });

    it("redirects an actor with neither Email Request capability", async () => {
        mocks.getCurrentUserProjection.mockResolvedValue({
            id: "7",
            role: "USER",
            emailRequestCapabilities: {
                canReadRequests: false,
                canCreateRequests: false,
            },
        });

        await expect(EmailRequestDashboardPage()).rejects.toThrow(
            "NEXT_REDIRECT:/access-denied",
        );
    });
});
