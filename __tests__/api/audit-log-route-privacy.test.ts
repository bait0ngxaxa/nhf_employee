// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";

import type * as AuditModule from "@/modules/audit";
import { prisma } from "@/lib/db/prisma";

const routeMocks = vi.hoisted(() => ({
    requireApiSession: vi.fn(),
    assertAuditCapabilityForMigration: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: mockDeep<PrismaClient>() }));
vi.mock("@/lib/auth/api", () => ({ requireApiSession: routeMocks.requireApiSession }));
// Only the authorization decision is stubbed; the real query and projection run.
vi.mock("@/modules/audit", async (importOriginal) => ({
    ...await importOriginal<typeof AuditModule>(),
    assertAuditCapabilityForMigration: routeMocks.assertAuditCapabilityForMigration,
}));

import { GET } from "@/app/api/audit-logs/route";

const prismaMock = prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>;
const CANARY = "CANARY-API-9c1e-เหตุผลพิเศษส่วนตัวของพนักงาน";
const createdAt = new Date("2031-01-05T03:00:00.000Z");
const requester = {
    id: 8,
    name: "สมหญิง ใจดี",
    email: "requester@thainhf.org",
    employee: { firstName: "สมหญิง", lastName: "ใจดี", nickname: null },
};

describe("GET /api/audit-logs special-reason privacy", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
        routeMocks.requireApiSession.mockResolvedValue({ ok: true, user: { id: 1, role: "ADMIN" } });
        routeMocks.assertAuditCapabilityForMigration.mockResolvedValue({
            actor: { userId: 1, employeeId: null, systemRole: "ADMIN", channel: "DASHBOARD" },
            capability: "audit.read",
            decision: { capability: "audit.read", allowed: true, scopes: ["ALL"], grants: [] },
            scopes: ["ALL"],
            usedMigrationCompatibility: false,
        });
        prismaMock.auditLog.count.mockResolvedValue(3);
        prismaMock.auditLog.findMany.mockResolvedValue([
            {
                id: 101,
                action: "LEAVE_REQUEST_SPECIAL_REASON_UPDATE",
                entityType: "LeaveRequest",
                entityId: null,
                userId: 8,
                userEmail: "requester@thainhf.org",
                ipAddress: null,
                userAgent: null,
                details: JSON.stringify({
                    before: { status: "PENDING", specialReason: `${CANARY}-old` },
                    after: { status: "PENDING", specialReason: CANARY },
                    metadata: { leaveRequestId: "cm0leave0101", leaveType: "PERSONAL", period: "FULL_DAY", reason: CANARY },
                }),
                createdAt,
                user: requester,
            },
            {
                id: 102,
                action: "LEAVE_REQUEST_SPECIAL_REASON_UPDATE",
                entityType: "LeaveRequest",
                entityId: null,
                userId: 8,
                userEmail: "requester@thainhf.org",
                ipAddress: null,
                userAgent: null,
                details: `{"before":{"specialReason":"${CANARY}"}`,
                createdAt,
                user: requester,
            },
            {
                id: 103,
                action: "EMPLOYEE_UPDATE",
                entityType: "Employee",
                entityId: 12,
                userId: 1,
                userEmail: "admin@thainhf.org",
                ipAddress: null,
                userAgent: null,
                details: JSON.stringify({ before: { position: "เจ้าหน้าที่" }, after: { position: "หัวหน้างาน" } }),
                createdAt,
                user: null,
            },
        ] as never);
    });

    it("serializes no raw special-reason text while keeping accountability fields", async () => {
        const response = await GET(new NextRequest("http://localhost/api/audit-logs?page=1&limit=20"));
        const body = await response.text();

        expect(response.status).toBe(200);
        expect(body).not.toContain("CANARY");
        expect(body).not.toContain("specialReason\":\"");

        const parsed = JSON.parse(body) as { auditLogs: Array<Record<string, unknown>> };
        expect(parsed.auditLogs[0]).toMatchObject({
            id: 101,
            action: "LEAVE_REQUEST_SPECIAL_REASON_UPDATE",
            entityType: "LeaveRequest",
            userId: 8,
            userEmail: "requester@thainhf.org",
            createdAt: createdAt.toISOString(),
            user: { id: 8, name: "สมหญิง ใจดี" },
            details: {
                before: { status: "PENDING", hasSpecialReason: true },
                after: { status: "PENDING", hasSpecialReason: true },
                metadata: { leaveRequestId: "cm0leave0101", changedField: "specialReason", changeType: "UPDATED" },
            },
        });
        expect(parsed.auditLogs[1]).toMatchObject({ id: 102, action: "LEAVE_REQUEST_SPECIAL_REASON_UPDATE", userId: 8, details: null });
        expect(parsed.auditLogs[2]).toMatchObject({
            id: 103,
            details: { before: { position: "เจ้าหน้าที่" }, after: { position: "หัวหน้างาน" } },
        });
    });

    it("keeps the audit.read authorization gate in front of the data", async () => {
        routeMocks.requireApiSession.mockResolvedValue({
            ok: false,
            response: new Response(null, { status: 403 }),
        });

        const response = await GET(new NextRequest("http://localhost/api/audit-logs"));

        expect(response.status).toBe(403);
        expect(prismaMock.auditLog.findMany).not.toHaveBeenCalled();
    });
});
