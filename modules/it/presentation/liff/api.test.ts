import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UnauthorizedRecoveryHandler } from "@/lib/client/api-client";

const { apiGetMock, apiPostMock } = vi.hoisted(() => ({
    apiGetMock: vi.fn(),
    apiPostMock: vi.fn(),
}));

vi.mock("@/lib/client/api-client", () => ({
    apiGet: apiGetMock,
    apiPost: apiPostMock,
}));

import {
    fetchLiffITAttachment,
    fetchLiffITTickets,
    createLiffITTicket,
    postLiffITTicketComment,
} from "./api";
import {
    LiffApiError,
    registerLiffSessionRecovery,
} from "@/modules/line/client";
import { API_ROUTES } from "@/lib/ssot/routes";

function success(data: unknown) {
    return { success: true as const, data, status: 200, requestId: "test-request" };
}

function failure(
    status: number,
    unauthorizedRecovery?: { readonly recovered: boolean; readonly replayed: boolean },
) {
    return {
        success: false as const,
        error: "internal message",
        errorThai: "internal message",
        code: "UNKNOWN_ERROR" as const,
        status,
        ...(unauthorizedRecovery ? { unauthorizedRecovery } : {}),
    };
}

function getUnauthorizedHandler(config: unknown): UnauthorizedRecoveryHandler {
    if (typeof config !== "object" || config === null || !("onUnauthorized" in config)) {
        throw new Error("Expected LIFF unauthorized recovery handler");
    }
    const handler = config.onUnauthorized;
    if (typeof handler !== "function") {
        throw new Error("Expected LIFF unauthorized recovery handler");
    }
    return handler as UnauthorizedRecoveryHandler;
}

describe("IT requester LIFF API adapter", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("uses the requester route, existing page contract, and shared safe-read recovery", async () => {
        apiGetMock.mockResolvedValueOnce(success({
            success: true,
            tickets: [],
            pagination: { page: 2, limit: 10, total: 11, totalPages: 2 },
        }));

        await expect(fetchLiffITTickets(2)).resolves.toMatchObject({
            tickets: [],
            pagination: { page: 2, totalPages: 2 },
        });
        expect(apiGetMock).toHaveBeenCalledWith(
            `${API_ROUTES.line.itTickets}?page=2&limit=10`,
            expect.objectContaining({ retryCount: 0, skipAuthRefresh: true }),
        );
        const config: unknown = apiGetMock.mock.calls[0]?.[1];
        const handler = getUnauthorizedHandler(config);
        const unregister = registerLiffSessionRecovery(async () => true, vi.fn());
        await expect(handler({ endpoint: API_ROUTES.line.itTickets, method: "GET", response: new Response(null, { status: 401 }) }))
            .resolves.toEqual({ recovered: true, replay: true });
        unregister();
    });

    it("keeps a recovered Ticket creation mutation from automatic replay", async () => {
        apiPostMock.mockResolvedValueOnce(failure(401, { recovered: true, replayed: false }));
        const unregister = registerLiffSessionRecovery(async () => true, vi.fn());

        await expect(createLiffITTicket({
            type: "INCIDENT",
            title: "เข้าใช้งานระบบไม่ได้",
            description: "หน้าจอไม่แสดงข้อมูล",
        }, "create-key")).rejects.toMatchObject({
            name: "LiffApiError",
            status: 401,
            message: "เชื่อมต่อกับ LINE ใหม่เรียบร้อยแล้ว กรุณาตรวจสอบสถานะล่าสุดก่อนลองดำเนินการอีกครั้ง",
        });
        expect(apiPostMock).toHaveBeenCalledTimes(1);
        expect(apiPostMock).toHaveBeenCalledWith(
            API_ROUTES.line.itTickets,
            expect.objectContaining({ type: "INCIDENT" }),
            expect.objectContaining({
                retryCount: 0,
                skipAuthRefresh: true,
                headers: { "Idempotency-Key": "create-key" },
            }),
        );
        const config: unknown = apiPostMock.mock.calls[0]?.[2];
        const handler = getUnauthorizedHandler(config);
        await expect(handler({ endpoint: API_ROUTES.line.itTickets, method: "POST", response: new Response(null, { status: 401 }) }))
            .resolves.toEqual({ recovered: true, replay: false });
        unregister();
    });

    it("maps authorization, hidden resources, conflicts, size limits, rate limits, and service errors safely", async () => {
        const cases = [
            [403, "บัญชีนี้ยังไม่มีสิทธิ์ดูรายการ Ticket"],
            [404, "ไม่พบ Ticket หรือคุณไม่มีสิทธิ์ดูรายการนี้"],
            [409, "Ticket มีการเปลี่ยนแปลง กรุณาตรวจสอบสถานะล่าสุดก่อนลองอีกครั้ง"],
            [413, "ข้อความหรือรูปภาพมีขนาดใหญ่เกินไป กรุณาลดขนาดแล้วลองอีกครั้ง"],
            [429, "ส่งคำขอบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่"],
            [503, "ระบบ Ticket ขัดข้องชั่วคราว กรุณาลองอีกครั้ง"],
        ] as const;

        for (const [status, message] of cases) {
            apiGetMock.mockResolvedValueOnce(failure(status));
            await expect(fetchLiffITTickets(1)).rejects.toMatchObject({
                name: "LiffApiError",
                status,
                message,
            });
        }
        expect(apiGetMock).toHaveBeenCalledTimes(cases.length);
    });

    it("sends comment evidence with the caller's stable idempotency key", async () => {
        apiPostMock.mockResolvedValueOnce(success({
            success: true,
            replayed: false,
            comment: {
                type: "COMMENT",
                id: "comment-a",
                createdAt: "2026-09-26T03:00:00.000Z",
                authorDisplayName: "ผู้แจ้ง",
                authorSide: "REQUESTER",
                body: "ยังพบปัญหา",
                attachments: [],
            },
        }));

        await expect(postLiffITTicketComment(42, "ยังพบปัญหา", [], "comment-key"))
            .resolves.toMatchObject({ replayed: false, comment: { authorSide: "REQUESTER" } });
        expect(apiPostMock).toHaveBeenCalledWith(
            API_ROUTES.line.itTicketCommentsById(42),
            { body: "ยังพบปัญหา" },
            expect.objectContaining({ headers: { "Idempotency-Key": "comment-key" } }),
        );
    });

    it("loads private evidence through the authenticated no-store LIFF route and retries safe reads after recovery", async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response(null, { status: 401 }))
            .mockResolvedValueOnce(new Response(new Blob(["image"], { type: "image/webp" }), {
                status: 200,
                headers: { "Content-Type": "image/webp" },
            }));
        vi.stubGlobal("fetch", fetchMock);
        const unregister = registerLiffSessionRecovery(async () => true, vi.fn());

        const blob = await fetchLiffITAttachment("attachment-id");
        expect(blob.type).toBe("image/webp");
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock).toHaveBeenNthCalledWith(
            1,
            API_ROUTES.line.itAttachmentById("attachment-id"),
            expect.objectContaining({ cache: "no-store", credentials: "include" }),
        );
        expect(fetchMock).toHaveBeenNthCalledWith(
            2,
            API_ROUTES.line.itAttachmentById("attachment-id"),
            expect.objectContaining({ cache: "no-store", credentials: "include" }),
        );
        unregister();
        vi.unstubAllGlobals();
    });

    it("hides private attachment 404 details and rejects unexpected media types", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response("storage path /private/key", { status: 404 })));
        await expect(fetchLiffITAttachment("hidden-id")).rejects.toMatchObject({
            name: "LiffApiError",
            status: 404,
            message: "ไม่พบรูปภาพนี้หรือคุณไม่มีสิทธิ์ดูรูปภาพ",
        });
        vi.unstubAllGlobals();

        vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(new Blob(["text"], { type: "text/plain" }), {
            status: 200,
            headers: { "Content-Type": "text/plain" },
        })));
        await expect(fetchLiffITAttachment("unexpected-media"))
            .rejects.toBeInstanceOf(LiffApiError);
        vi.unstubAllGlobals();
    });
});
