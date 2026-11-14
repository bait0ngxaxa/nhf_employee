// @vitest-environment node
import { NextResponse } from "next/server";
import { describe, expect, it } from "vitest";
import { buildJsonBodyRequest } from "@/__tests__/helpers/request-body-limit";
import { readRoutineJsonBody } from "@/modules/routine";
import { readLeaveJsonBody } from "@/modules/leave";
import { readStockJsonBody } from "@/modules/stock";
import { readLineIdToken, LINE_AUTH_MAX_REQUEST_BYTES } from "@/modules/line";
import { parseITTicketCreateHttpInput, parseITTicketCommentHttpInput, IT_TICKET_ATTACHMENT_MAX_REQUEST_BYTES } from "@/modules/it";
import {
    REQUEST_BODY_INVALID_JSON_MESSAGE, REQUEST_BODY_TOO_LARGE_MESSAGE,
    ROUTINE_MAX_REQUEST_BYTES, LEAVE_JSON_MUTATION_MAX_BYTES, STOCK_JSON_MUTATION_MAX_BYTES,
    IT_TICKET_COMMENT_MAX_REQUEST_BYTES,
} from "@/lib/ssot/request-limits";

const readers = [
    { name: "routine", read: readRoutineJsonBody, max: ROUTINE_MAX_REQUEST_BYTES },
    { name: "leave", read: readLeaveJsonBody, max: LEAVE_JSON_MUTATION_MAX_BYTES },
    { name: "stock", read: readStockJsonBody, max: STOCK_JSON_MUTATION_MAX_BYTES },
    { name: "LINE ID token", read: readLineIdToken, max: LINE_AUTH_MAX_REQUEST_BYTES },
] as const;

describe("module JSON error contracts", () => {
    it.each(readers)("$name: canonical malformed 400, unchanged 413, valid JSON", async ({ read, max }) => {
        for (const body of ["{", ""]) {
            const result = await read(buildJsonBodyRequest("http://localhost/api/test", body));
            if (result.ok) throw new Error("Expected malformed JSON rejection");
            expect(result.response.status).toBe(400);
            await expect(result.response.json()).resolves.toEqual({ error: REQUEST_BODY_INVALID_JSON_MESSAGE });
        }
        const oversized = await read(buildJsonBodyRequest("http://localhost/api/test", " ".repeat(max + 1)));
        if (oversized.ok) throw new Error("Expected oversized rejection");
        expect(oversized.response.status).toBe(413);
        await expect(oversized.response.json()).resolves.toEqual({ error: REQUEST_BODY_TOO_LARGE_MESSAGE });
        const valid = await read(buildJsonBodyRequest("http://localhost/api/test", '{"idToken":"ไทย"}'));
        expect(valid).toEqual(read === readLineIdToken
            ? { ok: true, idToken: "ไทย" }
            : { ok: true, body: { idToken: "ไทย" } });
    });

    it.each([
        { name: "IT create", read: parseITTicketCreateHttpInput, max: IT_TICKET_ATTACHMENT_MAX_REQUEST_BYTES,
            valid: { type: "INCIDENT", title: "เปิดเครื่องไม่ได้", description: "เครื่องไม่ทำงาน" } },
        { name: "IT comment", read: parseITTicketCommentHttpInput, max: IT_TICKET_COMMENT_MAX_REQUEST_BYTES,
            valid: { body: "ตรวจสอบแล้ว" } },
    ])("$name: preserves the exact 400 envelope, 413 and valid input", async ({ read, max, valid }) => {
        for (const [body, status, error] of [
            ["{", 400, REQUEST_BODY_INVALID_JSON_MESSAGE],
            [" ".repeat(max + 1), 413, REQUEST_BODY_TOO_LARGE_MESSAGE],
        ] as const) {
            const response = await read(buildJsonBodyRequest("http://localhost/api/test", body), "json");
            if (!(response instanceof NextResponse)) throw new Error("Expected parse failure");
            expect(response.status).toBe(status);
            await expect(response.text()).resolves.toBe(JSON.stringify({ error, success: false }));
        }
        const parsed = await read(buildJsonBodyRequest("http://localhost/api/test", JSON.stringify(valid)), "json");
        expect(parsed).not.toBeInstanceOf(NextResponse);
        expect(parsed).toMatchObject({ attachments: [] });
    });
});
