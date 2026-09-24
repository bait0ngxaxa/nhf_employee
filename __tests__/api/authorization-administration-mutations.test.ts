import { NextRequest, NextResponse } from "next/server";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as AuthModule from "@/modules/auth";
import type * as AuthorizationModule from "@/modules/authorization";

import { AUTH_MUTATION_HEADERS } from "@/lib/auth/csrf";

const mocks = vi.hoisted(() => ({
    requireAdminSession: vi.fn(),
    getOverview: vi.fn(),
    createTeam: vi.fn(),
    updateTeam: vi.fn(),
    addTeamGrant: vi.fn(),
    removeTeamGrant: vi.fn(),
    addTeamMember: vi.fn(),
    changeTeamMemberRole: vi.fn(),
    removeTeamMember: vi.fn(),
    createTeamRole: vi.fn(),
    updateTeamRole: vi.fn(),
    addTeamRoleGrant: vi.fn(),
    removeTeamRoleGrant: vi.fn(),
    addUserGrant: vi.fn(),
    removeUserGrant: vi.fn(),
    changeSystemRole: vi.fn(),
}));

vi.mock("@/lib/auth/api", () => ({
    requireAdminSession: mocks.requireAdminSession,
}));

vi.mock("@/modules/authorization", async (importOriginal) => {
    const actual = await importOriginal<typeof AuthorizationModule>();
    return {
        ...actual,
        getAuthorizationAdministrationOverview: mocks.getOverview,
        createAuthorizationAdministrationTeam: mocks.createTeam,
        updateAuthorizationAdministrationTeam: mocks.updateTeam,
        addAuthorizationAdministrationTeamGrant: mocks.addTeamGrant,
        removeAuthorizationAdministrationTeamGrant: mocks.removeTeamGrant,
        addAuthorizationAdministrationTeamMember: mocks.addTeamMember,
        changeAuthorizationAdministrationTeamMemberRole: mocks.changeTeamMemberRole,
        removeAuthorizationAdministrationTeamMember: mocks.removeTeamMember,
        createAuthorizationAdministrationTeamRole: mocks.createTeamRole,
        updateAuthorizationAdministrationTeamRole: mocks.updateTeamRole,
        addAuthorizationAdministrationTeamRoleGrant: mocks.addTeamRoleGrant,
        removeAuthorizationAdministrationTeamRoleGrant: mocks.removeTeamRoleGrant,
        addAuthorizationAdministrationUserGrant: mocks.addUserGrant,
        removeAuthorizationAdministrationUserGrant: mocks.removeUserGrant,
    };
});

vi.mock("@/modules/auth", async (importOriginal) => ({
    ...(await importOriginal<typeof AuthModule>()),
    changeSystemRole: mocks.changeSystemRole,
}));

import { POST as createTeam } from "@/app/api/authorization/administration/route";
import { GET as getOverview } from "@/app/api/authorization/administration/route";
import { PATCH as updateTeam } from "@/app/api/authorization/administration/teams/[id]/route";
import {
    DELETE as removeTeamGrant,
    POST as addTeamGrant,
} from "@/app/api/authorization/administration/teams/[id]/grants/route";
import {
    POST as addTeamMember,
} from "@/app/api/authorization/administration/teams/[id]/members/route";
import {
    DELETE as removeTeamMember,
    PATCH as changeTeamMemberRole,
} from "@/app/api/authorization/administration/teams/[id]/members/[userId]/route";
import {
    POST as createTeamRole,
} from "@/app/api/authorization/administration/teams/[id]/roles/route";
import {
    PATCH as updateTeamRole,
} from "@/app/api/authorization/administration/teams/[id]/roles/[roleId]/route";
import {
    DELETE as removeTeamRoleGrant,
    POST as addTeamRoleGrant,
} from "@/app/api/authorization/administration/teams/[id]/roles/[roleId]/grants/route";
import {
    DELETE as removeUserGrant,
    POST as addUserGrant,
} from "@/app/api/authorization/administration/users/[id]/grants/route";
import { PATCH as changeSystemRole } from "@/app/api/authorization/administration/users/[id]/system-role/route";
import { AuthorizationAdministrationAccessError } from "@/modules/authorization";

const ADMIN_USER = {
    id: 41,
    role: "ADMIN",
    email: "admin@example.com",
    name: "Admin",
};

type RouteHandler = (
    request: Request,
    context: { readonly params: Promise<Record<string, string>> },
) => Promise<NextResponse>;

function invokeRoute(
    handler: unknown,
    request: Request,
    params: Record<string, string>,
): Promise<NextResponse> {
    if (typeof handler !== "function") {
        throw new Error("Expected a route handler");
    }
    return (handler as RouteHandler)(request, { params: Promise.resolve(params) });
}

function jsonRequest(
    path: string,
    method: "POST" | "PATCH" | "DELETE",
    body?: unknown,
): NextRequest {
    return new NextRequest(`http://localhost${path}`, {
        method,
        body: body === undefined ? undefined : JSON.stringify(body),
        headers: {
            ...AUTH_MUTATION_HEADERS,
            origin: "http://localhost",
            ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
    });
}

const mutationRoutes = [
    {
        method: "POST",
        path: "/api/authorization/administration",
        body: { key: "people", name: "People" },
        params: {},
        handler: createTeam,
        command: mocks.createTeam,
    },
    {
        method: "PATCH",
        path: "/api/authorization/administration/teams/10",
        body: { name: "People", isActive: false },
        params: { id: "10" },
        handler: updateTeam,
        command: mocks.updateTeam,
    },
    {
        method: "POST",
        path: "/api/authorization/administration/teams/10/grants",
        body: { capabilityKey: "audit.read", scope: "ALL" },
        params: { id: "10" },
        handler: addTeamGrant,
        command: mocks.addTeamGrant,
    },
    {
        method: "DELETE",
        path: "/api/authorization/administration/teams/10/grants",
        body: { capabilityKey: "audit.read", scope: "ALL" },
        params: { id: "10" },
        handler: removeTeamGrant,
        command: mocks.removeTeamGrant,
    },
    {
        method: "POST",
        path: "/api/authorization/administration/teams/10/members",
        body: { userId: 7 },
        params: { id: "10" },
        handler: addTeamMember,
        command: mocks.addTeamMember,
    },
    {
        method: "PATCH",
        path: "/api/authorization/administration/teams/10/members/7",
        body: { teamRoleId: null },
        params: { id: "10", userId: "7" },
        handler: changeTeamMemberRole,
        command: mocks.changeTeamMemberRole,
    },
    {
        method: "DELETE",
        path: "/api/authorization/administration/teams/10/members/7",
        body: undefined,
        params: { id: "10", userId: "7" },
        handler: removeTeamMember,
        command: mocks.removeTeamMember,
    },
    {
        method: "POST",
        path: "/api/authorization/administration/teams/10/roles",
        body: { key: "operator", name: "Operator" },
        params: { id: "10" },
        handler: createTeamRole,
        command: mocks.createTeamRole,
    },
    {
        method: "PATCH",
        path: "/api/authorization/administration/teams/10/roles/20",
        body: { name: "Operator" },
        params: { id: "10", roleId: "20" },
        handler: updateTeamRole,
        command: mocks.updateTeamRole,
    },
    {
        method: "POST",
        path: "/api/authorization/administration/teams/10/roles/20/grants",
        body: { capabilityKey: "audit.read", scope: "ALL" },
        params: { id: "10", roleId: "20" },
        handler: addTeamRoleGrant,
        command: mocks.addTeamRoleGrant,
    },
    {
        method: "DELETE",
        path: "/api/authorization/administration/teams/10/roles/20/grants",
        body: { capabilityKey: "audit.read", scope: "ALL" },
        params: { id: "10", roleId: "20" },
        handler: removeTeamRoleGrant,
        command: mocks.removeTeamRoleGrant,
    },
    {
        method: "POST",
        path: "/api/authorization/administration/users/7/grants",
        body: { capabilityKey: "audit.read", scope: "ALL" },
        params: { id: "7" },
        handler: addUserGrant,
        command: mocks.addUserGrant,
    },
    {
        method: "DELETE",
        path: "/api/authorization/administration/users/7/grants",
        body: { capabilityKey: "audit.read", scope: "ALL" },
        params: { id: "7" },
        handler: removeUserGrant,
        command: mocks.removeUserGrant,
    },
    {
        method: "PATCH",
        path: "/api/authorization/administration/users/7/system-role",
        body: { systemRole: "USER" },
        params: { id: "7" },
        handler: changeSystemRole,
        command: mocks.changeSystemRole,
    },
] as const;

const administrationRouteDirectory = resolve(
    process.cwd(),
    "app/api/authorization/administration",
);

function findRouteFiles(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const entryPath = join(directory, entry.name);
        if (entry.isDirectory()) return findRouteFiles(entryPath);
        return entry.name === "route.ts" ? [entryPath] : [];
    });
}

function normalizeTestRoutePath(path: string): string {
    return path
        .replace(/(\/teams)\/\d+(?=\/|$)/, "$1/[id]")
        .replace(/(\/members)\/\d+(?=\/|$)/, "$1/[userId]")
        .replace(/(\/roles)\/\d+(?=\/|$)/, "$1/[roleId]")
        .replace(/(\/users)\/\d+(?=\/|$)/, "$1/[id]");
}

describe("Authorization Administration mutation API boundary", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.requireAdminSession.mockResolvedValue({
            ok: true,
            user: ADMIN_USER,
            session: { user: { ...ADMIN_USER, id: String(ADMIN_USER.id) } },
        });
        mocks.getOverview.mockResolvedValue({ teams: [] });
        mocks.createTeam.mockResolvedValue({ id: 10, key: "people" });
        mocks.updateTeam.mockResolvedValue({ id: 10, key: "people", isActive: false });
        mocks.addTeamGrant.mockResolvedValue({
            teamId: 10,
            capabilityKey: "audit.read",
            scope: "ALL",
        });
        mocks.removeTeamGrant.mockResolvedValue({
            teamId: 10,
            capabilityKey: "audit.read",
            scope: "ALL",
        });
        mocks.addTeamMember.mockResolvedValue({
            teamId: 10,
            userId: 7,
            teamRoleId: 20,
        });
        mocks.changeTeamMemberRole.mockResolvedValue({
            teamId: 10,
            userId: 7,
            teamRoleId: null,
        });
        mocks.removeTeamMember.mockResolvedValue({
            teamId: 10,
            userId: 7,
            teamRoleId: null,
        });
        mocks.createTeamRole.mockResolvedValue({ id: 20, teamId: 10 });
        mocks.updateTeamRole.mockResolvedValue({ id: 20, teamId: 10 });
        mocks.addTeamRoleGrant.mockResolvedValue({
            teamId: 10,
            teamRoleId: 20,
            capabilityKey: "audit.read",
            scope: "ALL",
        });
        mocks.removeTeamRoleGrant.mockResolvedValue({
            teamId: 10,
            teamRoleId: 20,
            capabilityKey: "audit.read",
            scope: "ALL",
        });
        mocks.addUserGrant.mockResolvedValue({
            userId: 7,
            capabilityKey: "audit.read",
            scope: "ALL",
        });
        mocks.removeUserGrant.mockResolvedValue({
            userId: 7,
            capabilityKey: "audit.read",
            scope: "ALL",
        });
        mocks.changeSystemRole.mockResolvedValue({
            userId: 7,
            before: "ADMIN",
            after: "USER",
        });
    });

    it("keeps the route matrix aligned with every exported mutation handler", () => {
        const sourceMutationExports: string[] = [];
        for (const routeFile of findRouteFiles(administrationRouteDirectory)) {
            const source = readFileSync(routeFile, "utf8");
            const relativeRoutePath = relative(administrationRouteDirectory, routeFile)
                .split(sep)
                .join("/");
            const routePath = relativeRoutePath === "route.ts"
                ? "/api/authorization/administration"
                : `/api/authorization/administration/${relativeRoutePath.replace(/\/route\.ts$/, "")}`;
            const exportPattern = /\bexport\s+(?:async\s+)?(?:function\s+(GET|HEAD|OPTIONS|POST|PUT|PATCH|DELETE)\b|const\s+(GET|HEAD|OPTIONS|POST|PUT|PATCH|DELETE)\s*=)/g;
            let exportedHandler: RegExpExecArray | null;

            while ((exportedHandler = exportPattern.exec(source)) !== null) {
                const method = exportedHandler[1] ?? exportedHandler[2];
                if (method === undefined) continue;
                if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
                    expect(source).not.toMatch(new RegExp(
                        `export\\s+const\\s+${method}\\s*=\\s*withTrustedMutation\\s*\\(`,
                    ));
                    continue;
                }

                sourceMutationExports.push(`${method} ${routePath}`);
                expect(source).toMatch(new RegExp(
                    `export\\s+const\\s+${method}\\s*=\\s*withTrustedMutation\\s*\\(`,
                ));
            }
        }

        expect(sourceMutationExports.sort()).toEqual(
            mutationRoutes
                .map((route) => `${route.method} ${normalizeTestRoutePath(route.path)}`)
                .sort(),
        );
    });

    it.each([
        ["missing Origin", { ...AUTH_MUTATION_HEADERS }],
        ["wrong Origin", { ...AUTH_MUTATION_HEADERS, origin: "https://evil.example.com" }],
        ["missing X-Requested-With", { origin: "http://localhost" }],
        ["wrong X-Requested-With", { origin: "http://localhost", "X-Requested-With": "fetch" }],
    ])("rejects the complete mutation route matrix when %s", async (_label, headers) => {
        for (const route of mutationRoutes) {
            const response = await invokeRoute(
                route.handler,
                new NextRequest(`http://localhost${route.path}`, {
                    method: route.method,
                    body: route.body === undefined ? undefined : JSON.stringify(route.body),
                    headers: {
                        ...headers,
                        ...(route.body === undefined ? {} : { "content-type": "application/json" }),
                    },
                }),
                route.params,
            );

            expect(response.status, `${route.method} ${route.path}`).toBe(403);
        }

        expect(mocks.requireAdminSession).not.toHaveBeenCalled();
        for (const route of mutationRoutes) {
            expect(route.command, `${route.method} ${route.path} command`).not.toHaveBeenCalled();
        }
    });

    it("leaves Authorization Administration GET routes outside the mutation gate", async () => {
        const response = await getOverview();

        expect(response.status).toBe(200);
        expect(mocks.requireAdminSession).toHaveBeenCalledOnce();
        expect(mocks.getOverview).toHaveBeenCalledWith({ userId: 41, systemRole: "ADMIN" });
    });

    it("rejects unauthenticated/non-ADMIN callers before the command", async () => {
        mocks.requireAdminSession.mockResolvedValue({
            ok: false,
            response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
        });

        const response = await createTeam(
            new NextRequest("http://localhost/api/authorization/administration", {
                method: "POST",
                body: JSON.stringify({ key: "people", name: "People" }),
                headers: {
                    "content-type": "application/json",
                    ...AUTH_MUTATION_HEADERS,
                    origin: "http://localhost",
                },
            }),
        );

        expect(response.status).toBe(403);
        expect(mocks.createTeam).not.toHaveBeenCalled();
    });

    it("does not accept actor identity or role from mutation JSON", async () => {
        const response = await createTeam(
            new NextRequest("http://localhost/api/authorization/administration", {
                method: "POST",
                body: JSON.stringify({
                    key: "people",
                    name: "People",
                    role: "ADMIN",
                    userId: 999,
                }),
                headers: {
                    "content-type": "application/json",
                    "cf-connecting-ip": "203.0.113.41",
                    "user-agent": "trusted-test-agent",
                    ...AUTH_MUTATION_HEADERS,
                    origin: "http://localhost",
                },
            }),
        );

        expect(response.status).toBe(400);
        expect(mocks.createTeam).not.toHaveBeenCalled();
    });

    it("passes only the server-derived ADMIN actor and trusted request metadata", async () => {
        const response = await createTeam(
            new NextRequest("http://localhost/api/authorization/administration", {
                method: "POST",
                body: JSON.stringify({ key: "people", name: "People" }),
                headers: {
                    "content-type": "application/json",
                    "cf-connecting-ip": "203.0.113.41",
                    "user-agent": "trusted-test-agent",
                    ...AUTH_MUTATION_HEADERS,
                    origin: "http://localhost",
                },
            }),
        );

        expect(response.status).toBe(201);
        expect(mocks.createTeam).toHaveBeenCalledWith(
            {
                principal: { userId: 41, systemRole: "ADMIN" },
                userEmail: "admin@example.com",
                ipAddress: "203.0.113.41",
                userAgent: "trusted-test-agent",
            },
            { key: "people", name: "People" },
        );
    });

    it("uses the [id] segment for Team grant route handlers", async () => {
        const input = { capabilityKey: "audit.read", scope: "ALL" };
        const addResponse = await invokeRoute(
            addTeamGrant,
            jsonRequest(
                "/api/authorization/administration/teams/10/grants",
                "POST",
                input,
            ),
            { id: "10" },
        );
        const removeResponse = await invokeRoute(
            removeTeamGrant,
            jsonRequest(
                "/api/authorization/administration/teams/10/grants",
                "DELETE",
                input,
            ),
            { id: "10" },
        );

        expect(addResponse.status).toBe(201);
        expect(removeResponse.status).toBe(200);
        expect(mocks.addTeamGrant).toHaveBeenCalledWith(
            expect.any(Object),
            10,
            input,
        );
        expect(mocks.removeTeamGrant).toHaveBeenCalledWith(
            expect.any(Object),
            10,
            input,
        );
    });

    it("uses the [id] segment for Team lifecycle updates", async () => {
        const input = { name: "People Operations", isActive: false };
        const response = await invokeRoute(
            updateTeam,
            jsonRequest(
                "/api/authorization/administration/teams/10",
                "PATCH",
                input,
            ),
            { id: "10" },
        );

        expect(response.status).toBe(200);
        expect(mocks.updateTeam).toHaveBeenCalledWith(
            expect.any(Object),
            10,
            input,
        );
    });

    it("uses the [id] segment for Team membership route handlers", async () => {
        const addResponse = await invokeRoute(
            addTeamMember,
            jsonRequest(
                "/api/authorization/administration/teams/10/members",
                "POST",
                { userId: 7, teamRoleId: 20 },
            ),
            { id: "10" },
        );
        const changeResponse = await invokeRoute(
            changeTeamMemberRole,
            jsonRequest(
                "/api/authorization/administration/teams/10/members/7",
                "PATCH",
                { teamRoleId: null },
            ),
            { id: "10", userId: "7" },
        );
        const removeResponse = await invokeRoute(
            removeTeamMember,
            jsonRequest(
                "/api/authorization/administration/teams/10/members/7",
                "DELETE",
            ),
            { id: "10", userId: "7" },
        );

        expect(addResponse.status).toBe(201);
        expect(changeResponse.status).toBe(200);
        expect(removeResponse.status).toBe(200);
        expect(mocks.addTeamMember).toHaveBeenCalledWith(
            expect.any(Object),
            10,
            { userId: 7, teamRoleId: 20 },
        );
        expect(mocks.changeTeamMemberRole).toHaveBeenCalledWith(
            expect.any(Object),
            10,
            7,
            { teamRoleId: null },
        );
        expect(mocks.removeTeamMember).toHaveBeenCalledWith(
            expect.any(Object),
            10,
            7,
        );
    });

    it("uses the [id] segment for TeamRole and TeamRole grant handlers", async () => {
        const createResponse = await invokeRoute(
            createTeamRole,
            jsonRequest(
                "/api/authorization/administration/teams/10/roles",
                "POST",
                { key: "operator", name: "Operator" },
            ),
            { id: "10" },
        );
        const updateResponse = await invokeRoute(
            updateTeamRole,
            jsonRequest(
                "/api/authorization/administration/teams/10/roles/20",
                "PATCH",
                { name: "Team Operator" },
            ),
            { id: "10", roleId: "20" },
        );
        const grantInput = { capabilityKey: "audit.read", scope: "ALL" };
        const addGrantResponse = await invokeRoute(
            addTeamRoleGrant,
            jsonRequest(
                "/api/authorization/administration/teams/10/roles/20/grants",
                "POST",
                grantInput,
            ),
            { id: "10", roleId: "20" },
        );
        const removeGrantResponse = await invokeRoute(
            removeTeamRoleGrant,
            jsonRequest(
                "/api/authorization/administration/teams/10/roles/20/grants",
                "DELETE",
                grantInput,
            ),
            { id: "10", roleId: "20" },
        );

        expect(createResponse.status).toBe(201);
        expect(updateResponse.status).toBe(200);
        expect(addGrantResponse.status).toBe(201);
        expect(removeGrantResponse.status).toBe(200);
        expect(mocks.createTeamRole).toHaveBeenCalledWith(
            expect.any(Object),
            10,
            { key: "operator", name: "Operator" },
        );
        expect(mocks.updateTeamRole).toHaveBeenCalledWith(
            expect.any(Object),
            10,
            20,
            { name: "Team Operator" },
        );
        expect(mocks.addTeamRoleGrant).toHaveBeenCalledWith(
            expect.any(Object),
            10,
            20,
            grantInput,
        );
        expect(mocks.removeTeamRoleGrant).toHaveBeenCalledWith(
            expect.any(Object),
            10,
            20,
            grantInput,
        );
    });

    it("uses the [id] segment and exact body for direct User grant handlers", async () => {
        const input = { capabilityKey: "audit.read", scope: "ALL" };
        const addResponse = await invokeRoute(
            addUserGrant,
            jsonRequest(
                "/api/authorization/administration/users/7/grants",
                "POST",
                input,
            ),
            { id: "7" },
        );
        const removeResponse = await invokeRoute(
            removeUserGrant,
            jsonRequest(
                "/api/authorization/administration/users/7/grants",
                "DELETE",
                input,
            ),
            { id: "7" },
        );

        expect(addResponse.status).toBe(201);
        expect(removeResponse.status).toBe(200);
        expect(mocks.addUserGrant).toHaveBeenCalledWith(
            expect.objectContaining({
                principal: { userId: ADMIN_USER.id, systemRole: "ADMIN" },
                userEmail: ADMIN_USER.email,
            }),
            7,
            input,
        );
        expect(mocks.removeUserGrant).toHaveBeenCalledWith(
            expect.objectContaining({
                principal: { userId: ADMIN_USER.id, systemRole: "ADMIN" },
                userEmail: ADMIN_USER.email,
            }),
            7,
            input,
        );
    });

    it("maps transaction-time Authorization Administration loss of access to 403", async () => {
        mocks.createTeam.mockRejectedValueOnce(new AuthorizationAdministrationAccessError());

        const response = await createTeam(
            jsonRequest(
                "/api/authorization/administration",
                "POST",
                { key: "people", name: "People" },
            ),
        );

        expect(response.status).toBe(403);
        expect(await response.json()).toEqual({ error: "Forbidden" });
    });
});
