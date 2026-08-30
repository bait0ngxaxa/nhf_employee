import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    buildNhfRichMenuDefinition,
    getNhfRichMenuImagePath,
    provisionNhfRichMenu,
    validateNhfRichMenuDefinition,
    validateNhfRichMenuImage,
} from "@/lib/line/rich-menu";

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

function emptyResponse(status = 200): Response {
    return new Response(null, { status });
}

describe("NHFapp Rich Menu definition", () => {
    beforeEach(() => {
        vi.stubEnv("NEXT_PUBLIC_LINE_LIFF_ID", "nhfapp-liff-id");
        vi.stubEnv("LINE_APP_CHANNEL_ACCESS_TOKEN", "nhfapp-token");
        vi.stubEnv("NEXT_PUBLIC_FEATURE_LEAVE", "true");
        vi.stubEnv("NEXT_PUBLIC_FEATURE_ROUTINE", "true");
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("creates three bounded tappable areas for the shared LIFF app", () => {
        const definition = buildNhfRichMenuDefinition();

        expect(definition).toMatchObject({
            size: { width: 2500, height: 843 },
            name: "NHFapp",
            chatBarText: "เลือกบริการ",
        });
        expect(definition.areas).toHaveLength(3);
        expect(definition.areas.map((area) => area.action.uri)).toEqual([
            "https://liff.line.me/nhfapp-liff-id/stock",
            "https://liff.line.me/nhfapp-liff-id/leave",
            "https://liff.line.me/nhfapp-liff-id/routine",
        ]);
        expect(definition.areas.map((area) => area.bounds)).toEqual([
            { x: 0, y: 0, width: 833, height: 843 },
            { x: 833, y: 0, width: 833, height: 843 },
            { x: 1666, y: 0, width: 834, height: 843 },
        ]);
        validateNhfRichMenuDefinition(definition);
    });

    it("rejects a destination that is not a LIFF URL", () => {
        expect(() =>
            buildNhfRichMenuDefinition({
                stock: "https://attacker.example/redirect",
            }),
        ).toThrow("LIFF URL");
    });

    it("validates the generated image dimensions and provider size limit", async () => {
        const image = await validateNhfRichMenuImage(getNhfRichMenuImagePath());

        expect(image).toMatchObject({
            format: "png",
            contentType: "image/png",
            width: 2500,
            height: 843,
        });
        expect(image.bytes).toBeLessThanOrEqual(1_000_000);
    });
});

describe("NHFapp Rich Menu provisioning", () => {
    const fetchMock = vi.fn<typeof fetch>();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv("NEXT_PUBLIC_LINE_LIFF_ID", "nhfapp-liff-id");
        vi.stubEnv("LINE_APP_CHANNEL_ACCESS_TOKEN", "nhfapp-token");
        vi.stubEnv("NEXT_PUBLIC_FEATURE_LEAVE", "true");
        vi.stubEnv("NEXT_PUBLIC_FEATURE_ROUTINE", "true");
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("does not call LINE during a unified dry-run", async () => {
        const result = await provisionNhfRichMenu({
            apply: false,
            fetchImpl: fetchMock,
        });

        expect(result.mode).toBe("dry-run");
        expect(result.liffUrls).toEqual({
            stock: "https://liff.line.me/nhfapp-liff-id/stock",
            leave: "https://liff.line.me/nhfapp-liff-id/leave",
            routine: "https://liff.line.me/nhfapp-liff-id/routine",
        });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("keeps disabled Leave safe in the plan while requiring Routine for apply", async () => {
        vi.stubEnv("NEXT_PUBLIC_FEATURE_LEAVE", "false");

        const dryRun = await provisionNhfRichMenu({
            apply: false,
            fetchImpl: fetchMock,
        });
        expect(dryRun.modules.leave).toEqual({
            enabled: false,
            status: "unavailable",
        });

        vi.stubEnv("NEXT_PUBLIC_FEATURE_ROUTINE", "false");
        await expect(
            provisionNhfRichMenu({ apply: true, fetchImpl: fetchMock }),
        ).rejects.toMatchObject({
            phase: "configuration",
            message: expect.stringContaining("Routine feature is disabled"),
        });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("validates, creates, uploads, sets, and verifies the unified menu", async () => {
        fetchMock
            .mockResolvedValueOnce(emptyResponse())
            .mockResolvedValueOnce(jsonResponse({ richMenuId: "richmenu-test" }))
            .mockResolvedValueOnce(emptyResponse())
            .mockResolvedValueOnce(emptyResponse())
            .mockResolvedValueOnce(jsonResponse({ richMenuId: "richmenu-test" }));

        const result = await provisionNhfRichMenu({
            apply: true,
            fetchImpl: fetchMock,
        });

        expect(result).toMatchObject({
            mode: "applied",
            richMenuId: "richmenu-test",
            verifiedDefaultRichMenuId: "richmenu-test",
        });
        expect(fetchMock).toHaveBeenCalledTimes(5);
        const definitionBody = JSON.parse(
            String(fetchMock.mock.calls[0]?.[1]?.body),
        ) as { areas: Array<{ action: { uri: string } }> };
        expect(definitionBody.areas.map((area) => area.action.uri)).toEqual([
            "https://liff.line.me/nhfapp-liff-id/stock",
            "https://liff.line.me/nhfapp-liff-id/leave",
            "https://liff.line.me/nhfapp-liff-id/routine",
        ]);
    });
});
