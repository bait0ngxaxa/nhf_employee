// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const auditMocks = vi.hoisted(() => ({
    getAuditLogsMock: vi.fn(),
    requireApiSessionMock: vi.fn(),
    buildAuditAuthorizationContext: vi.fn(),
    assertAuditCapabilityForMigration: vi.fn(),
    assertAuditCapabilityScope: vi.fn(),
    AuditCapabilityDeniedError: class AuditCapabilityDeniedError extends Error {
        readonly statusCode = 403;

        constructor(
            readonly capability: string,
            readonly authorizationReason: string,
        ) {
            super("Forbidden");
        }
    },
}));

vi.mock("@/lib/auth/api", () => ({
    requireApiSession: auditMocks.requireApiSessionMock,
}));

vi.mock("@/modules/audit", () => ({
    getAuditLogs: auditMocks.getAuditLogsMock,
    buildAuditAuthorizationContext: auditMocks.buildAuditAuthorizationContext,
    assertAuditCapabilityForMigration: auditMocks.assertAuditCapabilityForMigration,
    assertAuditCapabilityScope: auditMocks.assertAuditCapabilityScope,
    AuditCapabilityDeniedError: auditMocks.AuditCapabilityDeniedError,
}));

import { GET } from "@/app/api/audit-logs/route";

describe("Audit log API compatibility", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        auditMocks.requireApiSessionMock.mockResolvedValue({
            ok: true,
            user: { id: 1, role: "ADMIN" },
        });
        auditMocks.buildAuditAuthorizationContext.mockReturnValue({
            authorizationActor: {
                userId: 1,
                employeeId: null,
                systemRole: "ADMIN",
                channel: "DASHBOARD",
            },
        });
        auditMocks.assertAuditCapabilityForMigration.mockResolvedValue({
            actor: {
                userId: 1,
                employeeId: null,
                systemRole: "ADMIN",
                channel: "DASHBOARD",
            },
            capability: "audit.read",
            decision: {
                capability: "audit.read",
                allowed: true,
                scopes: ["ALL"],
                grants: [],
            },
            scopes: ["ALL"],
            usedMigrationCompatibility: false,
        });
        auditMocks.assertAuditCapabilityScope.mockImplementation(
            (authorization) => authorization,
        );
        auditMocks.getAuditLogsMock.mockResolvedValue({
            auditLogs: [
                {
                    id: 1,
                    details: { metadata: { familyId: "historical-family-id" } },
                },
                {
                    id: 2,
                    details: { metadata: { familyCorrelation: "0123456789abcdef" } },
                },
            ],
            pagination: { page: 1, limit: 20, total: 2, pages: 1 },
        });
    });

    it("returns historical and new session metadata without reshaping either", async () => {
        const response = await GET(
            new NextRequest("http://localhost/api/audit-logs?page=1&limit=20"),
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            auditLogs: [
                { details: { metadata: { familyId: "historical-family-id" } } },
                { details: { metadata: { familyCorrelation: "0123456789abcdef" } } },
            ],
        });
        expect(auditMocks.getAuditLogsMock).toHaveBeenCalledWith({
            action: undefined,
            entityType: undefined,
            search: undefined,
            userId: undefined,
            startDate: undefined,
            endDate: undefined,
            page: 1,
            limit: 20,
        });
    });

    it("allows a USER when the centralized adapter reports an explicit grant", async () => {
        auditMocks.requireApiSessionMock.mockResolvedValue({
            ok: true,
            user: { id: 7, role: "USER" },
        });
        auditMocks.buildAuditAuthorizationContext.mockReturnValue({
            authorizationActor: {
                userId: 7,
                employeeId: null,
                systemRole: "USER",
                channel: "DASHBOARD",
            },
        });
        auditMocks.assertAuditCapabilityForMigration.mockResolvedValue({
            actor: {
                userId: 7,
                employeeId: null,
                systemRole: "USER",
                channel: "DASHBOARD",
            },
            capability: "audit.read",
            decision: {
                capability: "audit.read",
                allowed: true,
                scopes: ["ALL"],
                grants: [{
                    capability: "audit.read",
                    scope: "ALL",
                    source: { type: "USER", userId: 7 },
                }],
            },
            scopes: ["ALL"],
            usedMigrationCompatibility: false,
        });

        const response = await GET(
            new NextRequest("http://localhost/api/audit-logs"),
        );

        expect(response.status).toBe(200);
        expect(auditMocks.assertAuditCapabilityForMigration).toHaveBeenCalledWith(
            expect.objectContaining({
                authorizationActor: expect.objectContaining({
                    userId: 7,
                    systemRole: "USER",
                    channel: "DASHBOARD",
                }),
            }),
            "audit.read",
        );
        expect(auditMocks.getAuditLogsMock).toHaveBeenCalledTimes(1);
    });

    it("keeps an ungranted USER denied and does not execute the Audit query", async () => {
        auditMocks.requireApiSessionMock.mockResolvedValue({
            ok: true,
            user: { id: 7, role: "USER" },
        });
        auditMocks.assertAuditCapabilityForMigration.mockRejectedValue(
            new auditMocks.AuditCapabilityDeniedError(
                "audit.read",
                "NO_APPLICABLE_GRANT",
            ),
        );

        const response = await GET(
            new NextRequest("http://localhost/api/audit-logs"),
        );

        expect(response.status).toBe(403);
        expect(auditMocks.getAuditLogsMock).not.toHaveBeenCalled();
    });

    it("preserves the route's 403 authentication response", async () => {
        auditMocks.requireApiSessionMock.mockResolvedValue({
            ok: false,
            response: new Response(JSON.stringify({ error: "Operation failed" }), {
                status: 403,
                headers: { "content-type": "application/json" },
            }),
        });

        const response = await GET(
            new NextRequest("http://localhost/api/audit-logs"),
        );

        expect(response.status).toBe(403);
        expect(auditMocks.getAuditLogsMock).not.toHaveBeenCalled();
        expect(auditMocks.assertAuditCapabilityForMigration).not.toHaveBeenCalled();
    });
});
