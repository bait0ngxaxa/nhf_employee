import { render, screen, waitFor } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    HybridAuthProvider,
    useAuth,
} from "@/components/auth/HybridAuthProvider";
import { APP_ROUTES, API_ROUTES } from "@/lib/ssot/routes";

const { usePathnameMock } = vi.hoisted(() => ({
    usePathnameMock: vi.fn(() => "/login"),
}));

vi.mock("next/navigation", () => ({
    usePathname: usePathnameMock,
}));

function getRequestUrl(input: RequestInfo | URL): string {
    if (input instanceof Request) {
        return input.url;
    }
    return String(input);
}

function createJsonResponse(status: number): Response {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status,
        headers: { "content-type": "application/json" },
    });
}

function createAuthMeResponse(): Response {
    return new Response(
        JSON.stringify({
            user: {
                id: "1",
                role: "ADMIN",
                email: "admin@test.com",
            },
        }),
        {
            status: 200,
            headers: { "content-type": "application/json" },
        },
    );
}

function AuthStatusProbe(): ReactElement {
    const { status } = useAuth();

    return <div data-testid="auth-status">{status}</div>;
}

function renderAuthProvider(children: ReactNode): void {
    render(
        <SWRConfig
            value={{
                provider: () => new Map(),
                dedupingInterval: 0,
            }}
        >
            <HybridAuthProvider>{children}</HybridAuthProvider>
        </SWRConfig>,
    );
}

describe("HybridAuthProvider", () => {
    beforeEach(() => {
        usePathnameMock.mockReturnValue(APP_ROUTES.login);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("does not check or refresh session on public auth routes", async () => {
        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockImplementation(async (input: RequestInfo | URL) => {
                const url = getRequestUrl(input);
                if (
                    url === API_ROUTES.auth.me ||
                    url === API_ROUTES.auth.refresh
                ) {
                    return createJsonResponse(401);
                }

                return createJsonResponse(404);
            });

        renderAuthProvider(<AuthStatusProbe />);

        await waitFor(() => {
            expect(screen.getByTestId("auth-status")).toHaveTextContent(
                "unauthenticated",
            );
        });

        const calledUrls = fetchMock.mock.calls.map(([input]) =>
            getRequestUrl(input),
        );

        expect(calledUrls).not.toContain(API_ROUTES.auth.me);
        expect(calledUrls).not.toContain(API_ROUTES.auth.refresh);
    });

    it("checks current user on protected routes", async () => {
        usePathnameMock.mockReturnValue(APP_ROUTES.dashboard);
        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockImplementation(async (input: RequestInfo | URL) => {
                const url = getRequestUrl(input);
                if (url === API_ROUTES.auth.me) {
                    return createAuthMeResponse();
                }

                return createJsonResponse(404);
            });

        renderAuthProvider(<AuthStatusProbe />);

        await waitFor(() => {
            expect(screen.getByTestId("auth-status")).toHaveTextContent(
                "authenticated",
            );
        });

        const calledUrls = fetchMock.mock.calls.map(([input]) =>
            getRequestUrl(input),
        );

        expect(calledUrls).toContain(API_ROUTES.auth.me);
        expect(calledUrls).not.toContain(API_ROUTES.auth.refresh);
    });
});
