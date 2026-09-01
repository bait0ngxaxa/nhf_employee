import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    buildNhfRichMenuDefinition,
    getNhfRichMenuImagePath,
    provisionNhfRichMenu,
    setNhfRichMenuDefault,
    validateNhfRichMenuDefinition,
    validateNhfRichMenuImage,
} from "@/lib/line/rich-menu";
import { runNhfRichMenuCli } from "../../scripts/line-rich-menu";

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

    it("allows unified Rich Menu apply when Leave is disabled", async () => {
        vi.stubEnv("NEXT_PUBLIC_FEATURE_LEAVE", "false");

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

        expect(result.modules.leave).toEqual({
            enabled: false,
            status: "unavailable",
        });
        expect(result.definition.areas).toHaveLength(3);
        expect(fetchMock).toHaveBeenCalledTimes(5);
    });

    it("allows unified Rich Menu apply when Routine is disabled", async () => {
        vi.stubEnv("NEXT_PUBLIC_FEATURE_ROUTINE", "false");

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

        expect(result.modules.routine).toEqual({
            enabled: false,
            status: "unavailable",
        });
        expect(result.definition.areas).toHaveLength(3);
        expect(fetchMock).toHaveBeenCalledTimes(5);
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

    it("classifies unified provisioning create failures", async () => {
        fetchMock
            .mockResolvedValueOnce(emptyResponse())
            .mockResolvedValueOnce(jsonResponse({ message: "create failed" }, 400));

        await expect(
            provisionNhfRichMenu({ apply: true, fetchImpl: fetchMock }),
        ).rejects.toMatchObject({ phase: "create", statusCode: 400 });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("preserves the created target when unified provisioning upload fails", async () => {
        fetchMock
            .mockResolvedValueOnce(emptyResponse())
            .mockResolvedValueOnce(jsonResponse({ richMenuId: "richmenu-created" }))
            .mockResolvedValueOnce(jsonResponse({ message: "upload failed" }, 500));

        await expect(
            provisionNhfRichMenu({ apply: true, fetchImpl: fetchMock }),
        ).rejects.toMatchObject({
            phase: "upload",
            statusCode: 500,
            richMenuId: "richmenu-created",
        });
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it("classifies unified provisioning set-default failures", async () => {
        fetchMock
            .mockResolvedValueOnce(emptyResponse())
            .mockResolvedValueOnce(jsonResponse({ richMenuId: "richmenu-created" }))
            .mockResolvedValueOnce(emptyResponse())
            .mockResolvedValueOnce(jsonResponse({ message: "set failed" }, 500));

        await expect(
            provisionNhfRichMenu({ apply: true, fetchImpl: fetchMock }),
        ).rejects.toMatchObject({
            phase: "set-default",
            statusCode: 500,
            richMenuId: "richmenu-created",
        });
        expect(fetchMock).toHaveBeenCalledTimes(4);
    });

    it("classifies unified provisioning verification failures", async () => {
        fetchMock
            .mockResolvedValueOnce(emptyResponse())
            .mockResolvedValueOnce(jsonResponse({ richMenuId: "richmenu-created" }))
            .mockResolvedValueOnce(emptyResponse())
            .mockResolvedValueOnce(emptyResponse())
            .mockResolvedValueOnce(jsonResponse({ richMenuId: "richmenu-other" }));

        await expect(
            provisionNhfRichMenu({ apply: true, fetchImpl: fetchMock }),
        ).rejects.toMatchObject({
            phase: "verify",
            richMenuId: "richmenu-created",
        });
        expect(fetchMock).toHaveBeenCalledTimes(5);
    });

    it("keeps set-default dry-run free of LINE mutation requests", async () => {
        const result = await setNhfRichMenuDefault({
            richMenuId: "richmenu-previous",
            apply: false,
            fetchImpl: fetchMock,
        });

        expect(result).toEqual({
            mode: "dry-run",
            richMenuId: "richmenu-previous",
        });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("validates the target ID before a set-default request", async () => {
        await expect(
            setNhfRichMenuDefault({
                richMenuId: "richmenu/../previous",
                apply: true,
                fetchImpl: fetchMock,
            }),
        ).rejects.toMatchObject({ phase: "configuration" });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("sets and verifies a known default without deleting any menu", async () => {
        fetchMock
            .mockResolvedValueOnce(emptyResponse())
            .mockResolvedValueOnce(jsonResponse({ richMenuId: "richmenu-previous" }));

        const result = await setNhfRichMenuDefault({
            richMenuId: "richmenu-previous",
            apply: true,
            fetchImpl: fetchMock,
        });

        expect(result).toEqual({
            mode: "applied",
            richMenuId: "richmenu-previous",
            verifiedDefaultRichMenuId: "richmenu-previous",
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock.mock.calls[0]?.[0]).toBe(
            "https://api.line.me/v2/bot/user/all/richmenu/richmenu-previous",
        );
        expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "POST" });
        expect(fetchMock.mock.calls[1]?.[0]).toBe(
            "https://api.line.me/v2/bot/user/all/richmenu",
        );
    });

    it("fails closed when the verified default differs and never deletes a menu", async () => {
        fetchMock
            .mockResolvedValueOnce(emptyResponse())
            .mockResolvedValueOnce(jsonResponse({ richMenuId: "richmenu-other" }));

        await expect(
            setNhfRichMenuDefault({
                richMenuId: "richmenu-previous",
                apply: true,
                fetchImpl: fetchMock,
            }),
        ).rejects.toMatchObject({ phase: "verify", richMenuId: "richmenu-previous" });

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock.mock.calls.every(([url]) => !String(url).includes("/delete"))).toBe(
            true,
        );
    });

    it("redacts the channel token from provider errors", async () => {
        fetchMock.mockResolvedValueOnce(
            jsonResponse({ message: "token nhfapp-token was rejected" }, 500),
        );

        await expect(
            setNhfRichMenuDefault({
                richMenuId: "richmenu-previous",
                apply: true,
                fetchImpl: fetchMock,
            }),
        ).rejects.toThrow("token [REDACTED] was rejected");
    });

    it("redacts a long channel token before truncating provider errors", async () => {
        const longToken = `token-${"x".repeat(220)}`;
        vi.stubEnv("LINE_APP_CHANNEL_ACCESS_TOKEN", longToken);
        fetchMock.mockResolvedValueOnce(
            jsonResponse({ message: `provider ${longToken} was rejected` }, 500),
        );

        await expect(
            setNhfRichMenuDefault({
                richMenuId: "richmenu-previous",
                apply: true,
                fetchImpl: fetchMock,
            }),
        ).rejects.toThrow("provider [REDACTED] was rejected");
    });

    it("does not print the channel token for set-default dry-run", async () => {
        const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

        await expect(
            runNhfRichMenuCli([
                "set-default",
                "--rich-menu-id=richmenu-previous",
            ]),
        ).resolves.toBe(0);

        const output = logSpy.mock.calls.flat().join(" ");
        expect(output).not.toContain("nhfapp-token");
        logSpy.mockRestore();
    });

    it("uses target/default wording for set-default provider failures", async () => {
        fetchMock.mockResolvedValueOnce(
            jsonResponse({ message: "default update failed" }, 500),
        );
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(fetchMock);
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

        try {
            await expect(
                runNhfRichMenuCli([
                    "set-default",
                    "--rich-menu-id=richmenu-previous",
                    "--apply",
                ]),
            ).resolves.toBe(1);

            const output = errorSpy.mock.calls.flat().join(" ");
            expect(output).toContain("Target richMenuId: richmenu-previous");
            expect(output).not.toContain("Created richMenuId");
            expect(output.toLowerCase()).not.toContain("new menu");
            expect(output).toContain("may or may not have changed");
            expect(output).toContain("npm run line:richmenu:status");
            expect(output).not.toContain("nhfapp-token");
        } finally {
            errorSpy.mockRestore();
            fetchSpy.mockRestore();
        }
    });

    it("uses verification wording for set-default mismatches", async () => {
        fetchMock
            .mockResolvedValueOnce(emptyResponse())
            .mockResolvedValueOnce(jsonResponse({ richMenuId: "richmenu-other" }));
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(fetchMock);
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

        try {
            await expect(
                runNhfRichMenuCli([
                    "set-default",
                    "--rich-menu-id=richmenu-previous",
                    "--apply",
                ]),
            ).resolves.toBe(1);

            const output = errorSpy.mock.calls.flat().join(" ");
            expect(output).toContain("Target richMenuId: richmenu-previous");
            expect(output).not.toContain("Created richMenuId");
            expect(output.toLowerCase()).not.toContain("new menu");
            expect(output).toContain("was not verified as the current default");
            expect(output).toContain("npm run line:richmenu:status");
        } finally {
            errorSpy.mockRestore();
            fetchSpy.mockRestore();
        }
    });

    it("keeps provisioning upload diagnostics operation-specific", async () => {
        fetchMock
            .mockResolvedValueOnce(emptyResponse())
            .mockResolvedValueOnce(jsonResponse({ richMenuId: "richmenu-created" }))
            .mockResolvedValueOnce(jsonResponse({ message: "upload failed" }, 500));
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(fetchMock);
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

        try {
            await expect(
                runNhfRichMenuCli(["provision", "--apply"]),
            ).resolves.toBe(1);

            const output = errorSpy.mock.calls.flat().join(" ");
            expect(output).toContain("Target richMenuId: richmenu-created");
            expect(output).toContain("A new Rich Menu was created");
            expect(output).toContain("Existing default was not changed");
        } finally {
            errorSpy.mockRestore();
            fetchSpy.mockRestore();
        }
    });
});
