// @vitest-environment node

import { describe, expect, it } from "vitest";

import { parseLeaveRequestInput } from "@/lib/services/leave/request-input";
import type { LeaveRequestInputError } from "@/lib/services/leave/request-input";
import { LEAVE_ATTACHMENT_MAX_REQUEST_BYTES } from "@/lib/ssot/leave-attachments";

const VALID_PAYLOAD = {
    leaveType: "PERSONAL",
    startDate: "2030-05-10",
    endDate: "2030-05-10",
    period: "FULL_DAY",
    reason: "ไปทำธุระส่วนตัว",
} as const;

function createMultipartRequest(files: readonly File[] = []): Request {
    const formData = new FormData();
    formData.set("payload", JSON.stringify(VALID_PAYLOAD));
    for (const file of files) {
        formData.append("attachments", file);
    }
    return new Request("http://localhost/api/leave/request", {
        method: "POST",
        body: formData,
    });
}

describe("parseLeaveRequestInput", () => {
    it("parses a legacy JSON request without attachments", async () => {
        const request = new Request("http://localhost/api/leave/request", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(VALID_PAYLOAD),
        });

        await expect(parseLeaveRequestInput(request)).resolves.toEqual({
            payload: VALID_PAYLOAD,
            attachments: [],
        });
    });

    it("parses a multipart request without attachments", async () => {
        const result = await parseLeaveRequestInput(createMultipartRequest());

        expect(result).toEqual({
            payload: VALID_PAYLOAD,
            attachments: [],
        });
    });

    it("preserves repeated multipart attachment fields", async () => {
        const files = [
            new File(["first"], "first.jpg", { type: "image/jpeg" }),
            new File(["second"], "second.png", { type: "image/png" }),
        ];

        const result = await parseLeaveRequestInput(createMultipartRequest(files));

        expect(result.attachments).toHaveLength(2);
        expect(result.attachments.map((file) => file.name)).toEqual([
            "first.jpg",
            "second.png",
        ]);
    });

    it("rejects a malformed structured payload through the shared schema", async () => {
        const request = new Request("http://localhost/api/leave/request", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...VALID_PAYLOAD, leaveType: "INVALID" }),
        });

        await expect(parseLeaveRequestInput(request)).rejects.toMatchObject({
            statusCode: 400,
            message: "Invalid input",
        } satisfies Partial<LeaveRequestInputError>);
    });

    it("rejects malformed multipart payload JSON", async () => {
        const formData = new FormData();
        formData.set("payload", "{invalid");
        const request = new Request("http://localhost/api/leave/request", {
            method: "POST",
            body: formData,
        });

        await expect(parseLeaveRequestInput(request)).rejects.toMatchObject({
            statusCode: 400,
            message: "Invalid input",
        });
    });

    it("rejects a string attachment field", async () => {
        const formData = new FormData();
        formData.set("payload", JSON.stringify(VALID_PAYLOAD));
        formData.set("attachments", "not-a-file");
        const request = new Request("http://localhost/api/leave/request", {
            method: "POST",
            body: formData,
        });

        await expect(parseLeaveRequestInput(request)).rejects.toMatchObject({
            statusCode: 400,
            message: "ไฟล์แนบไม่ถูกต้อง",
        });
    });

    it("rejects an unsupported content type", async () => {
        const request = new Request("http://localhost/api/leave/request", {
            method: "POST",
            headers: { "Content-Type": "application/xml" },
            body: "<leave />",
        });

        await expect(parseLeaveRequestInput(request)).rejects.toMatchObject({
            statusCode: 415,
            message: "Content-Type ไม่รองรับ",
        });
    });

    it("rejects a declared multipart body above the request limit before buffering it", async () => {
        const request = new Request("http://localhost/api/leave/request", {
            method: "POST",
            headers: {
                "Content-Type": "multipart/form-data; boundary=test",
                "Content-Length": String(LEAVE_ATTACHMENT_MAX_REQUEST_BYTES + 1),
            },
        });

        await expect(parseLeaveRequestInput(request)).rejects.toMatchObject({
            statusCode: 413,
            message: "คำขอมีขนาดใหญ่เกินไป",
        });
    });

    it("returns a safe validation error when multipart parsing fails", async () => {
        const request = {
            headers: new Headers({ "Content-Type": "multipart/form-data" }),
            formData: async (): Promise<FormData> => {
                throw new Error("multipart parser failed");
            },
        } as unknown as Request;

        await expect(parseLeaveRequestInput(request)).rejects.toMatchObject({
            statusCode: 400,
            message: "Invalid input",
        });
    });
});
