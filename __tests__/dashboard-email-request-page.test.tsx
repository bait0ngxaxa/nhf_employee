import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CurrentUserProjection } from "@/app/_lib/auth/current-user";
import type { EmailRequestPresentationCapabilities } from "@/modules/it/client";

const mocks = vi.hoisted(() => ({
    getCurrentUserProjection: vi.fn<() => Promise<CurrentUserProjection | null>>(),
    redirect: vi.fn((target: string): never => {
        throw new Error(`NEXT_REDIRECT:${target}`);
    }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/app/_lib/auth/current-user", () => ({
    getCurrentUserProjection: mocks.getCurrentUserProjection,
}));
vi.mock("@/modules/it/client", () => ({
    EmailRequestSectionSkeleton: () => <div data-testid="email-request-skeleton" />,
}));
vi.mock("@/components/dashboard/sections/EmailRequestSection", () => ({
    EmailRequestSection: ({ capabilities }: {
        capabilities: EmailRequestPresentationCapabilities;
    }) => <output data-testid="email-request-capabilities">{JSON.stringify(capabilities)}</output>,
}));

import EmailRequestDashboardPage from "@/app/dashboard/email-request/page";

const USER = { id: "7", role: "USER" } satisfies CurrentUserProjection;
const NO_CAPABILITIES = {
    canReadRequests: false,
    canCreateRequests: false,
    canUpdateOwnRequests: false,
    canUpdateAllRequests: false,
} satisfies EmailRequestPresentationCapabilities;

describe("Email Request Dashboard route access", () => {
    it.each([
        { label: "create", capabilities: { ...NO_CAPABILITIES, canCreateRequests: true } },
        { label: "read and update OWN", capabilities: { ...NO_CAPABILITIES, canReadRequests: true, canUpdateOwnRequests: true } },
        { label: "read and update ALL", capabilities: { ...NO_CAPABILITIES, canReadRequests: true, canUpdateAllRequests: true } },
    ])("passes the complete projected $label capabilities to the section", async ({ capabilities }) => {
        mocks.getCurrentUserProjection.mockResolvedValue({ ...USER, emailRequestCapabilities: capabilities });
        render(await EmailRequestDashboardPage());
        expect(JSON.parse(screen.getByTestId("email-request-capabilities").textContent ?? "null")).toEqual(capabilities);
    });

    it.each([
        { label: "neither read nor create", capabilities: NO_CAPABILITIES },
        { label: "update OWN only", capabilities: { ...NO_CAPABILITIES, canUpdateOwnRequests: true } },
        { label: "update ALL only", capabilities: { ...NO_CAPABILITIES, canUpdateAllRequests: true } },
        { label: "missing projection", capabilities: undefined },
    ])("redirects an actor with $label", async ({ capabilities }) => {
        mocks.getCurrentUserProjection.mockResolvedValue({ ...USER, emailRequestCapabilities: capabilities });
        await expect(EmailRequestDashboardPage()).rejects.toThrow("NEXT_REDIRECT:/access-denied");
    });

    it("redirects an unauthenticated actor to login", async () => {
        mocks.getCurrentUserProjection.mockResolvedValue(null);
        await expect(EmailRequestDashboardPage()).rejects.toThrow("NEXT_REDIRECT:/login");
    });
});
