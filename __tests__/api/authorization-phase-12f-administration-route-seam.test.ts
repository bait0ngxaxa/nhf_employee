import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as AuthorizationModule from "@/modules/authorization";

import { AUTH_MUTATION_HEADERS } from "@/lib/auth/csrf";

const mocks = vi.hoisted(() => ({
    getApiAuthSession: vi.fn(),
    buildUserContext: vi.fn(),
    getOverview: vi.fn(),
    getTeam: vi.fn(),
    getUser: vi.fn(),
    searchUsers: vi.fn(),
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

vi.mock("@/lib/auth/server", () => ({
    getApiAuthSession: mocks.getApiAuthSession,
}));

vi.mock("@/lib/auth/context", () => ({
    buildUserContext: mocks.buildUserContext,
}));

vi.mock("@/modules/authorization", async (importOriginal) => {
    const actual = await importOriginal<typeof AuthorizationModule>();
    return {
        ...actual,
        getAuthorizationAdministrationOverview: mocks.getOverview,
        getAuthorizationAdministrationTeam: mocks.getTeam,
        getAuthorizationAdministrationUser: mocks.getUser,
        searchAuthorizationAdministrationUsers: mocks.searchUsers,
        createAuthorizationAdministrationTeam: mocks.createTeam,
        updateAuthorizationAdministrationTeam: mocks.updateTeam,
        addAuthorizationAdministrationTeamGrant: mocks.addTeamGrant,
        removeAuthorizationAdministrationTeamGrant: mocks.removeTeamGrant,
        addAuthorizationAdministrationTeamMember: mocks.addTeamMember,
        changeAuthorizationAdministrationTeamMemberRole:
            mocks.changeTeamMemberRole,
        removeAuthorizationAdministrationTeamMember: mocks.removeTeamMember,
        createAuthorizationAdministrationTeamRole: mocks.createTeamRole,
        updateAuthorizationAdministrationTeamRole: mocks.updateTeamRole,
        addAuthorizationAdministrationTeamRoleGrant: mocks.addTeamRoleGrant,
        removeAuthorizationAdministrationTeamRoleGrant:
            mocks.removeTeamRoleGrant,
        addAuthorizationAdministrationUserGrant: mocks.addUserGrant,
        removeAuthorizationAdministrationUserGrant: mocks.removeUserGrant,
    };
});

import { GET as getOverview, POST as createTeam } from
    "@/app/api/authorization/administration/route";
import {
    GET as getTeam,
    PATCH as updateTeam,
} from "@/app/api/authorization/administration/teams/[id]/route";
import {
    POST as addTeamGrant,
    DELETE as removeTeamGrant,
} from "@/app/api/authorization/administration/teams/[id]/grants/route";
import {
    POST as addTeamMember,
} from "@/app/api/authorization/administration/teams/[id]/members/route";
import {
    PATCH as changeTeamMemberRole,
    DELETE as removeTeamMember,
} from "@/app/api/authorization/administration/teams/[id]/members/[userId]/route";
import {
    POST as createTeamRole,
} from "@/app/api/authorization/administration/teams/[id]/roles/route";
import {
    PATCH as updateTeamRole,
} from "@/app/api/authorization/administration/teams/[id]/roles/[roleId]/route";
import {
    POST as addTeamRoleGrant,
    DELETE as removeTeamRoleGrant,
} from "@/app/api/authorization/administration/teams/[id]/roles/[roleId]/grants/route";
import {
    GET as searchAdministrationUsers,
} from "@/app/api/authorization/administration/users/route";
import {
    GET as getAdministrationUser,
} from "@/app/api/authorization/administration/users/[id]/route";
import {
    POST as addUserGrant,
    DELETE as removeUserGrant,
} from "@/app/api/authorization/administration/users/[id]/grants/route";

const ADMIN_SESSION_USER = {
    id: 41,
    email: "admin@example.com",
    name: "ผู้ดูแลทดสอบ",
    role: "ADMIN",
} as const;

const USER_CONTEXT = {
    id: ADMIN_SESSION_USER.id,
    email: ADMIN_SESSION_USER.email,
    name: ADMIN_SESSION_USER.name,
    role: ADMIN_SESSION_USER.role,
};

const GRANT_INPUT = {
    capabilityKey: "audit.read",
    scope: "ALL",
} as const;

function jsonRequest(
    path: string,
    method: "POST" | "PATCH" | "DELETE",
    body?: unknown,
): NextRequest {
    return new NextRequest(`http://localhost${path}`, {
        method,
        headers: {
            ...AUTH_MUTATION_HEADERS,
            origin: "http://localhost",
            ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
}

function params<T extends Record<string, string>>(values: T): { params: Promise<T> } {
    return { params: Promise.resolve(values) };
}

describe("Phase 12F direct Authorization Administration route seams", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getApiAuthSession.mockResolvedValue({
            user: {
                id: String(ADMIN_SESSION_USER.id),
                email: ADMIN_SESSION_USER.email,
                name: ADMIN_SESSION_USER.name,
                role: ADMIN_SESSION_USER.role,
            },
        });
        mocks.buildUserContext.mockReturnValue(USER_CONTEXT);
        mocks.getOverview.mockResolvedValue({ capabilities: [], teams: [], summary: {} });
        mocks.getTeam.mockResolvedValue({ id: 10 });
        mocks.getUser.mockResolvedValue({ user: { id: 7 }, effectiveAccess: [] });
        mocks.searchUsers.mockResolvedValue([{ id: 7 }]);
        mocks.createTeam.mockResolvedValue({ id: 10 });
        mocks.updateTeam.mockResolvedValue({ id: 10 });
        mocks.addTeamGrant.mockResolvedValue({ teamId: 10 });
        mocks.removeTeamGrant.mockResolvedValue({ teamId: 10 });
        mocks.addTeamMember.mockResolvedValue({ teamId: 10, userId: 7 });
        mocks.changeTeamMemberRole.mockResolvedValue({ teamId: 10, userId: 7 });
        mocks.removeTeamMember.mockResolvedValue({ teamId: 10, userId: 7 });
        mocks.createTeamRole.mockResolvedValue({ id: 20, teamId: 10 });
        mocks.updateTeamRole.mockResolvedValue({ id: 20, teamId: 10 });
        mocks.addTeamRoleGrant.mockResolvedValue({ teamRoleId: 20 });
        mocks.removeTeamRoleGrant.mockResolvedValue({ teamRoleId: 20 });
        mocks.addUserGrant.mockResolvedValue({ userId: 7 });
        mocks.removeUserGrant.mockResolvedValue({ userId: 7 });
    });

    it("uses the real session, role, and administration route boundary", async () => {
        const responses = await Promise.all([
            getOverview(),
            getTeam(
                new Request("http://localhost/api/authorization/administration/teams/10"),
                params({ id: "10" }),
            ),
            searchAdministrationUsers(
                new Request("http://localhost/api/authorization/administration/users?query=user"),
            ),
            getAdministrationUser(
                new Request("http://localhost/api/authorization/administration/users/7"),
                params({ id: "7" }),
            ),
            createTeam(
                jsonRequest(
                    "/api/authorization/administration",
                    "POST",
                    { key: "people", name: "People" },
                ),
            ),
            updateTeam(
                jsonRequest(
                    "/api/authorization/administration/teams/10",
                    "PATCH",
                    { name: "People Operations", isActive: true },
                ),
                params({ id: "10" }),
            ),
            addTeamGrant(
                jsonRequest(
                    "/api/authorization/administration/teams/10/grants",
                    "POST",
                    GRANT_INPUT,
                ),
                params({ id: "10" }),
            ),
            removeTeamGrant(
                jsonRequest(
                    "/api/authorization/administration/teams/10/grants",
                    "DELETE",
                    GRANT_INPUT,
                ),
                params({ id: "10" }),
            ),
            addTeamMember(
                jsonRequest(
                    "/api/authorization/administration/teams/10/members",
                    "POST",
                    { userId: 7, teamRoleId: 20 },
                ),
                params({ id: "10" }),
            ),
            changeTeamMemberRole(
                jsonRequest(
                    "/api/authorization/administration/teams/10/members/7",
                    "PATCH",
                    { teamRoleId: null },
                ),
                params({ id: "10", userId: "7" }),
            ),
            removeTeamMember(
                jsonRequest(
                    "/api/authorization/administration/teams/10/members/7",
                    "DELETE",
                ),
                params({ id: "10", userId: "7" }),
            ),
            createTeamRole(
                jsonRequest(
                    "/api/authorization/administration/teams/10/roles",
                    "POST",
                    { key: "operator", name: "Operator" },
                ),
                params({ id: "10" }),
            ),
            updateTeamRole(
                jsonRequest(
                    "/api/authorization/administration/teams/10/roles/20",
                    "PATCH",
                    { name: "Team Operator", isActive: true },
                ),
                params({ id: "10", roleId: "20" }),
            ),
            addTeamRoleGrant(
                jsonRequest(
                    "/api/authorization/administration/teams/10/roles/20/grants",
                    "POST",
                    GRANT_INPUT,
                ),
                params({ id: "10", roleId: "20" }),
            ),
            removeTeamRoleGrant(
                jsonRequest(
                    "/api/authorization/administration/teams/10/roles/20/grants",
                    "DELETE",
                    GRANT_INPUT,
                ),
                params({ id: "10", roleId: "20" }),
            ),
            addUserGrant(
                jsonRequest(
                    "/api/authorization/administration/users/7/grants",
                    "POST",
                    GRANT_INPUT,
                ),
                params({ id: "7" }),
            ),
            removeUserGrant(
                jsonRequest(
                    "/api/authorization/administration/users/7/grants",
                    "DELETE",
                    GRANT_INPUT,
                ),
                params({ id: "7" }),
            ),
        ]);

        expect(responses.map((response) => response.status)).toEqual([
            200, 200, 200, 200, 201, 200, 201, 200, 201,
            200, 200, 201, 200, 201, 200, 201, 200,
        ]);
        expect(mocks.buildUserContext).toHaveBeenCalled();
        expect(mocks.addUserGrant).toHaveBeenCalledWith(
            expect.objectContaining({
                principal: { userId: ADMIN_SESSION_USER.id, systemRole: "ADMIN" },
            }),
            7,
            GRANT_INPUT,
        );
        expect(mocks.removeUserGrant).toHaveBeenCalledWith(
            expect.objectContaining({
                principal: { userId: ADMIN_SESSION_USER.id, systemRole: "ADMIN" },
            }),
            7,
            GRANT_INPUT,
        );
    });

    it("denies a persisted USER through the server boundary even with target/admin input", async () => {
        mocks.getApiAuthSession.mockResolvedValue({
            user: {
                id: "41",
                email: ADMIN_SESSION_USER.email,
                name: ADMIN_SESSION_USER.name,
                role: "USER",
            },
        });
        mocks.buildUserContext.mockReturnValue({
            ...USER_CONTEXT,
            role: "USER",
        });

        const response = await createTeam(
            jsonRequest(
                "/api/authorization/administration",
                "POST",
                {
                    key: "people",
                    name: "People",
                    role: "ADMIN",
                    userId: 999,
                },
            ),
        );

        expect(response.status).toBe(403);
        expect(mocks.createTeam).not.toHaveBeenCalled();
    });

    it("fails closed for malformed target identifiers before the administration command", async () => {
        const response = await getTeam(
            new Request("http://localhost/api/authorization/administration/teams/not-an-id"),
            params({ id: "not-an-id" }),
        );

        expect(response.status).toBe(400);
        expect(mocks.getTeam).not.toHaveBeenCalled();
    });
});
