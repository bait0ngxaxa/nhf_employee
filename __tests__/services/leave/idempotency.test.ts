import { describe, expect, it } from "vitest";

import {
    createLeaveRequestHash,
} from "@/lib/services/leave/idempotency";

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

    it("includes attachment metadata in the request hash", () => {
        const attachment = {
            storageKey: "leave/request-1/file.webp",
            originalName: "proof.jpg",
            contentType: "image/webp" as const,
            sizeBytes: 512,
            width: 32,
            height: 24,
        };

        expect(createLeaveRequestHash(PAYLOAD)).not.toBe(
            createLeaveRequestHash(PAYLOAD, [attachment]),
        );
    });
});
