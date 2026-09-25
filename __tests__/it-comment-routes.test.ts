// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import type * as ITModule from "@/modules/it";

const mocks = vi.hoisted(() => ({
    requireApiSession: vi.fn(),
    buildContext: vi.fn(),
    requesterPost: vi.fn(),
    operatorPost: vi.fn(),
    preAuthLimit: vi.fn(),
    authenticatedLimit: vi.fn(),
}));

vi.mock("@/lib/auth/api", () => ({ requireApiSession: mocks.requireApiSession }));
vi.mock("@/lib/security/mutation-rate-limit", () => ({
    enforcePreAuthIpRateLimit: mocks.preAuthLimit,
    enforceAuthenticatedMutationRateLimit: mocks.authenticatedLimit,
}));
vi.mock("@/modules/it", async (importOriginal) => {
    const actual = await importOriginal<typeof ITModule>();
    return {
        ...actual,
        buildCurrentITAuthorizationContext: mocks.buildContext,
        postITRequesterTicketComment: mocks.requesterPost,
        postITOperatorTicketComment: mocks.operatorPost,
    };
});

import { POST as postRequesterComment } from "@/app/api/it/tickets/[ticketId]/comments/route";
import { POST as postOperatorComment } from "@/app/api/it/operator/tickets/[ticketId]/comments/route";
import {
    ITTicketAttachmentValidationError,
    ITTicketNotCommentableError,
} from "@/modules/it";

const user = { id: 41, role: "USER", email: "staff@example.test", name: "Staff" };
const actorContext = {
    authorizationActor: {
        userId: 41,
        employeeId: 84,
        systemRole: "USER",
        channel: "DASHBOARD",
    },
};
const comment = {
    type: "COMMENT",
    id: "cmtest123",
    createdAt: "2026-09-01T02:00:00.000Z",
    authorDisplayName: "Staff",
    authorSide: "REQUESTER",
    body: "ตรวจสอบให้หน่อย",
    attachments: [],
};

function jsonRequest(
    operator: boolean,
    body: unknown,
    idempotencyKey: string | null = "comment-key",
    contentType: string | null = "application/json",
): NextRequest {
    const headers = new Headers();
    if (idempotencyKey !== null) headers.set("Idempotency-Key", idempotencyKey);
    if (contentType !== null) headers.set("Content-Type", contentType);
    return new NextRequest(`http://localhost/api/it/${operator ? "operator/" : ""}tickets/19/comments`, {
        method: "POST",
        headers,
        body: new TextEncoder().encode(JSON.stringify(body)),
    });
}

function multipartRequest(
    operator: boolean,
    entries: readonly (readonly [string, string | File])[],
    idempotencyKey: string | null = "comment-key",
): NextRequest {
    const form = new FormData();
    for (const [key, value] of entries) form.append(key, value);
    const headers = new Headers();
    if (idempotencyKey !== null) headers.set("Idempotency-Key", idempotencyKey);
    return new NextRequest(
        `http://localhost/api/it/${operator ? "operator/" : ""}tickets/19/comments`,
        { method: "POST", headers, body: form },
    );
}

function image(name = "proof.png"): File {
    return new File([new Uint8Array([1, 2, 3])], name, { type: "image/png" });
}

describe.each([
    { name: "requester", operator: false, post: () => postRequesterComment },
    { name: "operator", operator: true, post: () => postOperatorComment },
])("IT $name comment HTTP contract", ({ operator, post }) => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.requireApiSession.mockResolvedValue({ ok: true, user, session: { user } });
        mocks.buildContext.mockResolvedValue(actorContext);
        mocks.preAuthLimit.mockReturnValue(null);
        mocks.authenticatedLimit.mockReturnValue(null);
        mocks.requesterPost.mockResolvedValue({ comment, replayed: false });
        mocks.operatorPost.mockResolvedValue({ comment: { ...comment, authorSide: "OPERATOR" }, replayed: false });
    });

    it("preserves the body-only JSON API and sends no attachment fields", async () => {
        const response = await post()(jsonRequest(operator, { body: "ตรวจสอบให้หน่อย" }), {
            params: Promise.resolve({ ticketId: "19" }),
        });
        expect(response.status).toBe(201);
        const target = operator ? mocks.operatorPost : mocks.requesterPost;
        expect(target).toHaveBeenCalledWith(
            actorContext,
            { ticketId: 19, body: "ตรวจสอบให้หน่อย" },
            { idempotencyKey: "comment-key", attachments: [] },
        );
        expect(mocks.preAuthLimit).not.toHaveBeenCalled();
        expect(mocks.authenticatedLimit).not.toHaveBeenCalled();
    });

    it("accepts missing or empty Content-Type as legacy JSON, trims the body, and skips upload limiters", async () => {
        const requests = [
            jsonRequest(operator, { body: "  ตรวจสอบให้หน่อย  " }, "legacy-key", null),
            jsonRequest(operator, { body: "  ตรวจสอบให้หน่อย  " }, "legacy-key", ""),
        ];
        expect(requests[0]?.headers.has("content-type")).toBe(false);
        expect(requests[1]?.headers.get("content-type")).toBe("");

        for (const request of requests) {
            expect((await post()(request, { params: Promise.resolve({ ticketId: "19" }) })).status)
                .toBe(201);
        }

        const target = operator ? mocks.operatorPost : mocks.requesterPost;
        expect(target).toHaveBeenCalledTimes(2);
        expect(target.mock.calls[0]?.[1]).toEqual({ ticketId: 19, body: "ตรวจสอบให้หน่อย" });
        expect(target.mock.calls[1]?.[1]).toEqual({ ticketId: 19, body: "ตรวจสอบให้หน่อย" });
        expect(mocks.preAuthLimit).not.toHaveBeenCalled();
        expect(mocks.authenticatedLimit).not.toHaveBeenCalled();
    });

    it("still requires Idempotency-Key and strictly validates missing-Content-Type JSON", async () => {
        const missingKey = await post()(jsonRequest(operator, { body: "ข้อความ" }, null, null), {
            params: Promise.resolve({ ticketId: "19" }),
        });
        const emptyBody = await post()(jsonRequest(operator, { body: "  \n " }, "comment-key", null), {
            params: Promise.resolve({ ticketId: "19" }),
        });
        const forgedSide = await post()(jsonRequest(
            operator,
            { body: "ข้อความ", authorSide: "OPERATOR" },
            "comment-key",
            null,
        ), { params: Promise.resolve({ ticketId: "19" }) });

        expect(missingKey.status).toBe(400);
        expect(emptyBody.status).toBe(400);
        expect(forgedSide.status).toBe(400);
        expect(operator ? mocks.operatorPost : mocks.requesterPost).not.toHaveBeenCalled();
        expect(mocks.preAuthLimit).not.toHaveBeenCalled();
        expect(mocks.authenticatedLimit).not.toHaveBeenCalled();
    });

    it("accepts body plus image multipart and applies both upload limiters", async () => {
        const response = await post()(multipartRequest(operator, [
            ["body", "ตรวจสอบให้หน่อย"],
            ["attachments", image("หลักฐาน.png")],
        ]), { params: Promise.resolve({ ticketId: "19" }) });
        expect(response.status).toBe(201);
        const target = operator ? mocks.operatorPost : mocks.requesterPost;
        const options = target.mock.calls[0]?.[2] as {
            readonly idempotencyKey: string;
            readonly attachments: readonly { readonly name: string; readonly type: string }[];
        };
        expect(options.idempotencyKey).toBe("comment-key");
        expect(options.attachments).toMatchObject([{ name: "หลักฐาน.png", type: "image/png" }]);
        expect(mocks.preAuthLimit).toHaveBeenCalledWith(
            expect.any(NextRequest),
            "it-ticket-comment-attachment",
        );
        expect(mocks.authenticatedLimit).toHaveBeenCalledWith(
            "it-ticket-comment-attachment",
            user.id,
        );
    });

    it("rejects malformed multipart, missing body, duplicate body, and authority fields", async () => {
        const malformedMultipart = new NextRequest(
            "http://localhost/api/it/tickets/19/comments",
            {
                method: "POST",
                headers: {
                    "Content-Type": "multipart/form-data; boundary=expected-boundary",
                    "Idempotency-Key": "comment-key",
                },
                body: "this is not multipart data",
            },
        );
        expect((await post()(malformedMultipart, { params: Promise.resolve({ ticketId: "19" }) })).status)
            .toBe(400);

        const cases = [
            multipartRequest(operator, [["attachments", image()]]),
            multipartRequest(operator, [["body", "first"], ["body", "second"]]),
            multipartRequest(operator, [["body", "body"], ["authorSide", "OPERATOR"]]),
        ];
        for (const request of cases) {
            const response = await post()(request, { params: Promise.resolve({ ticketId: "19" }) });
            expect(response.status).toBe(400);
        }
        expect(operator ? mocks.operatorPost : mocks.requesterPost).not.toHaveBeenCalled();
    });

    it("rejects unsupported media types, excessive declared/streamed envelopes, and missing keys", async () => {
        const unsupported = new NextRequest("http://localhost/api/it/tickets/19/comments", {
            method: "POST",
            headers: { "Content-Type": "text/plain", "Idempotency-Key": "comment-key" },
            body: "text",
        });
        expect((await post()(unsupported, { params: Promise.resolve({ ticketId: "19" }) })).status)
            .toBe(415);

        const oversizedHeader = new NextRequest("http://localhost/api/it/tickets/19/comments", {
            method: "POST",
            headers: {
                "Content-Type": "multipart/form-data; boundary=boundary",
                "Content-Length": "25000001",
                "Idempotency-Key": "comment-key",
            },
            body: "small",
        });
        expect((await post()(oversizedHeader, { params: Promise.resolve({ ticketId: "19" }) })).status)
            .toBe(413);

        const oversizedStream = new NextRequest("http://localhost/api/it/tickets/19/comments", {
            method: "POST",
            headers: {
                "Content-Type": "multipart/form-data; boundary=boundary",
                "Idempotency-Key": "comment-key",
            },
            body: Buffer.alloc(25_000_001),
        });
        expect(oversizedStream.headers.has("content-length")).toBe(false);
        expect((await post()(oversizedStream, { params: Promise.resolve({ ticketId: "19" }) })).status)
            .toBe(413);

        const missingKey = await post()(multipartRequest(operator, [["body", "ข้อความ"]], null), {
            params: Promise.resolve({ ticketId: "19" }),
        });
        expect(missingKey.status).toBe(400);
        expect(operator ? mocks.operatorPost : mocks.requesterPost).not.toHaveBeenCalled();
    });

    it("maps attachment validation and lifecycle failures to safe client errors", async () => {
        const target = operator ? mocks.operatorPost : mocks.requesterPost;
        target.mockRejectedValueOnce(new ITTicketAttachmentValidationError("รองรับสูงสุด 3 รูป"));
        const tooMany = await post()(multipartRequest(operator, [
            ["body", "ข้อความ"],
            ["attachments", image("1.png")],
            ["attachments", image("2.png")],
            ["attachments", image("3.png")],
            ["attachments", image("4.png")],
        ]), { params: Promise.resolve({ ticketId: "19" }) });
        expect(tooMany.status).toBe(400);

        target.mockRejectedValueOnce(new ITTicketNotCommentableError());
        const terminal = await post()(jsonRequest(operator, { body: "ข้อความ" }), {
            params: Promise.resolve({ ticketId: "19" }),
        });
        expect(terminal.status).toBe(409);
    });

    it("returns 401 before invoking the comment command", async () => {
        mocks.requireApiSession.mockResolvedValue({
            ok: false,
            response: NextResponse.json({ success: false }, { status: 401 }),
        });
        const response = await post()(jsonRequest(operator, { body: "ข้อความ" }), {
            params: Promise.resolve({ ticketId: "19" }),
        });
        expect(response.status).toBe(401);
        expect(operator ? mocks.operatorPost : mocks.requesterPost).not.toHaveBeenCalled();
    });

    it("logs only a sanitized error classification when storage fails", async () => {
        const target = operator ? mocks.operatorPost : mocks.requesterPost;
        target.mockRejectedValueOnce(new Error("EACCES: /srv/app/.uploads/private/it/19/secret.webp"));
        const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
        try {
            const response = await post()(multipartRequest(operator, [
                ["body", "ข้อความ"],
                ["attachments", image("secret-name.png")],
            ]), { params: Promise.resolve({ ticketId: "19" }) });
            expect(response.status).toBe(500);
            expect(log).toHaveBeenCalledWith(
                `Error posting ${operator ? "operator" : "requester"} IT Ticket comment:`,
                { errorType: "Error" },
            );
            expect(JSON.stringify(log.mock.calls)).not.toMatch(/secret\.webp|secret-name|\.uploads/);
        } finally {
            log.mockRestore();
        }
    });
});
