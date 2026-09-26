import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as NextServerModule from "next/server";

import { GET, POST } from "@/app/api/email-request/route";
import { requireApiSession } from "@/lib/auth/api";
import { createAuditLog } from "@/lib/server/audit";
import {
    EmailRequestIdempotencyConflictError,
    EmailRequestCapabilityDeniedError,
} from "@/modules/it";
import { processOutbox } from "@/lib/services/outbox/processor";

const authorizationMocks = vi.hoisted(() => ({
    assertEmailRequestCapability: vi.fn(),
    toEmailRequestReadAuthorization: vi.fn(),
    createEmailRequest: vi.fn(),
    getEmailRequests: vi.fn(),
    EmailRequestIdempotencyConflictError: class extends Error {
        constructor() {
            super("Idempotency-Key นี้ถูกใช้กับข้อมูลคำขออื่นแล้ว");
            this.name = "EmailRequestIdempotencyConflictError";
        }
    },
    EmailRequestCapabilityDeniedError: class extends Error {
        readonly authorizationReason: string;
        readonly capability: string;
        readonly statusCode = 403;

        constructor(capability: string, reason: string) {
            super("คุณไม่มีสิทธิ์ดำเนินการ");
            this.name = "EmailRequestCapabilityDeniedError";
            this.capability = capability;
            this.authorizationReason = reason;
        }
    },
}));

const emailRequestService = {
    createEmailRequest: authorizationMocks.createEmailRequest,
    getEmailRequests: authorizationMocks.getEmailRequests,
};

vi.mock("next/server", async (importOriginal) => {
    const actual = await importOriginal<typeof NextServerModule>();
    return { ...actual, after: vi.fn((callback) => callback()) };
});
vi.mock("@/lib/auth/api", () => ({
    requireApiSession: vi.fn(),
}));
vi.mock("@/lib/server/audit", () => ({ createAuditLog: vi.fn() }));
vi.mock("@/lib/services/outbox/processor", () => ({ processOutbox: vi.fn() }));
vi.mock("@/modules/it", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        createEmailRequest: authorizationMocks.createEmailRequest,
        getEmailRequests: authorizationMocks.getEmailRequests,
        EmailRequestIdempotencyConflictError:
            authorizationMocks.EmailRequestIdempotencyConflictError,
        EmailRequestCapabilityDeniedError:
            authorizationMocks.EmailRequestCapabilityDeniedError,
        buildEmailRequestAuthorizationContext: (user: { id: number; role: string }) => ({
            authorizationActor: {
                userId: user.id,
                employeeId: null,
                systemRole: user.role,
                channel: "DASHBOARD",
            },
        }),
        assertEmailRequestCapability: authorizationMocks.assertEmailRequestCapability,
        toEmailRequestReadAuthorization: authorizationMocks.toEmailRequestReadAuthorization,
    };
});

const USER = { id: 1, email: "admin@thainhf.org", name: "Admin", role: "ADMIN" };
const VALID_BODY = {
    thaiName: "สมชาย ใจดี",
    englishName: "Somchai Jaidee",
    phone: "081-234-5678",
    nickname: "ชาย",
    position: "เจ้าหน้าที่",
    department: "มสช.",
    replyEmail: "somchai@example.com",
    needsDocumentSystem: false,
    sharedDriveAccess: ["it"],
};
const EXISTING_EMAIL_REQUEST = {
    id: 10,
    ...VALID_BODY,
    phone: "081-2345678",
    requestedBy: USER.id,
    createdAt: new Date("2026-08-08T00:00:00.000Z"),
    updatedAt: new Date("2026-08-08T00:00:00.000Z"),
};

function authenticated(): void {
    vi.mocked(requireApiSession).mockResolvedValue({
        ok: true,
        user: USER,
        session: { user: { ...USER, id: String(USER.id) } },
    });
}

describe("/api/email-request", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        authenticated();
        authorizationMocks.assertEmailRequestCapability.mockImplementation(
            async (_context: unknown, capability: string) => ({
                actor: {
                    userId: USER.id,
                    employeeId: null,
                    systemRole: USER.role,
                    channel: "DASHBOARD",
                },
                capability,
                decision: {
                    capability,
                    allowed: true,
                    scopes: ["ALL"],
                    grants: [],
                },
                defaultScopes: [],
                scopes: ["ALL"],
            }),
        );
        authorizationMocks.toEmailRequestReadAuthorization.mockReturnValue({
            userId: USER.id,
            scopes: ["ALL"],
        });
        vi.mocked(createAuditLog).mockResolvedValue({} as never);
        vi.mocked(processOutbox).mockResolvedValue({ processed: 0, failed: 0 });
    });

    it("keeps unauthenticated POST and GET responses at the existing 401 boundary", async () => {
        vi.mocked(requireApiSession).mockResolvedValue({
            ok: false,
            response: NextResponse.json({ success: false }, { status: 401 }),
        } as never);

        const postResponse = await POST(new NextRequest(
            "http://localhost/api/email-request",
            { method: "POST", body: JSON.stringify(VALID_BODY) },
        ));
        const getResponse = await GET(new NextRequest(
            "http://localhost/api/email-request",
        ));

        expect(postResponse.status).toBe(401);
        expect(getResponse.status).toBe(401);
        expect(emailRequestService.createEmailRequest).not.toHaveBeenCalled();
        expect(emailRequestService.getEmailRequests).not.toHaveBeenCalled();
    });

    it("rejects a missing Idempotency-Key before creating a request", async () => {
        const response = await POST(new NextRequest(
            "http://localhost/api/email-request",
            { method: "POST", body: JSON.stringify(VALID_BODY) },
        ));

        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({
            error: expect.stringContaining("Idempotency-Key"),
        });
        expect(emailRequestService.createEmailRequest).not.toHaveBeenCalled();
    });

    it("rejects an invalid Idempotency-Key with 400 before creating a request", async () => {
        const response = await POST(new NextRequest(
            "http://localhost/api/email-request",
            {
                method: "POST",
                body: JSON.stringify(VALID_BODY),
                headers: { "Idempotency-Key": "x".repeat(256) },
            },
        ));

        expect(response.status).toBe(400);
        expect(emailRequestService.createEmailRequest).not.toHaveBeenCalled();
    });

    it("returns 201 for the first request and passes the requester-scoped key", async () => {
        vi.mocked(emailRequestService.createEmailRequest).mockResolvedValue({
            success: true,
            replayed: false,
            emailRequest: EXISTING_EMAIL_REQUEST,
        } as never);

        const response = await POST(new NextRequest(
            "http://localhost/api/email-request",
            {
                method: "POST",
                body: JSON.stringify(VALID_BODY),
                headers: { "Idempotency-Key": "email-key" },
            },
        ));

        expect(response.status).toBe(201);
        expect(emailRequestService.createEmailRequest).toHaveBeenCalledWith(
            expect.objectContaining({ phone: "081-2345678" }),
            USER,
            { idempotencyKey: "email-key" },
        );
        expect(createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
            action: "EMAIL_REQUEST",
            entityType: "EmailRequest",
            entityId: EXISTING_EMAIL_REQUEST.id,
            userId: USER.id,
            userEmail: USER.email,
            details: {
                after: {
                    thaiName: VALID_BODY.thaiName,
                    englishName: VALID_BODY.englishName,
                    position: VALID_BODY.position,
                    department: VALID_BODY.department,
                    needsDocumentSystem: VALID_BODY.needsDocumentSystem,
                    sharedDriveAccess: VALID_BODY.sharedDriveAccess,
                },
            },
        }));
        expect(processOutbox).toHaveBeenCalledTimes(1);
    });

    it("allows a configured USER to create a request without changing requestedBy", async () => {
        const configuredUser = {
            id: 7,
            email: "user@example.com",
            name: "Configured User",
            role: "USER" as const,
        };
        vi.mocked(requireApiSession).mockResolvedValue({
            ok: true,
            user: configuredUser,
            session: { user: { ...configuredUser, id: String(configuredUser.id) } },
        });
        authorizationMocks.assertEmailRequestCapability.mockImplementationOnce(
            async (_context: unknown, capability: string) => ({
                actor: {
                    userId: configuredUser.id,
                    employeeId: null,
                    systemRole: "USER" as const,
                    channel: "DASHBOARD" as const,
                },
                capability,
                decision: {
                    capability,
                    allowed: true,
                    scopes: ["ALL" as const],
                    grants: [],
                },
                defaultScopes: [],
                scopes: ["ALL" as const],
            }),
        );
        vi.mocked(emailRequestService.createEmailRequest).mockResolvedValue({
            success: true,
            replayed: false,
            emailRequest: { ...EXISTING_EMAIL_REQUEST, requestedBy: configuredUser.id },
        } as never);

        const response = await POST(new NextRequest(
            "http://localhost/api/email-request",
            {
                method: "POST",
                body: JSON.stringify(VALID_BODY),
                headers: { "Idempotency-Key": "user-email-key" },
            },
        ));

        expect(response.status).toBe(201);
        expect(await response.json()).toEqual({
            success: true,
            message: expect.any(String),
            data: {
                id: EXISTING_EMAIL_REQUEST.id,
                thaiName: EXISTING_EMAIL_REQUEST.thaiName,
                englishName: EXISTING_EMAIL_REQUEST.englishName,
                nickname: EXISTING_EMAIL_REQUEST.nickname,
                position: EXISTING_EMAIL_REQUEST.position,
                department: EXISTING_EMAIL_REQUEST.department,
                needsDocumentSystem: EXISTING_EMAIL_REQUEST.needsDocumentSystem,
                sharedDriveAccess: EXISTING_EMAIL_REQUEST.sharedDriveAccess,
                requestedAt: EXISTING_EMAIL_REQUEST.createdAt.toISOString(),
            },
        });
        expect(emailRequestService.createEmailRequest).toHaveBeenCalledWith(
            expect.objectContaining({ phone: "081-2345678" }),
            configuredUser,
            { idempotencyKey: "user-email-key" },
        );
    });

    it("rejects a create request before idempotency or service mutation without configured authority", async () => {
        authorizationMocks.assertEmailRequestCapability.mockRejectedValueOnce(
            new EmailRequestCapabilityDeniedError(
                "email.request.create",
                "NO_APPLICABLE_GRANT",
            ),
        );

        const response = await POST(new NextRequest(
            "http://localhost/api/email-request",
            {
                method: "POST",
                body: JSON.stringify(VALID_BODY),
                headers: { "Idempotency-Key": "email-key" },
            },
        ));

        expect(response.status).toBe(403);
        expect(emailRequestService.createEmailRequest).not.toHaveBeenCalled();
    });

    it("denies create before inspecting a missing key when capability is absent", async () => {
        authorizationMocks.assertEmailRequestCapability.mockRejectedValueOnce(
            new EmailRequestCapabilityDeniedError(
                "email.request.create",
                "NO_APPLICABLE_GRANT",
            ),
        );

        const response = await POST(new NextRequest(
            "http://localhost/api/email-request",
            { method: "POST", body: JSON.stringify(VALID_BODY) },
        ));

        expect(response.status).toBe(403);
        expect(emailRequestService.createEmailRequest).not.toHaveBeenCalled();
        expect(createAuditLog).not.toHaveBeenCalled();
        expect(processOutbox).not.toHaveBeenCalled();
    });

    it("returns 200 for replay without processing the outbox again", async () => {
        vi.mocked(emailRequestService.createEmailRequest).mockResolvedValue({
            success: true,
            replayed: true,
            emailRequest: EXISTING_EMAIL_REQUEST,
        } as never);

        const response = await POST(new NextRequest(
            "http://localhost/api/email-request",
            {
                method: "POST",
                body: JSON.stringify(VALID_BODY),
                headers: { "Idempotency-Key": "email-key" },
            },
        ));

        expect(response.status).toBe(200);
        const responseBody = await response.json();
        expect(responseBody).toMatchObject({
            data: {
                id: EXISTING_EMAIL_REQUEST.id,
                thaiName: EXISTING_EMAIL_REQUEST.thaiName,
                sharedDriveAccess: EXISTING_EMAIL_REQUEST.sharedDriveAccess,
            },
        });
        expect(responseBody).toMatchObject({
            success: true,
            message: expect.any(String),
        });
        expect(createAuditLog).not.toHaveBeenCalled();
        expect(processOutbox).not.toHaveBeenCalled();
    });

    it("maps a reused key with a different payload to 409", async () => {
        vi.mocked(emailRequestService.createEmailRequest).mockRejectedValue(
            new EmailRequestIdempotencyConflictError(),
        );

        const response = await POST(new NextRequest(
            "http://localhost/api/email-request",
            {
                method: "POST",
                body: JSON.stringify(VALID_BODY),
                headers: { "Idempotency-Key": "email-key" },
            },
        ));

        expect(response.status).toBe(409);
        expect(processOutbox).not.toHaveBeenCalled();
    });

    it.each([
        "?page=abc",
        "?page=0",
        "?page=-1",
        "?page=1.5",
        "?limit=abc",
        "?limit=0",
        "?limit=101",
    ])("rejects malformed pagination %s before querying", async (query) => {
        const response = await GET(new NextRequest(
            `http://localhost/api/email-request${query}`,
        ));

        expect(response.status).toBe(400);
        expect(emailRequestService.getEmailRequests).not.toHaveBeenCalled();
    });

    it("accepts valid pagination", async () => {
        vi.mocked(emailRequestService.getEmailRequests).mockResolvedValue({
            emailRequests: [{
                ...EXISTING_EMAIL_REQUEST,
                user: { id: USER.id, name: USER.name, email: USER.email },
            }],
            pagination: { page: 2, limit: 100, total: 101, totalPages: 2 },
        });

        const response = await GET(new NextRequest(
            "http://localhost/api/email-request?page=2&limit=100",
        ));

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            success: true,
            emailRequests: [{
                ...EXISTING_EMAIL_REQUEST,
                createdAt: EXISTING_EMAIL_REQUEST.createdAt.toISOString(),
                updatedAt: EXISTING_EMAIL_REQUEST.updatedAt.toISOString(),
                user: { id: USER.id, name: USER.name, email: USER.email },
            }],
            pagination: { page: 2, limit: 100, total: 101, totalPages: 2 },
        });
        expect(emailRequestService.getEmailRequests).toHaveBeenCalledWith(
            { page: 2, limit: 100 },
            { userId: USER.id, scopes: ["ALL"] },
        );
    });

    it("rejects an unauthorized read before querying EmailRequest", async () => {
        authorizationMocks.assertEmailRequestCapability.mockRejectedValueOnce(
            new EmailRequestCapabilityDeniedError(
                "email.request.read",
                "NO_APPLICABLE_GRANT",
            ),
        );

        const response = await GET(new NextRequest(
            "http://localhost/api/email-request",
        ));

        expect(response.status).toBe(403);
        expect(emailRequestService.getEmailRequests).not.toHaveBeenCalled();
    });
});
