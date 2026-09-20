import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    changeSystemRole: vi.fn(),
    buildContext: vi.fn(),
    requireSession: vi.fn(),
}));

vi.mock("@/modules/auth", async (importOriginal) => ({
    ...(await importOriginal()),
    changeSystemRole: mocks.changeSystemRole,
}));

vi.mock("@/app/api/authorization/administration/_lib/route-auth", () => ({
    buildAuthorizationAdministrationMutationContext: mocks.buildContext,
    requireAuthorizationAdministrationApiSession: mocks.requireSession,
}));

import { SystemRoleChangeError } from "@/modules/auth";
import { PATCH } from "@/app/api/authorization/administration/users/[id]/system-role/route";

describe("PATCH /api/authorization/administration/users/[id]/system-role", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.requireSession.mockResolvedValue({
            ok: true,
            principal: { userId: 99, systemRole: "ADMIN" },
            userEmail: "admin@example.com",
        });
        mocks.buildContext.mockReturnValue({
            principal: { userId: 99, systemRole: "ADMIN" },
            userEmail: "admin@example.com",
            ipAddress: "192.0.2.99",
            userAgent: "api-test",
        });
        mocks.changeSystemRole.mockResolvedValue({
            userId: 7,
            before: "USER",
            after: "ADMIN",
        });
    });

    it("uses the authenticated ADMIN as the audit actor and accepts only systemRole", async () => {
        const response = await PATCH(
            new NextRequest("http://localhost/api/authorization/administration/users/7/system-role", {
                method: "PATCH",
                body: JSON.stringify({ systemRole: "ADMIN" }),
            }),
            { params: Promise.resolve({ id: "7" }) },
        );

        expect(response.status).toBe(200);
        expect(mocks.changeSystemRole).toHaveBeenCalledWith({
            targetUserId: 7,
            systemRole: "ADMIN",
            actor: {
                userId: 99,
                userEmail: "admin@example.com",
                ipAddress: "192.0.2.99",
                userAgent: "api-test",
            },
        });
    });

    it("returns the existing trusted non-ADMIN response without invoking the mutation", async () => {
        mocks.requireSession.mockResolvedValue({
            ok: false,
            response: NextResponse.json({ error: "forbidden" }, { status: 403 }),
        });

        const response = await PATCH(
            new NextRequest("http://localhost/api/authorization/administration/users/7/system-role", { method: "PATCH", body: "{}" }),
            { params: Promise.resolve({ id: "7" }) },
        );

        expect(response.status).toBe(403);
        expect(mocks.changeSystemRole).not.toHaveBeenCalled();
    });

    it("rejects malformed identifiers and bodies", async () => {
        const invalidIdentifier = await PATCH(
            new NextRequest("http://localhost/api/authorization/administration/users/not-an-id/system-role", { method: "PATCH", body: JSON.stringify({ systemRole: "ADMIN" }) }),
            { params: Promise.resolve({ id: "not-an-id" }) },
        );
        const invalidBody = await PATCH(
            new NextRequest("http://localhost/api/authorization/administration/users/7/system-role", { method: "PATCH", body: JSON.stringify({ systemRole: "ADMIN", actorUserId: 1 }) }),
            { params: Promise.resolve({ id: "7" }) },
        );

        expect(invalidIdentifier.status).toBe(400);
        expect(invalidBody.status).toBe(400);
        expect(mocks.changeSystemRole).not.toHaveBeenCalled();
    });

    it("returns a stable LAST_ELIGIBLE_ADMIN error", async () => {
        mocks.changeSystemRole.mockRejectedValueOnce(new SystemRoleChangeError(
            "LAST_ELIGIBLE_ADMIN",
            "ไม่สามารถถอดผู้ดูแลระบบคนสุดท้ายที่ใช้งานได้",
            409,
        ));

        const response = await PATCH(
            new NextRequest("http://localhost/api/authorization/administration/users/7/system-role", { method: "PATCH", body: JSON.stringify({ systemRole: "USER" }) }),
            { params: Promise.resolve({ id: "7" }) },
        );
        const body = await response.json() as { code?: string };

        expect(response.status).toBe(409);
        expect(body.code).toBe("LAST_ELIGIBLE_ADMIN");
    });
});
