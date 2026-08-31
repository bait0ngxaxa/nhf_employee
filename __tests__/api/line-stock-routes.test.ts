// @vitest-environment node
import { StockRequestStatus } from "@prisma/client";
import type * as NextServerModule from "next/server";
import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    requireLiffWorkforceSession: vi.fn(),
    getItems: vi.fn(),
    getVariantAvailability: vi.fn(),
    getCategories: vi.fn(),
    getRequests: vi.fn(),
    getRequestById: vi.fn(),
    createRequest: vi.fn(),
    issueRequest: vi.fn(),
    cancelRequest: vi.fn(),
    processOutbox: vi.fn(),
    enforcePreAuthIpRateLimit: vi.fn(),
    enforceAuthenticatedMutationRateLimit: vi.fn(),
}));

vi.mock("next/server", async (importOriginal) => {
    const actual = await importOriginal<typeof NextServerModule>();
    return {
        ...actual,
        after: vi.fn((callback: () => void | Promise<void>) => {
            void callback();
        }),
    };
});

vi.mock("@/lib/auth/liff", () => ({
    requireLiffWorkforceSession: mocks.requireLiffWorkforceSession,
}));

vi.mock("@/lib/services/stock", () => ({
    stockService: {
        getItems: mocks.getItems,
        getVariantAvailability: mocks.getVariantAvailability,
        getCategories: mocks.getCategories,
        getRequests: mocks.getRequests,
        getRequestById: mocks.getRequestById,
        createRequest: mocks.createRequest,
        issueRequest: mocks.issueRequest,
        cancelRequest: mocks.cancelRequest,
    },
}));

vi.mock("@/lib/services/outbox/processor", () => ({
    processOutbox: mocks.processOutbox,
}));

vi.mock("@/lib/security/mutation-rate-limit", () => ({
    enforcePreAuthIpRateLimit: mocks.enforcePreAuthIpRateLimit,
    enforceAuthenticatedMutationRateLimit:
        mocks.enforceAuthenticatedMutationRateLimit,
}));

import { GET as getCategories } from "@/app/api/line/stock/categories/route";
import { GET as getItems } from "@/app/api/line/stock/items/route";
import { GET as getAvailability } from "@/app/api/line/stock/availability/route";
import { GET as getProcessing } from "@/app/api/line/stock/processing/route";
import { GET as getDetail } from "@/app/api/line/stock/requests/[id]/route";
import { POST as cancelRequest } from "@/app/api/line/stock/requests/[id]/cancel/route";
import { POST as issueRequest } from "@/app/api/line/stock/requests/[id]/issue/route";
import {
    GET as getMyRequests,
    POST as createRequest,
} from "@/app/api/line/stock/requests/route";
import { StockRequestIdempotencyConflictError } from "@/lib/services/stock/request-idempotency";
import { STOCK_JSON_MUTATION_MAX_BYTES } from "@/lib/server/stock-api";

const USER_AUTH = {
    ok: true as const,
    user: {
        id: 7,
        role: "USER",
        email: "employee@example.com",
        name: "พนักงาน ทดสอบ",
    },
    employeeId: 70,
};

const ADMIN_AUTH = {
    ...USER_AUTH,
    user: {
        id: 1,
        role: "ADMIN",
        email: "admin@example.com",
        name: "ผู้ดูแล ทดสอบ",
    },
};

const RAW_ITEM = {
    id: 10,
    name: "กระดาษ A4",
    description: "กระดาษสำหรับสำนักงาน",
    imageUrl: "/api/uploads/stock/paper.webp",
    sku: "PAPER-A4",
    unit: "รีม",
    quantity: 20,
    reservedQuantity: 3,
    availableQuantity: 17,
    minStock: 2,
    categoryId: 2,
    isActive: true,
    category: { id: 2, name: "เครื่องเขียน" },
    variants: [{
        id: 101,
        stockItemId: 10,
        sku: "PAPER-A4-80",
        unit: "รีม",
        quantity: 20,
        reservedQuantity: 3,
        availableQuantity: 17,
        minStock: 2,
        imageUrl: null,
        isActive: true,
        attributeValues: [{
            attributeValue: {
                id: 301,
                value: "80 แกรม",
                attribute: { id: 201, name: "ความหนา" },
            },
        }],
    }],
};

const RAW_REQUEST = {
    id: 71,
    requestedBy: 7,
    idempotencyKey: "private-key",
    requestHash: "private-hash",
    projectCode: "NHF-2569",
    status: StockRequestStatus.PENDING_ISSUE,
    note: "ใช้ในกิจกรรม",
    issuedById: null,
    issuedAt: null,
    cancelReason: null,
    cancelledById: null,
    cancelledAt: null,
    createdAt: new Date("2026-08-30T03:00:00.000Z"),
    updatedAt: new Date("2026-08-30T03:00:00.000Z"),
    requester: {
        id: 7,
        name: "พนักงาน ทดสอบ",
        email: "employee@example.com",
        employee: {
            firstName: "พนักงาน",
            lastName: "ทดสอบ",
            nickname: null,
        },
    },
    issuer: null,
    canceller: null,
    items: [{
        id: 701,
        itemId: 10,
        variantId: 101,
        quantity: 2,
        item: {
            id: 10,
            name: "กระดาษ A4",
            sku: "PAPER-A4",
            unit: "รีม",
            isActive: true,
        },
        variant: {
            id: 101,
            sku: "PAPER-A4-80",
            unit: "รีม",
            quantity: 20,
            isActive: true,
            imageUrl: null,
            attributeValues: RAW_ITEM.variants[0].attributeValues,
        },
    }],
};

function request(
    path: string,
    init?: ConstructorParameters<typeof NextRequest>[1],
): NextRequest {
    return new NextRequest(`http://localhost${path}`, init);
}

describe("LIFF Stock route adapters", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.requireLiffWorkforceSession.mockResolvedValue(USER_AUTH);
        mocks.enforcePreAuthIpRateLimit.mockReturnValue(null);
        mocks.enforceAuthenticatedMutationRateLimit.mockReturnValue(null);
        mocks.processOutbox.mockResolvedValue(undefined);
        mocks.getItems.mockResolvedValue({
            items: [RAW_ITEM],
            total: 1,
            page: 1,
            limit: 12,
        });
        mocks.getVariantAvailability.mockResolvedValue([
            { id: 101, availableQuantity: 17, isAvailable: true },
        ]);
        mocks.getCategories.mockResolvedValue([{
            id: 2,
            name: "เครื่องเขียน",
            description: "วัสดุสำนักงาน",
            _count: { items: 99 },
        }]);
        mocks.getRequests.mockResolvedValue({
            requests: [RAW_REQUEST],
            total: 1,
            page: 1,
            limit: 10,
        });
        mocks.getRequestById.mockResolvedValue(RAW_REQUEST);
        mocks.createRequest.mockResolvedValue({
            request: RAW_REQUEST,
            replayed: false,
        });
        mocks.issueRequest.mockResolvedValue({
            request: { id: 71, requestedBy: 7 },
            lowStockAlerts: [],
        });
        mocks.cancelRequest.mockResolvedValue({
            id: 71,
            status: StockRequestStatus.CANCELLED,
        });
    });

    it("requires a LIFF workforce session for catalog access", async () => {
        mocks.requireLiffWorkforceSession.mockResolvedValueOnce({
            ok: false,
            response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        });

        expect((await getItems(request("/api/line/stock/items"))).status).toBe(401);
        expect(mocks.getItems).not.toHaveBeenCalled();
    });

    it("validates and authorizes targeted availability without exposing internal fields", async () => {
        mocks.requireLiffWorkforceSession.mockResolvedValueOnce({
            ok: false,
            response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        });
        expect((await getAvailability(request(
            "/api/line/stock/availability?variantIds=101",
        ))).status).toBe(401);
        expect(mocks.getVariantAvailability).not.toHaveBeenCalled();

        const response = await getAvailability(request(
            "/api/line/stock/availability?variantIds=101,101,205",
        ));
        expect(response.status).toBe(200);
        expect(mocks.getVariantAvailability).toHaveBeenCalledWith([101, 205]);
        expect(await response.json()).toEqual({
            variants: [{ id: 101, availableQuantity: 17, isAvailable: true }],
        });

        expect((await getAvailability(request(
            "/api/line/stock/availability?variantIds=0,101",
        ))).status).toBe(400);
        const tooManyIds = Array.from({ length: 21 }, (_, index) => index + 1)
            .join(",");
        expect((await getAvailability(request(
            `/api/line/stock/availability?variantIds=${tooManyIds}`,
        ))).status).toBe(400);
    });

    it("forces active-only catalog filters and serializes only mobile fields", async () => {
        const response = await getItems(request(
            "/api/line/stock/items?page=1&limit=12&search=PAPER&categoryId=2&activeOnly=false",
        ));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(mocks.getItems).toHaveBeenCalledWith({
            page: 1,
            limit: 12,
            search: "PAPER",
            categoryId: 2,
            activeOnly: true,
        });
        expect(body.items[0]).not.toHaveProperty("minStock");
        expect(body.items[0]).not.toHaveProperty("reservedQuantity");
        expect(body.items[0]).not.toHaveProperty("isActive");
        expect(body.items[0].variants[0]).toMatchObject({
            id: 101,
            availableQuantity: 17,
            attributeValues: [{
                attributeValue: {
                    value: "80 แกรม",
                    attribute: { name: "ความหนา" },
                },
            }],
        });
        expect(body.items[0].variants[0]).not.toHaveProperty("minStock");
    });

    it("returns lightweight categories without administrative metadata", async () => {
        const response = await getCategories();
        expect(await response.json()).toEqual({
            categories: [{ id: 2, name: "เครื่องเขียน" }],
        });
    });

    it("forces employee history to the authenticated user despite forged scope", async () => {
        const response = await getMyRequests(request(
            "/api/line/stock/requests?scope=all&userId=999&page=1&limit=10&search=NHF",
        ));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(mocks.getRequests).toHaveBeenCalledWith(
            expect.objectContaining({ search: "NHF", page: 1, limit: 10 }),
            7,
            false,
            "mine",
        );
        expect(body.requests[0]).not.toHaveProperty("requester");
        expect(body.requests[0]).not.toHaveProperty("idempotencyKey");
        expect(body.requests[0].availableActions).toEqual(["CANCEL"]);
    });

    it("authorizes the processing queue independently and defaults to actionable requests", async () => {
        expect((await getProcessing(request("/api/line/stock/processing"))).status)
            .toBe(403);
        expect(mocks.getRequests).not.toHaveBeenCalled();

        mocks.requireLiffWorkforceSession.mockResolvedValueOnce(ADMIN_AUTH);
        const response = await getProcessing(request(
            "/api/line/stock/processing?page=1&limit=10&status=ISSUED",
        ));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(mocks.getRequests).toHaveBeenCalledWith(
            expect.objectContaining({ status: StockRequestStatus.PENDING_ISSUE }),
            1,
            true,
            "all",
        );
        expect(body.requests[0].requester).toEqual({ name: "พนักงาน ทดสอบ" });
        expect(body.requests[0].availableActions).toEqual(["ISSUE", "CANCEL"]);
    });

    it("allows owner detail, hides unrelated detail, and derives processor actions on the server", async () => {
        const ownerResponse = await getDetail(
            request("/api/line/stock/requests/71"),
            { params: Promise.resolve({ id: "71" }) },
        );
        expect((await ownerResponse.json()).viewerRole).toBe("REQUESTER");

        mocks.requireLiffWorkforceSession.mockResolvedValueOnce({
            ...USER_AUTH,
            user: { ...USER_AUTH.user, id: 8 },
        });
        expect((await getDetail(
            request("/api/line/stock/requests/71"),
            { params: Promise.resolve({ id: "71" }) },
        )).status).toBe(404);

        mocks.requireLiffWorkforceSession.mockResolvedValueOnce(ADMIN_AUTH);
        const processorResponse = await getDetail(
            request("/api/line/stock/requests/71"),
            { params: Promise.resolve({ id: "71" }) },
        );
        const processorBody = await processorResponse.json();
        expect(processorBody.viewerRole).toBe("PROCESSOR");
        expect(processorBody.availableActions).toEqual(["ISSUE", "CANCEL"]);
    });

    it("creates with the authenticated actor and wakes outbox only for a new request", async () => {
        const response = await createRequest(request("/api/line/stock/requests", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Idempotency-Key": "stock-key-12345678",
                "X-Request-Id": "liff-stock-request",
            },
            body: JSON.stringify({
                requestedBy: 999,
                projectCode: "nhf-2569",
                items: [{ itemId: 10, variantId: 101, quantity: 2 }],
            }),
        }));
        const body = await response.json();

        expect(response.status).toBe(201);
        expect(mocks.createRequest).toHaveBeenCalledWith(
            expect.objectContaining({ projectCode: "NHF-2569" }),
            expect.objectContaining({
                id: 7,
                email: "employee@example.com",
                requestId: "liff-stock-request",
            }),
            { idempotencyKey: "stock-key-12345678" },
        );
        expect(mocks.enforcePreAuthIpRateLimit)
            .toHaveBeenCalledWith(expect.anything(), "stock-request-create");
        expect(mocks.enforceAuthenticatedMutationRateLimit)
            .toHaveBeenCalledWith("stock-request-create", 7);
        expect(mocks.processOutbox).toHaveBeenCalledTimes(1);
        expect(body.request).not.toHaveProperty("idempotencyKey");
        expect(body.request).not.toHaveProperty("requestHash");

        mocks.processOutbox.mockClear();
        mocks.createRequest.mockResolvedValueOnce({
            request: RAW_REQUEST,
            replayed: true,
        });
        const replayResponse = await createRequest(request(
            "/api/line/stock/requests",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Idempotency-Key": "stock-key-12345678",
                },
                body: JSON.stringify({
                    projectCode: "NHF-2569",
                    items: [{ itemId: 10, variantId: 101, quantity: 2 }],
                }),
            },
        ));
        expect(replayResponse.status).toBe(200);
        expect(mocks.processOutbox).not.toHaveBeenCalled();
    });

    it("rate limits before parsing and requires LIFF auth plus a valid idempotency key", async () => {
        mocks.enforcePreAuthIpRateLimit.mockReturnValueOnce(
            NextResponse.json({ error: "rate limited" }, { status: 429 }),
        );
        const limitedResponse = await createRequest(request(
            "/api/line/stock/requests",
            { method: "POST", body: "not-json" },
        ));
        expect(limitedResponse.status).toBe(429);
        expect(mocks.requireLiffWorkforceSession).not.toHaveBeenCalled();

        mocks.requireLiffWorkforceSession.mockResolvedValueOnce({
            ok: false,
            response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        });
        const unauthorizedResponse = await createRequest(request(
            "/api/line/stock/requests",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Idempotency-Key": "stock-key-12345678",
                },
                body: JSON.stringify({
                    projectCode: "NHF-2569",
                    items: [{ itemId: 10, variantId: 101, quantity: 2 }],
                }),
            },
        ));
        expect(unauthorizedResponse.status).toBe(401);
        expect(mocks.createRequest).not.toHaveBeenCalled();

        const missingKeyResponse = await createRequest(request(
            "/api/line/stock/requests",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    projectCode: "NHF-2569",
                    items: [{ itemId: 10, variantId: 101, quantity: 2 }],
                }),
            },
        ));
        expect(missingKeyResponse.status).toBe(400);
        expect(mocks.createRequest).not.toHaveBeenCalled();
    });

    it("rejects oversized Stock mutations before parsing or authorization", async () => {
        const response = await createRequest(request(
            "/api/line/stock/requests",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Content-Length": String(STOCK_JSON_MUTATION_MAX_BYTES + 1),
                },
                body: "{}",
            },
        ));

        expect(response.status).toBe(413);
        expect(mocks.requireLiffWorkforceSession).not.toHaveBeenCalled();
        expect(mocks.createRequest).not.toHaveBeenCalled();
    });

    it.each([
        ["missing", undefined],
        ["lying", "10"],
    ] as const)(
        "rejects an actually oversized Stock request with a %s Content-Length",
        async (_label, contentLength) => {
            const body = new ArrayBuffer(STOCK_JSON_MUTATION_MAX_BYTES + 1);
            const headers: Record<string, string> = {
                "Content-Type": "application/json",
            };
            if (contentLength) headers["Content-Length"] = contentLength;

            const response = await createRequest(request(
                "/api/line/stock/requests",
                {
                    method: "POST",
                    headers,
                    body,
                },
            ));

            expect(response.status).toBe(413);
            expect(mocks.createRequest).not.toHaveBeenCalled();
            expect(mocks.requireLiffWorkforceSession).not.toHaveBeenCalled();
        },
    );

    it.each(["cancel", "issue"] as const)(
        "rejects an actually oversized LIFF Stock %s body before its domain service",
        async (kind) => {
            if (kind === "issue") {
                mocks.requireLiffWorkforceSession.mockResolvedValueOnce(ADMIN_AUTH);
            }

            const invoke = kind === "cancel" ? cancelRequest : issueRequest;
            const response = await invoke(request(
                `/api/line/stock/requests/71/${kind}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: new ArrayBuffer(STOCK_JSON_MUTATION_MAX_BYTES + 1),
                },
            ), { params: Promise.resolve({ id: "71" }) });

            expect(response.status).toBe(413);
            expect(mocks.cancelRequest).not.toHaveBeenCalled();
            expect(mocks.issueRequest).not.toHaveBeenCalled();
        },
    );

    it("returns an idempotency conflict without waking the outbox", async () => {
        mocks.createRequest.mockRejectedValueOnce(
            new StockRequestIdempotencyConflictError(),
        );

        const response = await createRequest(request(
            "/api/line/stock/requests",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Idempotency-Key": "stock-key-12345678",
                },
                body: JSON.stringify({
                    projectCode: "NHF-2569",
                    items: [{ itemId: 10, variantId: 101, quantity: 2 }],
                }),
            },
        ));

        expect(response.status).toBe(409);
        expect(mocks.processOutbox).not.toHaveBeenCalled();
    });

    it("uses session authorization for employee cancellation and processor issue", async () => {
        const cancelResponse = await cancelRequest(request(
            "/api/line/stock/requests/71/cancel",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    cancelReason: "ไม่ใช้แล้ว",
                    isAdmin: true,
                }),
            },
        ), { params: Promise.resolve({ id: "71" }) });

        expect(cancelResponse.status).toBe(200);
        expect(mocks.cancelRequest).toHaveBeenCalledWith(
            71,
            expect.objectContaining({ id: 7 }),
            "ไม่ใช้แล้ว",
            { isAdmin: false },
        );

        const forgedIssueResponse = await issueRequest(request(
            "/api/line/stock/requests/71/issue",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ canProcessStockRequests: true }),
            },
        ), { params: Promise.resolve({ id: "71" }) });
        expect(forgedIssueResponse.status).toBe(403);
        expect(mocks.issueRequest).not.toHaveBeenCalled();

        mocks.requireLiffWorkforceSession.mockResolvedValueOnce(ADMIN_AUTH);
        const issueResponse = await issueRequest(request(
            "/api/line/stock/requests/71/issue",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            },
        ), { params: Promise.resolve({ id: "71" }) });
        expect(issueResponse.status).toBe(200);
        expect(mocks.issueRequest).toHaveBeenCalledWith(
            71,
            expect.objectContaining({ id: 1, email: "admin@example.com" }),
        );

        mocks.cancelRequest.mockClear();
        mocks.requireLiffWorkforceSession.mockResolvedValueOnce(ADMIN_AUTH);
        const processorCancelResponse = await cancelRequest(request(
            "/api/line/stock/requests/71/cancel",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cancelReason: "ไม่ดำเนินการ" }),
            },
        ), { params: Promise.resolve({ id: "71" }) });
        expect(processorCancelResponse.status).toBe(200);
        expect(mocks.cancelRequest).toHaveBeenCalledWith(
            71,
            expect.objectContaining({ id: 1 }),
            "ไม่ดำเนินการ",
            { isAdmin: true },
        );
    });

    it("rejects invalid query and request IDs before reaching Stock services", async () => {
        expect((await getItems(request("/api/line/stock/items?page=0"))).status)
            .toBe(400);
        expect((await getDetail(
            request("/api/line/stock/requests/not-a-number"),
            { params: Promise.resolve({ id: "not-a-number" }) },
        )).status).toBe(404);
    });
});
