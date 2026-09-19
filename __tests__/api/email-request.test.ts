import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as NextServerModule from "next/server";
import type * as EmailRequestServiceModule from "@/lib/services/email-request";

import { GET, POST } from "@/app/api/email-request/route";
import { requireApiSession } from "@/lib/auth/api";
import { createAuditLog } from "@/lib/server/audit";
import {
    EmailRequestIdempotencyConflictError,
} from "@/lib/services/email-request/idempotency";
import {
    emailRequestService,
    EmailRequestCapabilityDeniedError,
} from "@/lib/services/email-request";
import { processOutbox } from "@/lib/services/outbox/processor";

const authorizationMocks = vi.hoisted(() => ({
    assertEmailRequestCapability: vi.fn(),
    toEmailRequestReadAuthorization: vi.fn(),
}));

vi.mock("next/server", async (importOriginal) => {
    const actual = await importOriginal<typeof NextServerModule>();
    return { ...actual, after: vi.fn((callback) => callback()) };
});
vi.mock("@/lib/auth/api", () => ({
    requireApiSession: vi.fn(),
}));
vi.mock("@/lib/server/audit", () => ({ createAuditLog: vi.fn() }));
vi.mock("@/lib/services/outbox/processor", () => ({ processOutbox: vi.fn() }));
vi.mock("@/lib/services/email-request", async (importOriginal) => {
    const actual = await importOriginal<
        typeof EmailRequestServiceModule
    >();
    return {
        ...actual,
        emailRequestService: {
            createEmailRequest: vi.fn(),
            getEmailRequests: vi.fn(),
        },
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
        expect(await response.json()).toMatchObject({
            data: {
                id: EXISTING_EMAIL_REQUEST.id,
                thaiName: EXISTING_EMAIL_REQUEST.thaiName,
                sharedDriveAccess: EXISTING_EMAIL_REQUEST.sharedDriveAccess,
            },
        });
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
            emailRequests: [],
            pagination: { page: 2, limit: 100, total: 0, totalPages: 0 },
        });

        const response = await GET(new NextRequest(
            "http://localhost/api/email-request?page=2&limit=100",
        ));

        expect(response.status).toBe(200);
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
