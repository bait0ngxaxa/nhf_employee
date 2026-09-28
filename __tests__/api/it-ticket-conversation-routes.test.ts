import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type * as ITModule from "@/modules/it";

const mocks = vi.hoisted(() => ({
    session: vi.fn(),
    buildContext: vi.fn(),
    requesterConversation: vi.fn(),
    requesterActivity: vi.fn(),
    operatorConversation: vi.fn(),
    operatorActivity: vi.fn(),
    requesterPost: vi.fn(),
    operatorPost: vi.fn(),
    wakeOutbox: vi.fn(),
}));

vi.mock("@/lib/auth/api", () => ({ requireApiSession: mocks.session }));
vi.mock("@/lib/server/it-ticket-outbox-wakeup", () => ({
    scheduleITTicketOutboxWakeup: mocks.wakeOutbox,
}));
vi.mock("@/modules/it", async () => {
    const actual = await vi.importActual<typeof ITModule>("@/modules/it");
    return {
        ...actual,
        buildCurrentITAuthorizationContext: mocks.buildContext,
        getITRequesterTicketConversation: mocks.requesterConversation,
        getITRequesterTicketActivity: mocks.requesterActivity,
        getITOperatorTicketConversation: mocks.operatorConversation,
        getITOperatorTicketActivity: mocks.operatorActivity,
        postITRequesterTicketComment: mocks.requesterPost,
        postITOperatorTicketComment: mocks.operatorPost,
    };
});

import { GET as getRequesterConversation } from "@/app/api/it/tickets/[ticketId]/conversation/route";
import { GET as getRequesterActivity } from "@/app/api/it/tickets/[ticketId]/activity/route";
import { POST as postRequesterComment } from "@/app/api/it/tickets/[ticketId]/comments/route";
import { GET as getOperatorConversation } from "@/app/api/it/operator/tickets/[ticketId]/conversation/route";
import { GET as getOperatorActivity } from "@/app/api/it/operator/tickets/[ticketId]/activity/route";
import { POST as postOperatorComment } from "@/app/api/it/operator/tickets/[ticketId]/comments/route";

const session = { user: { id: "41", email: "staff@example.test", role: "USER" } };
const context = { authorizationActor: { userId: 41, employeeId: 84 } };
const commentSubmission = {
    comment: {
        type: "COMMENT",
        id: "cmtest123",
        createdAt: "2026-09-01T01:00:00.000Z",
        authorDisplayName: "ผู้ใช้งานตัวอย่าง",
        authorSide: "REQUESTER",
        body: "ข้อความตอบกลับ",
        attachments: [],
    },
    replayed: false,
};

function routeContext(ticketId: string) {
    return { params: Promise.resolve({ ticketId }) };
}

function request(
    url: string,
    method: "GET" | "POST",
    body?: unknown,
    headers: Record<string, string> = {},
): NextRequest {
    return new NextRequest(url, {
        method,
        headers,
        ...(body === undefined ? {} : { body: new TextEncoder().encode(JSON.stringify(body)) }),
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.session.mockResolvedValue({ ok: true, ...session });
    mocks.buildContext.mockResolvedValue(context);
    mocks.requesterConversation.mockResolvedValue({ items: [], olderCursor: null, hasMore: false });
    mocks.requesterActivity.mockResolvedValue({ items: [], olderCursor: null, hasMore: false });
    mocks.operatorConversation.mockResolvedValue({ items: [], olderCursor: null, hasMore: false });
    mocks.operatorActivity.mockResolvedValue({ items: [], olderCursor: null, hasMore: false });
    mocks.requesterPost.mockResolvedValue(commentSubmission);
    mocks.operatorPost.mockResolvedValue({
        ...commentSubmission,
        comment: { ...commentSubmission.comment, authorSide: "OPERATOR" },
    });
});

describe("IT Ticket conversation and activity HTTP routes", () => {
    it("requires authentication and rejects malformed IDs and unauthorized query widening", async () => {
        mocks.session.mockImplementation(async (options: {
            readonly unauthorizedResponse: () => Response;
        }) => ({ ok: false, response: options.unauthorizedResponse() }));
        const unauthorized = await getRequesterConversation(
            request("http://localhost/api/it/tickets/19/conversation", "GET"),
            routeContext("19"),
        );
        expect(unauthorized.status).toBe(401);

        mocks.session.mockResolvedValue({ ok: true, ...session });
        const malformedId = await getRequesterConversation(
            request("http://localhost/api/it/tickets/0/conversation", "GET"),
            routeContext("0"),
        );
        const widened = await getRequesterActivity(
            request("http://localhost/api/it/tickets/19/activity?scope=all", "GET"),
            routeContext("19"),
        );
        expect(malformedId.status).toBe(400);
        expect(widened.status).toBe(400);
        expect(mocks.requesterConversation).not.toHaveBeenCalled();
        expect(mocks.requesterActivity).not.toHaveBeenCalled();
    });

    it("keeps requester Conversation and Activity pagination independent and bounded", async () => {
        const conversation = await getRequesterConversation(
            request("http://localhost/api/it/tickets/19/conversation?limit=12&cursor=comment-cursor", "GET"),
            routeContext("19"),
        );
        const activity = await getRequesterActivity(
            request("http://localhost/api/it/tickets/19/activity?limit=7&cursor=event-cursor", "GET"),
            routeContext("19"),
        );

        expect([conversation.status, activity.status]).toEqual([200, 200]);
        expect(mocks.requesterConversation).toHaveBeenCalledWith(context, 19, {
            limit: "12",
            cursor: "comment-cursor",
        });
        expect(mocks.requesterActivity).toHaveBeenCalledWith(context, 19, {
            limit: "7",
            cursor: "event-cursor",
        });
    });

    it("keeps operator Conversation and Activity reads bounded and rejects client scope authority", async () => {
        const widened = await getOperatorActivity(
            request("http://localhost/api/it/operator/tickets/19/activity?scope=all", "GET"),
            routeContext("19"),
        );
        const conversation = await getOperatorConversation(
            request("http://localhost/api/it/operator/tickets/19/conversation?limit=12&cursor=comment-cursor", "GET"),
            routeContext("19"),
        );
        const activity = await getOperatorActivity(
            request("http://localhost/api/it/operator/tickets/19/activity?limit=7&cursor=event-cursor", "GET"),
            routeContext("19"),
        );

        expect(widened.status).toBe(400);
        expect([conversation.status, activity.status]).toEqual([200, 200]);
        expect(mocks.operatorConversation).toHaveBeenCalledWith(context, 19, {
            limit: "12",
            cursor: "comment-cursor",
        });
        expect(mocks.operatorActivity).toHaveBeenCalledWith(context, 19, {
            limit: "7",
            cursor: "event-cursor",
        });
    });

    it("requires Idempotency-Key and strictly rejects caller-supplied author authority", async () => {
        const missingKey = await postRequesterComment(
            request("http://localhost/api/it/tickets/19/comments", "POST", { body: "ข้อความ" }),
            routeContext("19"),
        );
        const forgedSide = await postRequesterComment(
            request("http://localhost/api/it/tickets/19/comments", "POST", {
                body: "ข้อความ",
                authorType: "OPERATOR",
            }, { "Idempotency-Key": "requester-key" }),
            routeContext("19"),
        );

        expect(missingKey.status).toBe(400);
        expect(forgedSide.status).toBe(400);
        expect(mocks.requesterPost).not.toHaveBeenCalled();
    });

    it("bounds raw comment JSON request bytes before accepting either comment route", async () => {
        const oversizedRequester = request(
            "http://localhost/api/it/tickets/19/comments",
            "POST",
            { body: "ก".repeat(22_000) },
            { "Idempotency-Key": "request-size-limit" },
        );
        const oversizedOperator = request(
            "http://localhost/api/it/operator/tickets/19/comments",
            "POST",
            { body: "ก".repeat(22_000) },
            { "Idempotency-Key": "request-size-limit" },
        );

        const [requesterResponse, operatorResponse] = await Promise.all([
            postRequesterComment(oversizedRequester, routeContext("19")),
            postOperatorComment(oversizedOperator, routeContext("19")),
        ]);

        expect(requesterResponse.status).toBe(413);
        expect(operatorResponse.status).toBe(413);
        expect(mocks.requesterPost).not.toHaveBeenCalled();
        expect(mocks.operatorPost).not.toHaveBeenCalled();
    });

    it("derives requester/operator posting semantics from their separate routes", async () => {
        const requesterResponse = await postRequesterComment(
            request("http://localhost/api/it/tickets/19/comments", "POST", {
                body: "  ขอความช่วยเหลือค่ะ  ",
            }, { "Idempotency-Key": "same-key" }),
            routeContext("19"),
        );
        const operatorResponse = await postOperatorComment(
            request("http://localhost/api/it/operator/tickets/19/comments", "POST", {
                body: "  กำลังตรวจสอบค่ะ  ",
            }, { "Idempotency-Key": "operator-key" }),
            routeContext("19"),
        );

        expect(requesterResponse.status).toBe(201);
        expect(operatorResponse.status).toBe(201);
        expect(mocks.requesterPost).toHaveBeenCalledWith(
            context,
            { ticketId: 19, body: "ขอความช่วยเหลือค่ะ" },
            {
                idempotencyKey: "same-key",
                attachments: [],
                requestMetadata: expect.objectContaining({
                    userEmail: session.user.email,
                    requestId: expect.any(String),
                    correlationId: expect.any(String),
                }),
            },
        );
        expect(mocks.operatorPost).toHaveBeenCalledWith(
            context,
            { ticketId: 19, body: "กำลังตรวจสอบค่ะ" },
            {
                idempotencyKey: "operator-key",
                attachments: [],
                requestMetadata: expect.objectContaining({
                    userEmail: session.user.email,
                    requestId: expect.any(String),
                    correlationId: expect.any(String),
                }),
            },
        );
        expect(await requesterResponse.json()).toMatchObject({ success: true, replayed: false });
        expect(mocks.wakeOutbox).toHaveBeenCalledTimes(2);
    });

    it("returns the original comment as a successful replay", async () => {
        mocks.requesterPost.mockResolvedValueOnce({ ...commentSubmission, replayed: true });
        const response = await postRequesterComment(
            request("http://localhost/api/it/tickets/19/comments", "POST", { body: "ข้อความ" }, {
                "Idempotency-Key": "requester-key",
            }),
            routeContext("19"),
        );

        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({ success: true, replayed: true });
    });
});
