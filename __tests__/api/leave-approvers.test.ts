import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET, PUT } from "@/app/api/leave/approvers/route";
import { requireActiveWorkforceSession } from "@/lib/auth/workforce";
import { prisma } from "@/lib/db/prisma";
import {
    ApproverAssignmentError,
    assignLeaveApprovers,
} from "@/modules/leave";
import type * as AuthorizationModule from "@/modules/authorization";
import {
    LEAVE_APPROVER_ASSIGNMENTS_MAX,
    LEAVE_APPROVERS_JSON_MAX_REQUEST_BYTES,
    REQUEST_BODY_TOO_LARGE_MESSAGE,
} from "@/lib/ssot/request-limits";
import {
    buildJsonBodyRequest,
    CONTENT_LENGTH_MODES,
    jsonBodyOfExactBytes,
} from "@/__tests__/helpers/request-body-limit";
import { trustedNextRequest } from "@/__tests__/helpers/trusted-mutation";

const authorizationMocks = vi.hoisted(() => ({
    resolve: vi.fn(),
    resolveInTransaction: vi.fn(),
}));

vi.mock("@/lib/auth/workforce", () => ({
    requireActiveWorkforceSession: vi.fn(),
}));
vi.mock("@/modules/authorization", async (importOriginal) => {
    const actual = await importOriginal<typeof AuthorizationModule>();
    return {
        ...actual,
        authorization: {
            ...actual.authorization,
            resolve: authorizationMocks.resolve,
            resolveInTransaction: authorizationMocks.resolveInTransaction,
        },
    };
});
vi.mock("@/lib/db/prisma", () => ({
    prisma: {
        employee: { findMany: vi.fn() },
    },
}));
vi.mock("@/modules/leave", async (importOriginal) => {
    const actual = await importOriginal();
    class MockApproverAssignmentError extends Error {
        readonly statusCode: number;

        constructor(message: string, statusCode = 400) {
            super(message);
            this.statusCode = statusCode;
        }
    }
    return {
        ...(actual as Record<string, unknown>),
        ApproverAssignmentError: MockApproverAssignmentError,
        assignLeaveApprovers: vi.fn(),
    };
});

const ACTIVE_EMPLOYEE = {
    id: 10,
    firstName: "Active",
    lastName: "Employee",
    nickname: null,
    email: "active@thainhf.org",
    position: "Officer",
    status: "ACTIVE",
    deletedAt: null,
    managerId: null,
    dept: { name: "Operations" },
    user: {
        id: 100,
        email: "active@thainhf.org",
        isActive: true,
        deletedAt: null,
    },
};

function configuredUserId(actor: unknown): number {
    if (
        typeof actor === "object"
        && actor !== null
        && "userId" in actor
        && typeof actor.userId === "number"
    ) {
        return actor.userId;
    }
    return 0;
}

function authorizationDecision(actor: unknown, capability: string) {
    const isAdmin = typeof actor === "object"
        && actor !== null
        && "systemRole" in actor
        && actor.systemRole === "ADMIN";
    return isAdmin
        ? {
            capability,
            allowed: true,
            scopes: ["ALL" as const],
            grants: [{
                capability,
                scope: "ALL" as const,
                source: { type: "USER" as const, userId: configuredUserId(actor) },
            }],
        }
        : {
            capability,
            allowed: false,
            scopes: [],
            grants: [],
            reason: "NO_APPLICABLE_GRANT" as const,
        };
}

describe("GET /api/leave/approvers", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        authorizationMocks.resolve.mockImplementation(
            async (actor: unknown, capability: string) => authorizationDecision(actor, capability),
        );
        vi.mocked(requireActiveWorkforceSession).mockResolvedValue({
            ok: true,
            session: { user: { id: "1", role: "ADMIN" } },
            user: { id: 1, email: "admin@example.com", name: "Admin", role: "ADMIN" },
            employeeId: 1,
        });
        vi.mocked(prisma.employee.findMany).mockResolvedValue([ACTIVE_EMPLOYEE] as never);
    });

    it("queries and returns only employees with an active user account", async () => {
        const response = await GET();

        expect(response.status).toBe(200);
        expect(prisma.employee.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                status: "ACTIVE",
                deletedAt: null,
                user: {
                    is: {
                        isActive: true,
                        deletedAt: null,
                    },
                },
            },
        }));

        const body = await response.json() as {
            employees: Array<{ id: number; canApproveLeave: boolean }>;
        };
        expect(body.employees).toEqual([
            expect.objectContaining({ id: 10, canApproveLeave: true }),
        ]);
    });

    it("rejects a Dashboard Admin without an active Employee profile", async () => {
        vi.mocked(requireActiveWorkforceSession).mockResolvedValue({
            ok: false,
            response: NextResponse.json({ error: "Not found" }, { status: 404 }),
        });

        const response = await GET();

        expect(response.status).toBe(404);
    });
});

describe("PUT /api/leave/approvers", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        authorizationMocks.resolve.mockImplementation(
            async (actor: unknown, capability: string) => authorizationDecision(actor, capability),
        );
        vi.mocked(requireActiveWorkforceSession).mockResolvedValue({
            ok: true,
            session: { user: { id: "1", role: "ADMIN" } },
            user: { id: 1, email: "admin@example.com", name: "Admin", role: "ADMIN" },
            employeeId: 1,
        });
        vi.mocked(assignLeaveApprovers).mockResolvedValue(undefined);
    });

    it("accepts the assignment payload without legacy fields", async () => {
        const response = await PUT(trustedNextRequest("http://localhost/api/leave/approvers", {
            method: "PUT",
            body: JSON.stringify({ assignments: [{ employeeId: 10, managerId: 20 }] }),
        }));

        expect(response.status).toBe(200);
        expect(assignLeaveApprovers).toHaveBeenCalledWith(
            [{ employeeId: 10, managerId: 20 }],
            {
                userId: 1,
                email: "admin@example.com",
                authorization: {
                    authorizationActor: {
                        userId: 1,
                        employeeId: 1,
                        systemRole: "ADMIN",
                        channel: "DASHBOARD",
                    },
                },
            },
        );
    });

    it("returns the pending-request conflict from the service", async () => {
        vi.mocked(assignLeaveApprovers).mockRejectedValue(
            new ApproverAssignmentError(
                "พนักงานมีคำขอลารออนุมัติ กรุณาให้พนักงานยกเลิกคำขอก่อนเปลี่ยนผู้อนุมัติ",
                409,
            ),
        );

        const response = await PUT(trustedNextRequest("http://localhost/api/leave/approvers", {
            method: "PUT",
            body: JSON.stringify({ assignments: [{ employeeId: 10, managerId: 20 }] }),
        }));

        expect(response.status).toBe(409);
    });
});

describe("PUT /api/leave/approvers body and assignment limits", () => {
    const APPROVERS_URL = "http://localhost/api/leave/approvers";
    const MAX_INT_ID = 2147483647;

    function assignments(count: number): Array<{ employeeId: number; managerId: number }> {
        return Array.from({ length: count }, (_unused, index) => ({
            employeeId: MAX_INT_ID - index,
            managerId: MAX_INT_ID,
        }));
    }

    beforeEach(() => {
        vi.clearAllMocks();
        authorizationMocks.resolve.mockImplementation(
            async (actor: unknown, capability: string) => authorizationDecision(actor, capability),
        );
        vi.mocked(requireActiveWorkforceSession).mockResolvedValue({
            ok: true,
            session: { user: { id: "1", role: "ADMIN" } },
            user: { id: 1, email: "admin@example.com", name: "Admin", role: "ADMIN" },
            employeeId: 1,
        });
        vi.mocked(assignLeaveApprovers).mockResolvedValue(undefined);
    });

    it.each(CONTENT_LENGTH_MODES)(
        "rejects an oversized body with 413 after the capability check (Content-Length %s)",
        async (contentLength) => {
            const response = await PUT(buildJsonBodyRequest(
                APPROVERS_URL,
                jsonBodyOfExactBytes(
                    { assignments: assignments(1) },
                    LEAVE_APPROVERS_JSON_MAX_REQUEST_BYTES + 1,
                ),
                { method: "PUT", contentLength },
            ));

            expect(response.status).toBe(413);
            await expect(response.json()).resolves.toEqual({ error: REQUEST_BODY_TOO_LARGE_MESSAGE });
            // Existing order: feature flag -> auth -> capability -> body.
            expect(authorizationMocks.resolve).toHaveBeenCalled();
            expect(assignLeaveApprovers).not.toHaveBeenCalled();
        },
    );

    it("keeps the previous 500 response for malformed JSON", async () => {
        const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
        try {
            const response = await PUT(
                buildJsonBodyRequest(APPROVERS_URL, "{not json", { method: "PUT" }),
            );

            expect(response.status).toBe(500);
            await expect(response.json()).resolves.toEqual({ error: "Failed to update approvers" });
            expect(assignLeaveApprovers).not.toHaveBeenCalled();
        } finally {
            errorLog.mockRestore();
        }
    });

    it("accepts the maximal payload: assignments at the cap with the largest ids", async () => {
        const maximal = assignments(LEAVE_APPROVER_ASSIGNMENTS_MAX);

        const response = await PUT(buildJsonBodyRequest(
            APPROVERS_URL,
            JSON.stringify({ assignments: maximal }),
            { method: "PUT" },
        ));

        expect(response.status).toBe(200);
        expect(assignLeaveApprovers).toHaveBeenCalledWith(maximal, expect.anything());
    });

    it("rejects assignments over the cap with the schema's 400 before the service", async () => {
        const response = await PUT(buildJsonBodyRequest(
            APPROVERS_URL,
            JSON.stringify({ assignments: assignments(LEAVE_APPROVER_ASSIGNMENTS_MAX + 1) }),
            { method: "PUT" },
        ));

        expect(response.status).toBe(400);
        const body = await response.json() as { error: string; details: unknown };
        expect(body.error).toBe("Invalid input");
        expect(JSON.stringify(body.details)).toContain(
            `At most ${LEAVE_APPROVER_ASSIGNMENTS_MAX} assignments allowed`,
        );
        expect(assignLeaveApprovers).not.toHaveBeenCalled();
    });
});
