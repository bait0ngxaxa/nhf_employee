// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { getAuditLogsMock, requireAdminSessionMock } = vi.hoisted(() => ({
    getAuditLogsMock: vi.fn(),
    requireAdminSessionMock: vi.fn(),
}));

vi.mock("@/lib/auth/api", () => ({
    requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/modules/audit", () => ({
    getAuditLogs: getAuditLogsMock,
}));

import { GET } from "@/app/api/audit-logs/route";

describe("Audit log API compatibility", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        requireAdminSessionMock.mockResolvedValue({
            ok: true,
            user: { id: 1, role: "ADMIN" },
        });
        getAuditLogsMock.mockResolvedValue({
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
        expect(getAuditLogsMock).toHaveBeenCalledWith({
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
});
