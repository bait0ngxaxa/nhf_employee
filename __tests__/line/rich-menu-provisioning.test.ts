import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const loadEnvConfigMock = vi.hoisted(() => vi.fn());

vi.mock("@next/env", () => ({
    loadEnvConfig: loadEnvConfigMock,
}));

import {
    buildRoutineRichMenuDefinition,
    getRoutineRichMenuImagePath,
    getRoutineRichMenuStatus,
    provisionRoutineRichMenu,
    validateRoutineRichMenuDefinition,
    validateRoutineRichMenuImage,
} from "@/lib/line/rich-menu";
import {
    buildRoutineLiffTaskUrl,
    buildRoutineLiffUrl,
} from "@/lib/line/routine-links";
import {
    loadRoutineRichMenuEnvironment,
    runRoutineRichMenuCli,
} from "../../scripts/line-routine-rich-menu";

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

function emptyResponse(status = 200): Response {
    return new Response(null, { status });
}

describe("Routine Rich Menu definition", () => {
    beforeEach(() => {
        vi.stubEnv("NEXT_PUBLIC_LINE_LIFF_ID", "nhfapp-liff-id");
        vi.stubEnv("LINE_APP_CHANNEL_ACCESS_TOKEN", "nhfapp-token");
        vi.stubEnv("LINE_LOGIN_CHANNEL_ID", "login-channel-id");
        vi.stubEnv("LINE_APP_CHANNEL_SECRET", "nhfapp-secret");
        vi.stubEnv("LINE_LIFF_SESSION_SECRET", "a-long-enough-session-secret");
        vi.stubEnv("LINE_LIFF_SESSION_TTL_SECONDS", "3600");
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("uses the configured base LIFF URL for the complete tappable area", () => {
        const definition = buildRoutineRichMenuDefinition();

        expect(buildRoutineLiffUrl()).toBe(
            "https://liff.line.me/nhfapp-liff-id/routine",
        );
        expect(definition.size).toEqual({ width: 2500, height: 843 });
        expect(definition.areas).toHaveLength(1);
        expect(definition.areas[0]?.bounds).toEqual({
            x: 0,
            y: 0,
            width: 2500,
            height: 843,
        });
        expect(definition.areas[0]?.action.uri).toBe(buildRoutineLiffUrl());
        expect(JSON.stringify(definition)).not.toContain("routine-token");
    });

    it("keeps task deep links on the same centralized LIFF origin", () => {
        expect(buildRoutineLiffTaskUrl(71, 91)).toBe(
            "https://liff.line.me/nhfapp-liff-id/routine?taskId=71&occurrenceId=91",
        );
    });

    it("rejects a missing LIFF ID", () => {
        vi.stubEnv("NEXT_PUBLIC_LINE_LIFF_ID", "");
        vi.stubEnv("NEXT_PUBLIC_LINE_ROUTINE_LIFF_ID", "");

        expect(() => buildRoutineRichMenuDefinition()).toThrow(
            "NHFapp LINE LIFF ID is not configured",
        );
    });

    it("rejects tappable areas outside the image bounds", () => {
        const definition = buildRoutineRichMenuDefinition();
        const area = definition.areas[0];
        if (!area) throw new Error("Expected a tappable Rich Menu area");
        area.bounds.width = 2501;

        expect(() => validateRoutineRichMenuDefinition(definition)).toThrow(
            "outside the image bounds",
        );
    });

    it("validates the committed PNG dimensions and file size", async () => {
        const image = await validateRoutineRichMenuImage(
            getRoutineRichMenuImagePath(),
        );

        expect(image).toMatchObject({
            format: "png",
            contentType: "image/png",
            width: 2500,
            height: 843,
        });
        expect(image.bytes).toBeLessThanOrEqual(1_000_000);
    });

    it("rejects a wrong image path and an image over the configured limit", async () => {
        await expect(
            validateRoutineRichMenuImage("assets/line/missing.png"),
        ).rejects.toThrow("was not found");

        await expect(
            validateRoutineRichMenuImage(getRoutineRichMenuImagePath(), {
                maxBytes: 1,
            }),
        ).rejects.toThrow("exceeds LINE's 1 MB limit");
    });
});

describe("Routine Rich Menu provisioning", () => {
    const fetchMock = vi.fn<typeof fetch>();

    beforeEach(() => {
        vi.stubEnv("NEXT_PUBLIC_LINE_LIFF_ID", "nhfapp-liff-id");
        vi.stubEnv("LINE_APP_CHANNEL_ACCESS_TOKEN", "nhfapp-token");
        vi.stubEnv("NEXT_PUBLIC_FEATURE_ROUTINE", "true");
        fetchMock.mockReset();
        loadEnvConfigMock.mockReset();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("performs no network request during dry-run", async () => {
        const result = await provisionRoutineRichMenu({
            apply: false,
            fetchImpl: fetchMock,
        });

        expect(result.mode).toBe("dry-run");
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("allows a disabled Routine feature during dry-run without API calls", async () => {
        vi.stubEnv("NEXT_PUBLIC_FEATURE_ROUTINE", "false");

        const result = await provisionRoutineRichMenu({
            apply: false,
            fetchImpl: fetchMock,
        });

        expect(result).toMatchObject({
            mode: "dry-run",
            routineFeatureEnabled: false,
        });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("fails before any API call when applying while Routine is disabled", async () => {
        vi.stubEnv("NEXT_PUBLIC_FEATURE_ROUTINE", "false");

        await expect(
            provisionRoutineRichMenu({ apply: true, fetchImpl: fetchMock }),
        ).rejects.toMatchObject({
            phase: "configuration",
            message: expect.stringContaining("Routine feature is disabled"),
        });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("loads the project environment with Next.js env semantics", () => {
        vi.stubEnv("NODE_ENV", "development");

        loadRoutineRichMenuEnvironment();

        expect(loadEnvConfigMock).toHaveBeenCalledWith(process.cwd(), true);
    });

    it("validates before create and runs the complete apply sequence", async () => {
        fetchMock
            .mockResolvedValueOnce(emptyResponse())
            .mockResolvedValueOnce(jsonResponse({ richMenuId: "richmenu-test" }))
            .mockResolvedValueOnce(emptyResponse())
            .mockResolvedValueOnce(emptyResponse())
            .mockResolvedValueOnce(jsonResponse({ richMenuId: "richmenu-test" }));

        const result = await provisionRoutineRichMenu({
            apply: true,
            fetchImpl: fetchMock,
        });

        expect(result).toMatchObject({
            mode: "applied",
            richMenuId: "richmenu-test",
            verifiedDefaultRichMenuId: "richmenu-test",
        });
        expect(fetchMock).toHaveBeenCalledTimes(5);
        expect(fetchMock.mock.calls[0]?.[0]).toBe(
            "https://api.line.me/v2/bot/richmenu/validate",
        );
        expect(fetchMock.mock.calls[1]?.[0]).toBe(
            "https://api.line.me/v2/bot/richmenu",
        );
        expect(fetchMock.mock.calls[2]?.[0]).toBe(
            "https://api-data.line.me/v2/bot/richmenu/richmenu-test/content",
        );
        expect(fetchMock.mock.calls[3]?.[0]).toBe(
            "https://api.line.me/v2/bot/user/all/richmenu/richmenu-test",
        );
        expect(fetchMock.mock.calls[4]?.[0]).toBe(
            "https://api.line.me/v2/bot/user/all/richmenu",
        );
        expect(fetchMock.mock.calls[0]?.[1]).toEqual(
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: "Bearer nhfapp-token",
                }),
            }),
        );
    });

    it("stops before create when LINE validation fails", async () => {
        fetchMock.mockResolvedValueOnce(
            jsonResponse({ message: "invalid rich menu" }, 400),
        );

        await expect(
            provisionRoutineRichMenu({ apply: true, fetchImpl: fetchMock }),
        ).rejects.toMatchObject({
            phase: "validate",
            statusCode: 400,
        });
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("stops before upload when creation fails", async () => {
        fetchMock
            .mockResolvedValueOnce(emptyResponse())
            .mockResolvedValueOnce(
                jsonResponse({ message: "create failed" }, 400),
            );

        await expect(
            provisionRoutineRichMenu({ apply: true, fetchImpl: fetchMock }),
        ).rejects.toMatchObject({
            phase: "create",
            statusCode: 400,
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("reports the created ID and does not set default when upload fails", async () => {
        fetchMock
            .mockResolvedValueOnce(emptyResponse())
            .mockResolvedValueOnce(jsonResponse({ richMenuId: "richmenu-test" }))
            .mockResolvedValueOnce(
                jsonResponse({ message: "upload failed" }, 500),
            );

        await expect(
            provisionRoutineRichMenu({ apply: true, fetchImpl: fetchMock }),
        ).rejects.toMatchObject({
            phase: "upload",
            statusCode: 500,
            richMenuId: "richmenu-test",
        });
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it("treats a missing default after set as a verification failure", async () => {
        fetchMock
            .mockResolvedValueOnce(emptyResponse())
            .mockResolvedValueOnce(jsonResponse({ richMenuId: "richmenu-test" }))
            .mockResolvedValueOnce(emptyResponse())
            .mockResolvedValueOnce(emptyResponse())
            .mockResolvedValueOnce(new Response(null, { status: 404 }));

        await expect(
            provisionRoutineRichMenu({ apply: true, fetchImpl: fetchMock }),
        ).rejects.toMatchObject({
            phase: "verify",
            richMenuId: "richmenu-test",
        });
    });

    it("reports status without exposing the channel access token", async () => {
        fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));

        const status = await getRoutineRichMenuStatus(fetchMock);

        expect(status.defaultRichMenuStatus).toBe("not-set");
        expect(JSON.stringify(status)).not.toContain("nhfapp-token");
    });

    it("does not print the channel access token during dry-run", async () => {
        const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

        await expect(runRoutineRichMenuCli(["provision"])).resolves.toBe(0);

        const output = logSpy.mock.calls.flat().join(" ");
        expect(output).not.toContain("nhfapp-token");
        logSpy.mockRestore();
    });
});
