import { afterEach, describe, expect, it, vi } from "vitest";

import { buildLiffUrl } from "@/lib/line/liff-links";
import {
    buildLeaveLiffRequestUrl,
    buildLeaveLiffUrl,
} from "@/lib/line/leave-links";
import {
    buildRoutineLiffTaskUrl,
    buildRoutineLiffUrl,
} from "@/modules/routine";
import {
    buildStockLiffRequestUrl,
    buildStockLiffUrl,
} from "@/modules/stock";
import { APP_ROUTES } from "@/lib/ssot/routes";

describe("LIFF URL builder", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("builds the configured LIFF origin and module paths", () => {
        vi.stubEnv("NEXT_PUBLIC_LINE_LIFF_ID", "nhfapp-liff-id");

        expect(buildLiffUrl()).toBe("https://liff.line.me/nhfapp-liff-id");
        expect(buildLiffUrl(APP_ROUTES.line.stock)).toBe(
            "https://liff.line.me/nhfapp-liff-id/stock",
        );
        expect(buildLiffUrl("/leave")).toBe(
            "https://liff.line.me/nhfapp-liff-id/leave",
        );
    });

    it("encodes query parameters and preserves Routine notification deep links", () => {
        vi.stubEnv("NEXT_PUBLIC_LINE_LIFF_ID", "nhfapp-liff-id");

        expect(
            buildLiffUrl(APP_ROUTES.line.stock, {
                search: "สายไฟและปลั๊ก",
                page: 2,
                includeInactive: false,
                omitted: undefined,
            }),
        ).toBe(
            "https://liff.line.me/nhfapp-liff-id/stock?search=%E0%B8%AA%E0%B8%B2%E0%B8%A2%E0%B9%84%E0%B8%9F%E0%B9%81%E0%B8%A5%E0%B8%B0%E0%B8%9B%E0%B8%A5%E0%B8%B1%E0%B9%8A%E0%B8%81&page=2&includeInactive=false",
        );
        expect(buildRoutineLiffUrl()).toBe(
            "https://liff.line.me/nhfapp-liff-id/routine",
        );
        expect(buildRoutineLiffTaskUrl(71, 91)).toBe(
            "https://liff.line.me/nhfapp-liff-id/routine?taskId=71&occurrenceId=91",
        );
        expect(buildLeaveLiffUrl()).toBe(
            "https://liff.line.me/nhfapp-liff-id/leave",
        );
        expect(buildLeaveLiffRequestUrl("leave_abc-123", { action: "approve" })).toBe(
            "https://liff.line.me/nhfapp-liff-id/leave?requestId=leave_abc-123&action=approve",
        );
        expect(buildStockLiffUrl()).toBe(
            "https://liff.line.me/nhfapp-liff-id/stock",
        );
        expect(buildStockLiffRequestUrl(123, { action: "issue" })).toBe(
            "https://liff.line.me/nhfapp-liff-id/stock?requestId=123&action=issue",
        );
    });

    it("rejects malformed Leave request IDs before building a deep link", () => {
        vi.stubEnv("NEXT_PUBLIC_LINE_LIFF_ID", "nhfapp-liff-id");

        expect(() => buildLeaveLiffRequestUrl("../private", { action: "approve" }))
            .toThrow("Invalid Leave request ID");
    });

    it("rejects malformed Stock request IDs before building a deep link", () => {
        vi.stubEnv("NEXT_PUBLIC_LINE_LIFF_ID", "nhfapp-liff-id");

        expect(() => buildStockLiffRequestUrl("../private", { action: "issue" }))
            .toThrow("Invalid Stock request ID");
    });

    it("rejects unsafe Routine IDs before building notification links", () => {
        vi.stubEnv("NEXT_PUBLIC_LINE_LIFF_ID", "nhfapp-liff-id");

        expect(() => buildRoutineLiffTaskUrl(Number.MAX_SAFE_INTEGER + 1, 91))
            .toThrow("Invalid Routine task ID");
        expect(() => buildRoutineLiffTaskUrl(71, Number.MAX_SAFE_INTEGER + 1))
            .toThrow("Invalid Routine occurrence ID");
    });

    it.each([
        "https://attacker.example/redirect",
        "//attacker.example/redirect",
        "/../attacker",
        "/routine?redirect=https://attacker.example",
        "/routine#external",
        "/routine\\escape",
    ])("rejects unsafe internal path %s", (unsafePath) => {
        vi.stubEnv("NEXT_PUBLIC_LINE_LIFF_ID", "nhfapp-liff-id");

        expect(() => buildLiffUrl(unsafePath)).toThrow(
            "Invalid internal LIFF path",
        );
    });
});
