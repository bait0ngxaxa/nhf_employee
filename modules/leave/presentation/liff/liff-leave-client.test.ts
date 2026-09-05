import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiGetMock, apiPostMock, apiPutMock } = vi.hoisted(() => ({
    apiGetMock: vi.fn(),
    apiPostMock: vi.fn(),
    apiPutMock: vi.fn(),
}));

vi.mock("@/lib/client/api-client", () => ({
    apiGet: apiGetMock,
    apiPost: apiPostMock,
    apiPut: apiPutMock,
}));

import {
    fetchLiffLeaveAttachment,
    fetchLiffLeaveProfile,
    submitLiffLeaveDecision,
    submitLiffLeaveRequest,
} from "./api";
import { LIFF_API_REQUEST_OPTIONS } from "@/lib/client/liff";
import { API_ROUTES } from "@/lib/ssot/routes";

const SUCCESS = {
    success: true as const,
    data: undefined,
    status: 200,
    requestId: "request-1",
};

describe("LIFF Leave client", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.unstubAllGlobals();
    });

    it("keeps history filtering server-side and disables normal auth refresh", async () => {
        apiGetMock.mockResolvedValueOnce({ ...SUCCESS, data: { history: [] } });

        await fetchLiffLeaveProfile({
            page: 3,
            filters: {
                query: "ประชุมลูกค้า",
                leaveType: "PERSONAL",
                status: "APPROVED",
                year: 2026,
            },
        });

        expect(apiGetMock).toHaveBeenCalledWith(
            `${API_ROUTES.line.leaveMe}?page=3&q=${encodeURIComponent("ประชุมลูกค้า")}&leaveType=PERSONAL&status=APPROVED&year=2026`,
            LIFF_API_REQUEST_OPTIONS,
        );
    });

    it("sends one caller-owned idempotency key with multipart attachments", async () => {
        apiPostMock.mockResolvedValueOnce(SUCCESS);
        const attachment = new File(["evidence"], "evidence.jpg", {
            type: "image/jpeg",
        });
        const payload = {
            leaveType: "SICK" as const,
            startDate: "2026-09-01",
            endDate: "2026-09-01",
            period: "FULL_DAY" as const,
            reason: "ไม่สบาย",
        };

        await submitLiffLeaveRequest(payload, [attachment], "leave-key-12345678");

        expect(apiPostMock).toHaveBeenCalledOnce();
        const [route, body, options] = apiPostMock.mock.calls[0] as [
            string,
            FormData,
            { headers: Record<string, string>; retryCount: number; skipAuthRefresh: boolean },
        ];
        expect(route).toBe(API_ROUTES.line.leaveRequest);
        expect(body.get("payload")).toBe(JSON.stringify(payload));
        expect(body.getAll("attachments")).toEqual([attachment]);
        expect(options).toEqual({
            ...LIFF_API_REQUEST_OPTIONS,
            headers: { "Idempotency-Key": "leave-key-12345678" },
        });
    });

    it("uses the LIFF decision adapter without dashboard refresh", async () => {
        apiPostMock.mockResolvedValueOnce(SUCCESS);

        await submitLiffLeaveDecision({
            leaveId: "leave-1",
            action: "REJECT",
            reason: "ข้อมูลไม่ครบ",
        });

        expect(apiPostMock).toHaveBeenCalledWith(
            API_ROUTES.line.leaveDecision,
            { leaveId: "leave-1", action: "REJECT", reason: "ข้อมูลไม่ครบ" },
            LIFF_API_REQUEST_OPTIONS,
        );
        expect(apiPutMock).not.toHaveBeenCalled();
    });

    it("reads private attachments with the LIFF cookie and no cache", async () => {
        const blob = new Blob(["image"], { type: "image/webp" });
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            blob: vi.fn().mockResolvedValue(blob),
        });
        vi.stubGlobal("fetch", fetchMock);

        await expect(fetchLiffLeaveAttachment("attachment-1")).resolves.toBe(blob);
        expect(fetchMock).toHaveBeenCalledWith(
            API_ROUTES.line.leaveAttachmentById("attachment-1"),
            { cache: "no-store", credentials: "include" },
        );
    });
});
