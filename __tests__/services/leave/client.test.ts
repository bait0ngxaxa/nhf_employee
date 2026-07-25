import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiPost } from "@/lib/client/api-client";
import { submitLeaveRequest } from "@/lib/services/leave/client";
import { API_ROUTES } from "@/lib/ssot/routes";
import type { LeaveRequestValues } from "@/lib/validations/leave";

vi.mock("@/lib/client/api-client", () => ({
    apiGet: vi.fn(),
    apiPost: vi.fn(),
    apiPut: vi.fn(),
}));

const PAYLOAD: LeaveRequestValues = {
    leaveType: "SICK",
    startDate: "2031-05-05",
    endDate: "2031-05-05",
    period: "FULL_DAY",
    reason: "พักรักษาตัวตามคำแนะนำแพทย์",
};

describe("submitLeaveRequest", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(apiPost).mockResolvedValue({
            success: true,
            data: {},
            status: 201,
            requestId: "request-1",
        });
    });

    it("submits multipart payload without attachments", async () => {
        await submitLeaveRequest(PAYLOAD, []);

        const [endpoint, data] = vi.mocked(apiPost).mock.calls[0] ?? [];
        expect(endpoint).toBe(API_ROUTES.leave.request);
        expect(data).toBeInstanceOf(FormData);

        const formData = data as FormData;
        expect(formData.get("payload")).toBe(JSON.stringify(PAYLOAD));
        expect(formData.getAll("attachments")).toEqual([]);
    });

    it("appends every attachment to the same multipart request", async () => {
        const files = [
            new File(["first"], "ใบรับรองแพทย์.jpg", { type: "image/jpeg" }),
            new File(["second"], "หลักฐาน.png", { type: "image/png" }),
        ];

        await submitLeaveRequest(PAYLOAD, files);

        const data = vi.mocked(apiPost).mock.calls[0]?.[1];
        expect(data).toBeInstanceOf(FormData);

        const formData = data as FormData;
        expect(formData.get("payload")).toBe(JSON.stringify(PAYLOAD));
        expect(formData.getAll("attachments")).toEqual(files);
    });
});
