import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as AuthorizationModule from "@/modules/authorization";

const mocks = vi.hoisted(() => ({
    requireAdminSession: vi.fn(),
    getOverview: vi.fn(),
    getTeam: vi.fn(),
    getUser: vi.fn(),
    searchUsers: vi.fn(),
}));

vi.mock("@/lib/auth/api", () => ({
    requireAdminSession: mocks.requireAdminSession,
}));

vi.mock("@/modules/authorization", async (importOriginal) => {
    const actual = await importOriginal<typeof AuthorizationModule>();
    return {
        ...actual,
        getAuthorizationAdministrationOverview: mocks.getOverview,
        getAuthorizationAdministrationTeam: mocks.getTeam,
        getAuthorizationAdministrationUser: mocks.getUser,
        searchAuthorizationAdministrationUsers: mocks.searchUsers,
    };
});

import { GET as getOverview } from "@/app/api/authorization/administration/route";
import { GET as getTeam } from "@/app/api/authorization/administration/teams/[id]/route";
import { GET as getUser } from "@/app/api/authorization/administration/users/[id]/route";

const ADMIN_USER = {
    id: 41,
    role: "ADMIN",
    email: "admin@example.com",
    name: "Admin",
};

function allowAdmin(): void {
    mocks.requireAdminSession.mockResolvedValue({
        ok: true,
        user: ADMIN_USER,
        session: { user: { ...ADMIN_USER, id: String(ADMIN_USER.id) } },
    });
}

describe("Authorization Administration API boundary", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        allowAdmin();
        mocks.getOverview.mockResolvedValue({
            capabilities: [],
            teams: [],
            summary: {
                registeredCapabilityCount: 0,
                administrativelyGrantableCapabilityCount: 0,
                policyActivationRequiredCapabilityCount: 0,
                deferredCapabilityCount: 0,
                teamCount: 0,
                activeTeamCount: 0,
            },
        });
        mocks.getTeam.mockResolvedValue({ id: 10 });
        mocks.getUser.mockResolvedValue({ user: { id: 7 } });
        mocks.searchUsers.mockResolvedValue([{ id: 7, name: "User 7" }]);
    });

    it("returns 401 and does not execute a query when authentication fails", async () => {
        mocks.requireAdminSession.mockResolvedValue({
            ok: false,
            response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        });

        const response = await getOverview();

        expect(response.status).toBe(401);
        expect(mocks.getOverview).not.toHaveBeenCalled();
    });

    it("returns 403 for a normal USER before reaching the administration query", async () => {
        mocks.requireAdminSession.mockResolvedValue({
            ok: false,
            response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
        });

        const response = await getOverview();

        expect(response.status).toBe(403);
        expect(mocks.getOverview).not.toHaveBeenCalled();
    });

    it("allows ADMIN and passes only the server-derived administration principal", async () => {
        const response = await getOverview();

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            overview: {
                capabilities: [],
                teams: [],
                summary: {
                    registeredCapabilityCount: 0,
                    administrativelyGrantableCapabilityCount: 0,
                    policyActivationRequiredCapabilityCount: 0,
                    deferredCapabilityCount: 0,
                    teamCount: 0,
                    activeTeamCount: 0,
                },
            },
        });
        expect(mocks.getOverview).toHaveBeenCalledWith({
            userId: 41,
            systemRole: "ADMIN",
        });
    });

    it("does not let a client role parameter bypass the USER boundary", async () => {
        mocks.requireAdminSession.mockResolvedValue({
            ok: false,
            response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
        });

        const response = await getTeam(
            new NextRequest(
                "http://localhost/api/authorization/administration/teams/10?role=ADMIN",
                { method: "GET" },
            ),
            { params: Promise.resolve({ id: "10" }) },
        );

        expect(response.status).toBe(403);
        expect(mocks.getTeam).not.toHaveBeenCalled();
    });

    it("protects Team and User detail entry points with the same boundary", async () => {
        const teamResponse = await getTeam(
            new Request("http://localhost/api/authorization/administration/teams/10"),
            { params: Promise.resolve({ id: "10" }) },
        );
        const userResponse = await getUser(
            new Request("http://localhost/api/authorization/administration/users/7"),
            { params: Promise.resolve({ id: "7" }) },
        );

        expect(teamResponse.status).toBe(200);
        expect(userResponse.status).toBe(200);
        expect(mocks.getTeam).toHaveBeenCalledWith(
            { userId: 41, systemRole: "ADMIN" },
            10,
        );
        expect(mocks.getUser).toHaveBeenCalledWith(
            { userId: 41, systemRole: "ADMIN" },
            7,
        );
    });

    it("protects the bounded User directory and passes the search query", async () => {
        const { GET } = await import(
            "@/app/api/authorization/administration/users/route"
        );
        const response = await GET(
            new Request(
                "http://localhost/api/authorization/administration/users?query=สมชาย",
            ),
        );

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            users: [{ id: 7, name: "User 7" }],
        });
        expect(mocks.searchUsers).toHaveBeenCalledWith(
            { userId: 41, systemRole: "ADMIN" },
            "สมชาย",
        );
    });

    it("rejects a non-ADMIN User directory request before searching", async () => {
        mocks.requireAdminSession.mockResolvedValue({
            ok: false,
            response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
        });
        const { GET } = await import(
            "@/app/api/authorization/administration/users/route"
        );

        const response = await GET(
            new Request(
                "http://localhost/api/authorization/administration/users?query=สมชาย",
            ),
        );

        expect(response.status).toBe(403);
        expect(mocks.searchUsers).not.toHaveBeenCalled();
    });

    it("rejects an overlong User directory query before the application read", async () => {
        const { GET } = await import(
            "@/app/api/authorization/administration/users/route"
        );
        const response = await GET(
            new Request(
                `http://localhost/api/authorization/administration/users?query=${"x".repeat(101)}`,
            ),
        );

        expect(response.status).toBe(400);
        expect(mocks.searchUsers).not.toHaveBeenCalled();
    });

    it("rejects malformed resource identifiers before querying", async () => {
        const response = await getTeam(
            new Request("http://localhost/api/authorization/administration/teams/not-an-id"),
            { params: Promise.resolve({ id: "not-an-id" }) },
        );

        expect(response.status).toBe(400);
        expect(mocks.getTeam).not.toHaveBeenCalled();
    });
});
