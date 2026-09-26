import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import {
    getITTicketCreateMediaType,
    isITTicketCreateParseFailure,
    parseITTicketCreateHttpInput,
} from "./ticket-create-request";

const ticketFields = {
    type: "INCIDENT",
    title: "เปิดใช้เครื่องพิมพ์ไม่ได้",
    description: "แนบภาพหน้าจอประกอบ",
};

function request(body: BodyInit, contentType?: string): NextRequest {
    return new NextRequest("http://localhost/api/it/tickets", {
        method: "POST",
        ...(contentType ? { headers: { "Content-Type": contentType } } : {}),
        body,
    });
}

describe("IT Ticket creation request parsing", () => {
    it("keeps JSON creation compatible", async () => {
        const parsed = await parseITTicketCreateHttpInput(
            request(JSON.stringify(ticketFields), "application/json"),
            "json",
        );

        expect(isITTicketCreateParseFailure(parsed)).toBe(false);
        if (isITTicketCreateParseFailure(parsed)) return;
        expect(parsed.input).toEqual(ticketFields);
        expect(parsed.attachments).toEqual([]);
    });

    it("accepts multipart creation with no files", async () => {
        const formData = new FormData();
        for (const [key, value] of Object.entries(ticketFields)) formData.set(key, value);

        const parsed = await parseITTicketCreateHttpInput(
            request(formData),
            "multipart",
        );

        expect(isITTicketCreateParseFailure(parsed)).toBe(false);
        if (isITTicketCreateParseFailure(parsed)) return;
        expect(parsed.input).toEqual(ticketFields);
        expect(parsed.attachments).toEqual([]);
    });

    it("accepts repeated multipart image fields", async () => {
        const formData = new FormData();
        for (const [key, value] of Object.entries(ticketFields)) formData.set(key, value);
        formData.append("attachments", new File([new Uint8Array([1, 2])], "ภาพ.png", {
            type: "image/png",
        }));
        formData.append("attachments", new File([new Uint8Array([3, 4])], "capture.webp", {
            type: "image/webp",
        }));

        const parsed = await parseITTicketCreateHttpInput(
            request(formData),
            "multipart",
        );

        expect(isITTicketCreateParseFailure(parsed)).toBe(false);
        if (isITTicketCreateParseFailure(parsed)) return;
        expect(parsed.attachments.map(({ name, type }) => ({ name, type }))).toEqual([
            { name: "ภาพ.png", type: "image/png" },
            { name: "capture.webp", type: "image/webp" },
        ]);
    });

    it("returns 415 for an explicitly unsupported content type", () => {
        const unsupported = request("{}", "text/plain");
        expect(getITTicketCreateMediaType(unsupported)).toBe("unsupported");
    });

    it("rejects duplicate or unknown multipart fields", async () => {
        const formData = new FormData();
        for (const [key, value] of Object.entries(ticketFields)) formData.set(key, value);
        formData.append("title", "หัวข้อซ้ำ");

        const parsed = await parseITTicketCreateHttpInput(
            request(formData),
            "multipart",
        );

        expect(isITTicketCreateParseFailure(parsed)).toBe(true);
        if (isITTicketCreateParseFailure(parsed)) expect(parsed.status).toBe(400);
    });
});
