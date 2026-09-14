import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as AuthorizationModule from "@/modules/authorization";

const mocks = vi.hoisted(() => ({
    requireAdminSession: vi.fn(),
    createTeam: vi.fn(),
}));

vi.mock("@/lib/auth/api", () => ({
    requireAdminSession: mocks.requireAdminSession,
}));

vi.mock("@/modules/authorization", async (importOriginal) => {
    const actual = await importOriginal<typeof AuthorizationModule>();
    return {
        ...actual,
        createAuthorizationAdministrationTeam: mocks.createTeam,
    };
});

import { POST as createTeam } from "@/app/api/authorization/administration/route";

const ADMIN_USER = {
    id: 41,
    role: "ADMIN",
    email: "admin@example.com",
    name: "Admin",
};

describe("Authorization Administration mutation API boundary", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.requireAdminSession.mockResolvedValue({
            ok: true,
            user: ADMIN_USER,
            session: { user: { ...ADMIN_USER, id: String(ADMIN_USER.id) } },
        });
        mocks.createTeam.mockResolvedValue({ id: 10, key: "people" });
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
});

