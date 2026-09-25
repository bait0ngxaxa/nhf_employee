// @vitest-environment node
import { webcrypto } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import {
    createITTicketCommentAttemptSignature,
    validateITTicketAttachmentSelection,
} from "./ticket-attachment-client";

function image(name: string, bytes: string, type = "image/png"): File {
    return new File([bytes], name, { type });
}

describe("IT Ticket attachment composer client rules", () => {
    it("mirrors format, count, per-file, and total-size limits", () => {
        expect(validateITTicketAttachmentSelection([], [image("proof.pdf", "x", "application/pdf")]))
            .toContain("JPG, PNG และ WEBP");
        expect(validateITTicketAttachmentSelection([], [image("proof.jpg", "x")]))
            .toContain("JPG, PNG และ WEBP");
        expect(validateITTicketAttachmentSelection(
            [image("1.png", "x"), image("2.png", "x"), image("3.png", "x")],
            [image("4.png", "x")],
        )).toContain("สูงสุด 3");
        expect(validateITTicketAttachmentSelection([], [
            new File([new Uint8Array(8 * 1024 * 1024 + 1)], "large.png", { type: "image/png" }),
        ])).toContain("8 MiB");
        expect(validateITTicketAttachmentSelection([], [
            new File([new Uint8Array(7 * 1024 * 1024)], "1.png", { type: "image/png" }),
            new File([new Uint8Array(7 * 1024 * 1024)], "2.png", { type: "image/png" }),
            new File([new Uint8Array(7 * 1024 * 1024)], "3.png", { type: "image/png" }),
        ])).toContain("20 MiB");
        expect(validateITTicketAttachmentSelection([], [image("valid.png", "pixels")])).toBeNull();
    });

    it("starts a different attempt for changed content, filename, or visible order", async () => {
        vi.stubGlobal("crypto", webcrypto);
        const first = image("ภาพ.png", "first");
        const same = image("ภาพ.png", "first");
        const changedContent = image("ภาพ.png", "other");
        const renamed = image("ชื่อใหม่.png", "first");
        const other = image("another.png", "other");

        const firstSignature = await createITTicketCommentAttemptSignature(
            19, false, "ข้อความ", [first, other],
        );
        expect(await createITTicketCommentAttemptSignature(
            19, false, "ข้อความ", [same, other],
        )).toBe(firstSignature);
        expect(await createITTicketCommentAttemptSignature(
            19, false, "ข้อความ", [changedContent, other],
        )).not.toBe(firstSignature);
        expect(await createITTicketCommentAttemptSignature(
            19, false, "ข้อความ", [renamed, other],
        )).not.toBe(firstSignature);
        expect(await createITTicketCommentAttemptSignature(
            19, false, "ข้อความ", [other, first],
        )).not.toBe(firstSignature);
        expect(await createITTicketCommentAttemptSignature(
            19, true, "ข้อความ", [first, other],
        )).not.toBe(firstSignature);
    });
});
