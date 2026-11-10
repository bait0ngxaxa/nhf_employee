// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CSRF_ENFORCEMENT_MODE_ENV } from "@/lib/auth/csrf";
import { AUTH_ERROR_MESSAGES } from "@/lib/auth/ssot";
import { requireApiSession } from "@/lib/auth/api";
import type * as AuthApiModule from "@/lib/auth/api";
import { trustedMutationHeaders } from "@/__tests__/helpers/trusted-mutation";
import { trustedMutationExemptions } from "../../scripts/check-architecture.mjs";

vi.mock("@/lib/auth/api", async (importOriginal) => ({
    ...await importOriginal<typeof AuthApiModule>(),
    requireApiSession: vi.fn(),
}));

const MUTATION_METHODS = ["POST", "PUT", "PATCH", "DELETE"] as const;
type MutationMethod = (typeof MUTATION_METHODS)[number];
type RouteHandler = (request: NextRequest, context: unknown) => Promise<Response>;

const repositoryRoot = path.resolve(__dirname, "../..");
const apiRoot = path.join(repositoryRoot, "app", "api");

/** Guarded before the CSRF coverage rollout; these must always enforce. */
const PRE_ROLLOUT_GUARDED_ROUTES = [
    "app/api/announcements/manage/route.ts",
    "app/api/auth/hybrid-login/route.ts",
    "app/api/auth/logout-all/route.ts",
    "app/api/auth/logout/route.ts",
    "app/api/auth/refresh/route.ts",
    "app/api/auth/sessions/revoke/route.ts",
    "app/api/auth/signup/route.ts",
    "app/api/authorization/administration/route.ts",
    "app/api/authorization/administration/teams/[id]/grants/route.ts",
    "app/api/authorization/administration/teams/[id]/members/[userId]/route.ts",
    "app/api/authorization/administration/teams/[id]/members/route.ts",
    "app/api/authorization/administration/teams/[id]/roles/[roleId]/grants/route.ts",
    "app/api/authorization/administration/teams/[id]/roles/[roleId]/route.ts",
    "app/api/authorization/administration/teams/[id]/roles/route.ts",
    "app/api/authorization/administration/teams/[id]/route.ts",
    "app/api/authorization/administration/users/[id]/grants/route.ts",
    "app/api/authorization/administration/users/[id]/system-role/route.ts",
    "app/api/leave/special-reason/route.ts",
    "app/api/line/account-link/route.ts",
    "app/api/line/leave/special-reason/route.ts",
    "app/api/line/liff/session/route.ts",
] as const;

function listRouteFiles(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) return listRouteFiles(entryPath);
        return entry.name === "route.ts" ? [entryPath] : [];
    });
}

interface MutationRoute {
    readonly repositoryPath: string;
    readonly absolutePath: string;
    readonly methods: readonly MutationMethod[];
    readonly rollout: boolean;
}

const mutationRoutes: readonly MutationRoute[] = listRouteFiles(apiRoot)
    .map((absolutePath) => {
        const source = readFileSync(absolutePath, "utf8");
        const methods = MUTATION_METHODS.filter((method) =>
            new RegExp(`export (?:async function|const) ${method}\\b`).test(source));
        return {
            repositoryPath: path.relative(repositoryRoot, absolutePath).split(path.sep).join("/"),
            absolutePath,
            methods,
            rollout: source.includes("TRUSTED_MUTATION_ROLLOUT"),
        };
    })
    .filter((route) => route.methods.length > 0)
    .sort((left, right) => left.repositoryPath.localeCompare(right.repositoryPath));

const guardedRoutes = mutationRoutes.filter((route) => !trustedMutationExemptions.has(route.repositoryPath));
const guardedCases = guardedRoutes.flatMap((route) =>
    route.methods.map((method) => [route.repositoryPath, method, route] as const));

function routeUrl(repositoryPath: string): string {
    const routePath = repositoryPath
        .replace(/^app/, "")
        .replace(/\/route\.ts$/, "")
        .replace(/\[[^\]]+\]/g, "1");
    return `http://localhost${routePath}`;
}

const routeContext = { params: Promise.resolve({ id: "1", ticketId: "1", userId: "1", roleId: "1" }) };

const UNTRUSTED_HEADER_CASES: ReadonlyArray<readonly [string, (url: string) => Record<string, string>]> = [
    ["missing Origin", () => ({ "x-requested-with": "XMLHttpRequest" })],
    ["foreign Origin", () => ({ origin: "https://evil.example.com", "x-requested-with": "XMLHttpRequest" })],
    ["missing X-Requested-With", (url) => ({ origin: trustedMutationHeaders(url).origin })],
];

async function loadHandler(route: MutationRoute, method: MutationMethod): Promise<RouteHandler> {
    const routeModule = await import(/* @vite-ignore */ route.absolutePath) as Record<string, unknown>;
    const handler = routeModule[method];
    if (typeof handler !== "function") throw new Error(`${route.repositoryPath} does not export ${method}`);
    return handler as RouteHandler;
}

describe("trusted-mutation CSRF coverage across app/api", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
    });

    it("discovers every mutation route and exempts only the machine-to-machine ones", () => {
        expect(mutationRoutes.length).toBeGreaterThanOrEqual(74);
        expect(mutationRoutes.length - guardedRoutes.length).toBe(trustedMutationExemptions.size);
        for (const exemptPath of trustedMutationExemptions.keys()) {
            expect(mutationRoutes.map((route) => route.repositoryPath)).toContain(exemptPath);
        }
    });

    it("keeps routes guarded before the rollout on unconditional enforcement", () => {
        for (const repositoryPath of PRE_ROLLOUT_GUARDED_ROUTES) {
            const route = guardedRoutes.find((candidate) => candidate.repositoryPath === repositoryPath);
            expect(route, repositoryPath).toBeDefined();
            expect(route?.rollout, repositoryPath).toBe(false);
        }
    });

    describe.each(UNTRUSTED_HEADER_CASES)("%s", (_label, buildHeaders) => {
        it.each(guardedCases)("%s %s returns 403 before the handler runs", async (repositoryPath, method, route) => {
            const handler = await loadHandler(route, method);
            const url = routeUrl(repositoryPath);
            const response = await handler(
                new NextRequest(url, { method, headers: buildHeaders(url) }),
                routeContext,
            );

            expect(response.status).toBe(403);
            await expect(response.json()).resolves.toEqual({ error: AUTH_ERROR_MESSAGES.forbidden });
        });

        it.each(guardedCases.filter(([, , route]) => !route.rollout))(
            "%s %s still returns 403 when CSRF_ENFORCEMENT_MODE=report",
            async (repositoryPath, method, route) => {
                vi.stubEnv(CSRF_ENFORCEMENT_MODE_ENV, "report");
                const handler = await loadHandler(route, method);
                const url = routeUrl(repositoryPath);
                const response = await handler(
                    new NextRequest(url, { method, headers: buildHeaders(url) }),
                    routeContext,
                );

                expect(response.status).toBe(403);
            },
        );
    });
});

describe("CSRF report mode on a newly guarded route", () => {
    const url = "http://localhost/api/notifications/mark-all-read";

    beforeEach(() => {
        vi.mocked(requireApiSession).mockReset();
        vi.mocked(requireApiSession).mockResolvedValue({
            ok: false,
            response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        });
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
    });

    it("enforce (default) rejects a forged request before authentication", async () => {
        const { POST } = await import("@/app/api/notifications/mark-all-read/route");

        const response = await POST(new NextRequest(url, { method: "POST" }));

        expect(response.status).toBe(403);
        expect(requireApiSession).not.toHaveBeenCalled();
    });

    it("report lets the request reach the existing authentication and logs a sanitized warning", async () => {
        vi.stubEnv(CSRF_ENFORCEMENT_MODE_ENV, "report");
        const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
        const { POST } = await import("@/app/api/notifications/mark-all-read/route");

        const response = await POST(new NextRequest(url, {
            method: "POST",
            headers: { origin: "https://evil.example.com", cookie: "__Host-nhf_access=secret-cookie" },
        }));

        expect(response.status).toBe(401);
        expect(requireApiSession).toHaveBeenCalledOnce();
        expect(warn).toHaveBeenCalledWith(
            "[csrf] report mode: trusted mutation check failed; request allowed",
            {
                route: "/api/notifications/mark-all-read",
                method: "POST",
                check: "untrusted-origin",
                originHost: "evil.example.com",
            },
        );
        expect(JSON.stringify(warn.mock.calls)).not.toContain("secret-cookie");
    });

    it("a trusted request behaves exactly as before in both modes", async () => {
        const { POST } = await import("@/app/api/notifications/mark-all-read/route");
        for (const mode of ["enforce", "report"]) {
            vi.stubEnv(CSRF_ENFORCEMENT_MODE_ENV, mode);
            const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
            const response = await POST(new NextRequest(url, { method: "POST", headers: trustedMutationHeaders(url) }));
            expect(response.status).toBe(401);
            expect(warn).not.toHaveBeenCalled();
        }
        expect(requireApiSession).toHaveBeenCalledTimes(2);
    });
});
