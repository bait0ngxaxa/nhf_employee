import { afterEach, describe, expect, it, vi } from "vitest";

import { buildITLiffUrl, buildITTicketLiffUrl } from "@/modules/it";

describe("IT LIFF destinations", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("builds the canonical requester root URL", () => {
        vi.stubEnv("NEXT_PUBLIC_LINE_LIFF_ID", "nhfapp-liff-id");

        expect(buildITLiffUrl()).toBe("https://liff.line.me/nhfapp-liff-id/it");
    });

    it("builds the canonical requester Ticket detail URL", () => {
        vi.stubEnv("NEXT_PUBLIC_LINE_LIFF_ID", "nhfapp-liff-id");

        expect(buildITTicketLiffUrl(42)).toBe(
            "https://liff.line.me/nhfapp-liff-id/it/42",
        );
        expect(buildITTicketLiffUrl(2_147_483_647)).toBe(
            "https://liff.line.me/nhfapp-liff-id/it/2147483647",
        );
    });

    it.each([
        0,
        -1,
        1.5,
        Number.NaN,
        Number.POSITIVE_INFINITY,
        Number.MAX_SAFE_INTEGER + 1,
        2_147_483_648,
    ])("rejects invalid Ticket ID %s", (ticketId) => {
        vi.stubEnv("NEXT_PUBLIC_LINE_LIFF_ID", "nhfapp-liff-id");

        expect(() => buildITTicketLiffUrl(ticketId)).toThrow("Invalid IT Ticket ID");
    });
});
