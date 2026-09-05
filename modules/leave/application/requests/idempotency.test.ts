import { describe, expect, it } from "vitest";

import {
    createLeaveRequestHash,
    isLeaveRequestIdempotencyConflict,
} from "./idempotency";

const PAYLOAD = {
    leaveType: "SICK",
    startDate: "2031-05-05",
    endDate: "2031-05-05",
    period: "FULL_DAY",
    reason: "พักรักษาตัวตามคำแนะนำแพทย์",
} as const;

describe("leave request idempotency", () => {
    it("creates the same hash for the same payload", () => {
        expect(createLeaveRequestHash(PAYLOAD)).toBe(
            createLeaveRequestHash({ ...PAYLOAD }),
        );
    });

    it("changes the hash when the leave payload changes", () => {
        expect(createLeaveRequestHash(PAYLOAD)).not.toBe(
            createLeaveRequestHash({ ...PAYLOAD, leaveType: "PERSONAL" }),
        );
    });

    const attachment = {
        storageKey: "leave/request-1/file.webp",
        originalName: "proof.jpg",
        contentType: "image/webp" as const,
        contentSha256: "a".repeat(64),
        sizeBytes: 512,
        width: 32,
        height: 24,
    };

    it("changes the request hash when attachment content changes", () => {
        expect(createLeaveRequestHash(PAYLOAD, [attachment])).not.toBe(
            createLeaveRequestHash(PAYLOAD, [{
                ...attachment,
                contentSha256: "b".repeat(64),
            }]),
        );
    });

    it("keeps the request hash stable for the same attachment content", () => {
        expect(createLeaveRequestHash(PAYLOAD, [attachment])).toBe(
            createLeaveRequestHash(PAYLOAD, [{ ...attachment }]),
        );
    });

    it("does not include the storage key in the request hash", () => {
        expect(createLeaveRequestHash(PAYLOAD, [attachment])).toBe(
            createLeaveRequestHash(PAYLOAD, [{
                ...attachment,
                storageKey: "leave/request-2/another-file.webp",
            }]),
        );
    });

    it("includes attachments in the request hash", () => {
        expect(createLeaveRequestHash(PAYLOAD)).not.toBe(
            createLeaveRequestHash(PAYLOAD, [attachment]),
        );
    });

    it("only treats the leave idempotency unique key as an idempotency conflict", () => {
        expect(isLeaveRequestIdempotencyConflict({
            code: "P2002",
            meta: {
                modelName: "LeaveRequestIdempotency",
                target: ["userId", "idempotencyKey"],
            },
        })).toBe(true);
        expect(isLeaveRequestIdempotencyConflict({
            code: "P2002",
            meta: {
                modelName: "LeaveQuota",
                target: ["employeeId", "year", "leaveType"],
            },
        })).toBe(false);
        expect(isLeaveRequestIdempotencyConflict({ code: "P2002" })).toBe(false);
    });
});
