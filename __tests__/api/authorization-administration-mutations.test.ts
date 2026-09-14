import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as AuthorizationModule from "@/modules/authorization";

const mocks = vi.hoisted(() => ({
    requireAdminSession: vi.fn(),
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
}));

vi.mock("@/lib/auth/api", () => ({
    requireAdminSession: mocks.requireAdminSession,
}));

vi.mock("@/modules/authorization", async (importOriginal) => {
    const actual = await importOriginal<typeof AuthorizationModule>();
    return {
        ...actual,
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

import { POST as createTeam } from "@/app/api/authorization/administration/route";
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
        headers: body === undefined
            ? undefined
            : { "content-type": "application/json" },
    });
}

describe("Authorization Administration mutation API boundary", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.requireAdminSession.mockResolvedValue({
            ok: true,
            user: ADMIN_USER,
            session: { user: { ...ADMIN_USER, id: String(ADMIN_USER.id) } },
        });
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
    });

    it("rejects unauthenticated/non-ADMIN callers before the command", async () => {
        mocks.requireAdminSession.mockResolvedValue({
            ok: false,
            response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
        });

        const response = await createTeam(
            new Request("http://localhost/api/authorization/administration", {
                method: "POST",
                body: JSON.stringify({ key: "people", name: "People" }),
                headers: { "content-type": "application/json" },
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
            expect.any(Object),
            7,
            input,
        );
        expect(mocks.removeUserGrant).toHaveBeenCalledWith(
            expect.any(Object),
            7,
            input,
        );
    });
});
