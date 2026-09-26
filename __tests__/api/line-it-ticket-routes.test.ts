// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import type * as ITModule from "@/modules/it";

const mocks = vi.hoisted(() => ({
    session: vi.fn(),
    buildContext: vi.fn(),
    listTickets: vi.fn(),
    createTicket: vi.fn(),
    getTicket: vi.fn(),
    timeline: vi.fn(),
    postComment: vi.fn(),
    getAttachment: vi.fn(),
    readAttachment: vi.fn(),
    preAuthLimit: vi.fn(),
    authenticatedLimit: vi.fn(),
    wakeOutbox: vi.fn(),
}));

vi.mock("@/modules/line", () => ({
    requireLiffWorkforceSession: mocks.session,
}));
vi.mock("@/modules/it", async () => {
    const actual = await vi.importActual<typeof ITModule>("@/modules/it");
    return {
        ...actual,
        buildITAuthorizationContext: mocks.buildContext,
        listITRequesterTickets: mocks.listTickets,
        createITTicket: mocks.createTicket,
        getITRequesterTicket: mocks.getTicket,
        getITRequesterTicketTimeline: mocks.timeline,
        postITRequesterTicketComment: mocks.postComment,
        getITTicketAttachmentForDownload: mocks.getAttachment,
        readITTicketAttachment: mocks.readAttachment,
    };
});
vi.mock("@/lib/security/mutation-rate-limit", () => ({
    enforcePreAuthIpRateLimit: mocks.preAuthLimit,
    enforceAuthenticatedMutationRateLimit: mocks.authenticatedLimit,
}));
vi.mock("@/lib/server/it-ticket-outbox-wakeup", () => ({
    scheduleITTicketOutboxWakeup: mocks.wakeOutbox,
}));

import { GET as getTickets, POST as createTicket } from "@/app/api/line/it/tickets/route";
import { GET as getTicketDetail } from "@/app/api/line/it/tickets/[ticketId]/route";
import { GET as getTimeline } from "@/app/api/line/it/tickets/[ticketId]/timeline/route";
import { POST as postComment } from "@/app/api/line/it/tickets/[ticketId]/comments/route";
import { GET as getAttachment } from "@/app/api/line/it/attachments/[attachmentId]/route";
import {
    ITTicketIdempotencyConflictError,
    ITTicketInputValidationError,
    ITTicketNotCommentableError,
    ITTicketNotFoundError,
} from "@/modules/it";

const user = { id: 41, email: "staff@example.test", name: "Staff", role: "USER" };
const employeeId = 84;
const actorContext = {
    authorizationActor: {
        userId: user.id,
        employeeId,
        systemRole: "USER",
        channel: "LIFF_SELF_SERVICE",
    },
};
const ticketRecord = {
    id: 19,
    type: "INCIDENT" as const,
    title: "เข้าใช้งานระบบไม่ได้",
    description: "หน้าเข้าสู่ระบบแสดงข้อผิดพลาด",
    status: "OPEN" as const,
    requesterUserId: user.id,
    assignedToUserId: null,
    categoryId: null,
    requesterDepartmentId: 9,
    requesterDepartmentNameSnapshot: "แผนกตัวอย่าง",
    version: 1,
    resolvedAt: null,
    createdAt: new Date("2026-09-01T01:00:00.000Z"),
    updatedAt: new Date("2026-09-01T01:00:00.000Z"),
};
const requesterTicket = {
    id: ticketRecord.id,
    type: ticketRecord.type,
    title: ticketRecord.title,
    description: ticketRecord.description,
    status: ticketRecord.status,
    createdAt: ticketRecord.createdAt.toISOString(),
    updatedAt: ticketRecord.updatedAt.toISOString(),
    resolvedAt: null,
};
const commentSubmission = {
    comment: {
        type: "COMMENT",
        id: "cmtest123",
        createdAt: "2026-09-01T01:00:00.000Z",
        authorDisplayName: "ผู้ใช้งานตัวอย่าง",
        authorSide: "REQUESTER",
        body: "รายละเอียดเพิ่มเติม",
        attachments: [],
    },
    replayed: false,
};

function jsonRequest(
    url: string,
    method: "GET" | "POST",
    body?: unknown,
    headers: Record<string, string> = {},
): NextRequest {
    return new NextRequest(url, {
        method,
        headers: {
            ...(body === undefined ? {} : { "Content-Type": "application/json" }),
            ...headers,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
}

function ticketParams(ticketId: string) {
    return { params: Promise.resolve({ ticketId }) };
}

function attachmentParams(attachmentId: string) {
    return { params: Promise.resolve({ attachmentId }) };
}

function multipartCommentRequest(): NextRequest {
    const form = new FormData();
    form.append("body", "รายละเอียดเพิ่มเติม");
    form.append("attachments", new File([new Uint8Array([1, 2, 3])], "proof.png", {
        type: "image/png",
    }));
    return new NextRequest("http://localhost/api/line/it/tickets/19/comments", {
        method: "POST",
        headers: { "Idempotency-Key": "comment-key" },
        body: form,
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.session.mockResolvedValue({ ok: true, user, employeeId });
    mocks.buildContext.mockReturnValue(actorContext);
    mocks.listTickets.mockResolvedValue({
        tickets: [requesterTicket],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });
    mocks.createTicket.mockResolvedValue({ ticket: ticketRecord, replayed: false });
    mocks.getTicket.mockResolvedValue(requesterTicket);
    mocks.timeline.mockResolvedValue({ items: [], olderCursor: null, hasMore: false });
    mocks.postComment.mockResolvedValue(commentSubmission);
    mocks.getAttachment.mockResolvedValue({
        id: "a".repeat(32),
        ticketId: 19,
        storageKey: "private/secret.webp",
        contentType: "image/webp",
    });
    mocks.readAttachment.mockResolvedValue(new Uint8Array([1, 2, 3]));
    mocks.preAuthLimit.mockReturnValue(null);
    mocks.authenticatedLimit.mockReturnValue(null);
});

describe("LIFF IT Ticket API routes", () => {
    it.each([
        ["missing session", 401],
        ["stale LINE link", 401],
        ["inactive workforce", 403],
    ] as const)("passes through the LIFF session denial for %s", async (_case, status) => {
        const response = NextResponse.json({ error: "denied" }, { status });
        mocks.session.mockResolvedValueOnce({ ok: false, response });

        const result = await getTickets(jsonRequest("http://localhost/api/line/it/tickets", "GET"));

        expect(result).toBe(response);
        expect(mocks.listTickets).not.toHaveBeenCalled();
    });

    it("lists only requester DTOs with requester pagination defaults and a LIFF actor", async () => {
        const response = await getTickets(jsonRequest("http://localhost/api/line/it/tickets", "GET"));
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload).toMatchObject({
            success: true,
            tickets: [requesterTicket],
            pagination: { page: 1, limit: 10 },
        });
        expect(mocks.buildContext).toHaveBeenCalledWith(user, employeeId, "LIFF_SELF_SERVICE");
        expect(mocks.listTickets).toHaveBeenCalledWith(actorContext, { page: 1, limit: 10 });
        expect(JSON.stringify(payload)).not.toMatch(/requesterUserId|assignedToUserId|storageKey/);
    });

    it("conceals foreign detail and rejects malformed Ticket IDs before querying", async () => {
        mocks.getTicket.mockRejectedValueOnce(new ITTicketNotFoundError());
        const foreign = await getTicketDetail(
            jsonRequest("http://localhost/api/line/it/tickets/20", "GET"),
            ticketParams("20"),
        );
        const malformed = await getTicketDetail(
            jsonRequest("http://localhost/api/line/it/tickets/019", "GET"),
            ticketParams("019"),
        );

        expect([foreign.status, malformed.status]).toEqual([404, 400]);
        expect(mocks.getTicket).toHaveBeenCalledTimes(1);
        expect(mocks.buildContext).toHaveBeenCalledWith(user, employeeId, "LIFF_SELF_SERVICE");
    });

    it("rate limits creation before authentication and by principal before mutation", async () => {
        const request = jsonRequest(
            "http://localhost/api/line/it/tickets",
            "POST",
            { type: "INCIDENT", title: "หัวข้อ", description: "รายละเอียด" },
            { "Idempotency-Key": "create-key" },
        );
        const response = await createTicket(request);

        expect(response.status).toBe(201);
        expect(mocks.preAuthLimit).toHaveBeenCalledWith(request, "it-ticket-create");
        expect(mocks.authenticatedLimit).toHaveBeenCalledWith("it-ticket-create", user.id);
        expect(mocks.preAuthLimit.mock.invocationCallOrder[0])
            .toBeLessThan(mocks.session.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER);
        expect(mocks.session.mock.invocationCallOrder[0])
            .toBeLessThan(mocks.authenticatedLimit.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER);
        expect(mocks.authenticatedLimit.mock.invocationCallOrder[0])
            .toBeLessThan(mocks.createTicket.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER);
        expect(mocks.buildContext).toHaveBeenCalledWith(user, employeeId, "LIFF_SELF_SERVICE");
        expect(mocks.createTicket).toHaveBeenCalledWith(actorContext, {
            type: "INCIDENT",
            title: "หัวข้อ",
            description: "รายละเอียด",
        }, { idempotencyKey: "create-key" });
        expect(mocks.wakeOutbox).toHaveBeenCalledTimes(1);
    });

    it("rejects caller-selected requester identity and missing or invalid create idempotency", async () => {
        const forged = await createTicket(jsonRequest(
            "http://localhost/api/line/it/tickets",
            "POST",
            { type: "INCIDENT", title: "หัวข้อ", description: "รายละเอียด", requesterUserId: 99 },
            { "Idempotency-Key": "create-key" },
        ));
        const missingKey = await createTicket(jsonRequest(
            "http://localhost/api/line/it/tickets",
            "POST",
            { type: "INCIDENT", title: "หัวข้อ", description: "รายละเอียด" },
        ));
        const invalidKey = await createTicket(jsonRequest(
            "http://localhost/api/line/it/tickets",
            "POST",
            { type: "INCIDENT", title: "หัวข้อ", description: "รายละเอียด" },
            { "Idempotency-Key": "x".repeat(256) },
        ));

        expect([forged.status, missingKey.status, invalidKey.status]).toEqual([400, 400, 400]);
        expect(mocks.createTicket).not.toHaveBeenCalled();
        expect(mocks.wakeOutbox).not.toHaveBeenCalled();
    });

    it("returns 201 on first create, 200 on replay, and never wakes duplicate outbox work", async () => {
        const request = () => jsonRequest(
            "http://localhost/api/line/it/tickets",
            "POST",
            { type: "INCIDENT", title: "หัวข้อ", description: "รายละเอียด" },
            { "Idempotency-Key": "same-create-key" },
        );
        const first = await createTicket(request());
        mocks.createTicket.mockResolvedValueOnce({ ticket: ticketRecord, replayed: true });
        const replay = await createTicket(request());
        mocks.createTicket.mockRejectedValueOnce(new ITTicketIdempotencyConflictError());
        const changed = await createTicket(jsonRequest(
            "http://localhost/api/line/it/tickets",
            "POST",
            { type: "INCIDENT", title: "เปลี่ยนหัวข้อ", description: "รายละเอียด" },
            { "Idempotency-Key": "same-create-key" },
        ));

        expect([first.status, replay.status, changed.status]).toEqual([201, 200, 409]);
        expect(await replay.json()).toMatchObject({ replayed: true });
        expect(mocks.wakeOutbox).toHaveBeenCalledTimes(1);
        expect(JSON.stringify(await first.json())).not.toMatch(/requesterUserId|assignedToUserId|storageKey/);
    });

    it("serves own timeline and rejects foreign resources, malformed cursor, and duplicate cursor", async () => {
        const own = await getTimeline(
            jsonRequest("http://localhost/api/line/it/tickets/19/timeline?limit=25", "GET"),
            ticketParams("19"),
        );
        mocks.timeline.mockRejectedValueOnce(new ITTicketNotFoundError());
        const foreign = await getTimeline(
            jsonRequest("http://localhost/api/line/it/tickets/20/timeline", "GET"),
            ticketParams("20"),
        );
        mocks.timeline.mockRejectedValueOnce(new ITTicketInputValidationError());
        const malformed = await getTimeline(
            jsonRequest("http://localhost/api/line/it/tickets/19/timeline?cursor=bad", "GET"),
            ticketParams("19"),
        );
        const duplicate = await getTimeline(
            jsonRequest("http://localhost/api/line/it/tickets/19/timeline?cursor=a&cursor=b", "GET"),
            ticketParams("19"),
        );

        expect([own.status, foreign.status, malformed.status, duplicate.status])
            .toEqual([200, 404, 400, 400]);
        expect(mocks.timeline).toHaveBeenCalledTimes(3);
        expect(mocks.timeline).toHaveBeenCalledWith(actorContext, 19, { limit: "25" });
    });

    it("posts only requester comments, replays without wakeup, and maps changed content or terminal state safely", async () => {
        const request = () => jsonRequest(
            "http://localhost/api/line/it/tickets/19/comments",
            "POST",
            { body: "รายละเอียดเพิ่มเติม" },
            { "Idempotency-Key": "same-comment-key" },
        );
        const first = await postComment(request(), ticketParams("19"));
        mocks.postComment.mockResolvedValueOnce({ ...commentSubmission, replayed: true });
        const replay = await postComment(request(), ticketParams("19"));
        mocks.postComment.mockRejectedValueOnce(new ITTicketIdempotencyConflictError());
        const changed = await postComment(jsonRequest(
            "http://localhost/api/line/it/tickets/19/comments",
            "POST",
            { body: "เนื้อหาที่เปลี่ยน" },
            { "Idempotency-Key": "same-comment-key" },
        ), ticketParams("19"));
        mocks.postComment.mockRejectedValueOnce(new ITTicketNotCommentableError());
        const terminal = await postComment(request(), ticketParams("19"));
        mocks.postComment.mockRejectedValueOnce(new ITTicketNotFoundError());
        const foreign = await postComment(request(), ticketParams("20"));
        const missingKey = await postComment(jsonRequest(
            "http://localhost/api/line/it/tickets/19/comments",
            "POST",
            { body: "ข้อความที่ไม่มี key" },
        ), ticketParams("19"));

        expect([
            first.status,
            replay.status,
            changed.status,
            terminal.status,
            foreign.status,
            missingKey.status,
        ]).toEqual([201, 200, 409, 409, 404, 400]);
        expect(await replay.json()).toMatchObject({
            comment: { authorSide: "REQUESTER", body: "รายละเอียดเพิ่มเติม" },
            replayed: true,
        });
        expect(mocks.postComment).toHaveBeenCalledWith(actorContext, {
            ticketId: 19,
            body: "รายละเอียดเพิ่มเติม",
        }, { idempotencyKey: "same-comment-key", attachments: [] });
        expect(mocks.wakeOutbox).toHaveBeenCalledTimes(1);
    });

    it("applies the shared attachment limiter to multipart comments and none to JSON comments", async () => {
        await postComment(jsonRequest(
            "http://localhost/api/line/it/tickets/19/comments",
            "POST",
            { body: "ข้อความ" },
            { "Idempotency-Key": "json-comment" },
        ), ticketParams("19"));
        expect(mocks.preAuthLimit).not.toHaveBeenCalled();
        expect(mocks.authenticatedLimit).not.toHaveBeenCalled();

        const request = multipartCommentRequest();
        const response = await postComment(request, ticketParams("19"));
        expect(response.status).toBe(201);
        expect(mocks.preAuthLimit).toHaveBeenCalledWith(request, "it-ticket-comment-attachment");
        expect(mocks.authenticatedLimit).toHaveBeenCalledWith(
            "it-ticket-comment-attachment",
            user.id,
        );
        expect(mocks.postComment).toHaveBeenLastCalledWith(actorContext, {
            ticketId: 19,
            body: "รายละเอียดเพิ่มเติม",
        }, expect.objectContaining({ idempotencyKey: "comment-key" }));
    });

    it("downloads only authorized private WebP and conceals absent physical files", async () => {
        const success = await getAttachment(
            jsonRequest("http://localhost/api/line/it/attachments/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "GET"),
            attachmentParams("a".repeat(32)),
        );
        const payload = new Uint8Array(await success.arrayBuffer());

        expect(success.status).toBe(200);
        expect(payload).toEqual(new Uint8Array([1, 2, 3]));
        expect(success.headers.get("Content-Type")).toBe("image/webp");
        expect(success.headers.get("Content-Disposition")).toBe("inline");
        expect(success.headers.get("Cache-Control")).toBe("private, no-store");
        expect(success.headers.get("X-Content-Type-Options")).toBe("nosniff");
        expect(mocks.getAttachment).toHaveBeenCalledWith(actorContext, "a".repeat(32));

        mocks.getAttachment.mockRejectedValueOnce(new ITTicketNotFoundError());
        const foreign = await getAttachment(
            jsonRequest("http://localhost/api/line/it/attachments/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "GET"),
            attachmentParams("b".repeat(32)),
        );
        expect(foreign.status).toBe(404);

        const missingFileError = Object.assign(new Error("ENOENT: /private/secret.webp"), {
            code: "ENOENT",
        });
        mocks.readAttachment.mockRejectedValueOnce(missingFileError);
        const missingFile = await getAttachment(
            jsonRequest("http://localhost/api/line/it/attachments/cccccccccccccccccccccccccccccccc", "GET"),
            attachmentParams("c".repeat(32)),
        );
        expect(missingFile.status).toBe(404);
        expect(mocks.readAttachment).toHaveBeenLastCalledWith("private/secret.webp", 19);
        expect(JSON.stringify(await foreign.json())).not.toMatch(/storageKey|secret|private/);
        expect(JSON.stringify(await missingFile.json())).not.toMatch(/ENOENT|storageKey|secret|private/);
    });
});
