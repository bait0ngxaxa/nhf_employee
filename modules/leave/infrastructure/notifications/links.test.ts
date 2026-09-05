import { afterEach, describe, expect, it, vi } from "vitest";

import { buildLeaveLiffRequestUrl, buildLeaveLiffUrl } from "./links";

describe("Leave LIFF URL builder", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("preserves Leave notification deep links", () => {
        vi.stubEnv("NEXT_PUBLIC_LINE_LIFF_ID", "nhfapp-liff-id");

        expect(buildLeaveLiffUrl()).toBe(
            "https://liff.line.me/nhfapp-liff-id/leave",
        );
        expect(buildLeaveLiffRequestUrl("leave_abc-123", { action: "approve" })).toBe(
            "https://liff.line.me/nhfapp-liff-id/leave?requestId=leave_abc-123&action=approve",
        );
    });

    it("rejects malformed Leave request IDs before building a deep link", () => {
        vi.stubEnv("NEXT_PUBLIC_LINE_LIFF_ID", "nhfapp-liff-id");

        expect(() => buildLeaveLiffRequestUrl("../private", { action: "approve" }))
            .toThrow("Invalid Leave request ID");
    });
});
