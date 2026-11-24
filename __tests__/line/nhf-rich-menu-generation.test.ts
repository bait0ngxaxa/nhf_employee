import { createHash } from "node:crypto";
import { appendFile, copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import sharp from "sharp";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
    buildNhfRichMenuDefinition,
    getNhfRichMenuImagePath,
    NHF_RICH_MENU_MAX_BYTES,
    validateNhfRichMenuImage,
} from "@/lib/line/rich-menu";
import {
    generateNhfRichMenuAsset,
    publishNhfRichMenuImage,
    verifyNhfRichMenuAsset,
} from "../../scripts/generate-nhf-rich-menu";
import { generateRoutineRichMenuAsset } from "../../scripts/generate-routine-rich-menu";

const FONT_PATH = "assets/fonts/NotoSansThai-Variable.ttf";
const ARTWORK_DIRECTORY = "public/assets/modules";
const GENERATOR_SOURCE = "scripts/generate-nhf-rich-menu.ts";
const MANIFEST = "assets/line/nhf-rich-menu.manifest.json";
type TestManifest = { sourceFingerprint: string; image: { sha256: string; bytes: number } };
const ARTWORK_BY_DESTINATION = {
    "/stock": { file: "stock.svg", color: "#aa3600" },
    "/leave": { file: "leave.svg", color: "#291baa" },
    "/routine": { file: "routine.svg", color: "#007949" },
    "/it": { file: "it-ticket.svg", color: "#075a99" },
} as const;

describe("NHFapp Rich Menu artwork generation", () => {
    let fixtureRoot: string;
    let directory: string;
    const fetchMock = vi.fn<typeof fetch>(() => Promise.reject(new Error("Unexpected network request")));

    beforeAll(async () => {
        fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "nhf-rich-menu-"));
    });

    beforeEach(async () => {
        directory = await mkdtemp(path.join(fixtureRoot, "case-"));
        await mkdir(path.join(directory, "scripts"));
        await copyFile(GENERATOR_SOURCE, path.join(directory, GENERATOR_SOURCE));
        vi.stubEnv("NEXT_PUBLIC_LINE_LIFF_ID", "");
        vi.stubEnv("LINE_APP_CHANNEL_ACCESS_TOKEN", "");
        vi.stubGlobal("fetch", fetchMock);
        fetchMock.mockClear();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
    });

    afterAll(async () => {
        // Pango can reuse a registered font path for later renders in this worker.
        await rm(fixtureRoot, { recursive: true, force: true });
    });

    async function copyFont(): Promise<void> {
        await mkdir(path.join(directory, "assets/fonts"), { recursive: true });
        await copyFile(FONT_PATH, path.join(directory, FONT_PATH));
    }

    async function copyArtwork(): Promise<void> {
        const assetDirectory = path.join(directory, ARTWORK_DIRECTORY);
        await mkdir(assetDirectory, { recursive: true });
        await Promise.all(Object.values(ARTWORK_BY_DESTINATION).map(({ file }) =>
            copyFile(path.join(ARTWORK_DIRECTORY, file), path.join(assetDirectory, file)),
        ));
    }

    async function copyCommittedArtifact(): Promise<void> {
        await Promise.all([copyFont(), copyArtwork()]);
        const output = getNhfRichMenuImagePath(directory);
        await mkdir(path.dirname(output), { recursive: true });
        await Promise.all([
            copyFile(getNhfRichMenuImagePath(), output),
            copyFile(MANIFEST, path.join(directory, MANIFEST)),
        ]);
    }

    it("generates a decodable opaque PNG from all four primary SVGs without LINE configuration or network", async () => {
        await Promise.all([copyFont(), copyArtwork()]);
        expect(generateRoutineRichMenuAsset).toBe(generateNhfRichMenuAsset);
        await generateNhfRichMenuAsset(directory);
        const outputPath = getNhfRichMenuImagePath(directory);
        const info = await validateNhfRichMenuImage(outputPath);
        expect(info).toMatchObject({ format: "png", width: 2500, height: 843 });
        expect(info.bytes).toBeLessThanOrEqual(NHF_RICH_MENU_MAX_BYTES);
        expect((await sharp(outputPath).stats()).isOpaque).toBe(true);
        await expect(verifyNhfRichMenuAsset(directory)).resolves.toMatchObject({
            format: info.format, width: info.width, height: info.height, bytes: info.bytes,
        });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("places each canonical artwork source and centered Thai label inside the corresponding defined action area", async () => {
        await copyFont();
        vi.stubEnv("NEXT_PUBLIC_LINE_LIFF_ID", "fixture-id");
        const definition = buildNhfRichMenuDefinition();
        const assetDirectory = path.join(directory, ARTWORK_DIRECTORY);
        await mkdir(assetDirectory, { recursive: true });
        for (const { file, color } of Object.values(ARTWORK_BY_DESTINATION)) {
            const vector = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect x="16" y="16" width="96" height="96" fill="' + color + '"/></svg>';
            await writeFile(path.join(assetDirectory, file), vector);
        }

        await generateNhfRichMenuAsset(directory);
        const outputPath = getNhfRichMenuImagePath(directory);
        for (const { bounds, action } of definition.areas) {
            const route = new URL(action.uri).pathname.replace(/^\/fixture-id/, "");
            const source = Object.entries(ARTWORK_BY_DESTINATION).find(([key]) => key === route)?.[1];
            if (!source) throw new Error("Unexpected Rich Menu route " + route);

            const { data, info } = await sharp(outputPath)
                .extract({ left: bounds.x, top: bounds.y, width: bounds.width, height: bounds.height })
                .removeAlpha()
                .raw()
                .toBuffer({ resolveWithObject: true });
            const artworkColor = Number.parseInt(source.color.slice(1), 16);
            const artwork = { left: info.width, right: -1, top: info.height, bottom: -1 };
            const label = { left: info.width, right: -1, top: info.height, bottom: -1 };
            for (let offset = 0; offset < data.length; offset += info.channels) {
                const color = data.readUIntBE(offset, 3);
                const box = color === artworkColor ? artwork : color === 0x0f172a ? label : null;
                if (!box) continue;
                const pixel = offset / info.channels;
                const x = pixel % info.width;
                const y = Math.floor(pixel / info.width);
                box.left = Math.min(box.left, x);
                box.right = Math.max(box.right, x);
                box.top = Math.min(box.top, y);
                box.bottom = Math.max(box.bottom, y);
            }

            for (const box of [artwork, label]) {
                expect(box.right).toBeGreaterThan(box.left);
                expect(box.bottom).toBeGreaterThan(box.top);
                expect(box.left).toBeGreaterThanOrEqual(40);
                expect(box.right).toBeLessThan(info.width - 40);
                expect(Math.abs(box.left + box.right + 1 - info.width)).toBeLessThan(10);
                expect(box.top).toBeGreaterThan(0);
                expect(box.bottom).toBeLessThan(info.height - 1);
            }
            expect(artwork.bottom).toBeLessThan(label.top);
        }
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("fails explicitly when the bundled Thai font is missing", async () => {
        await expect(generateNhfRichMenuAsset(directory)).rejects.toThrow("required Thai-capable font");
    });

    it("fails explicitly when the required font path is not readable as a file", async () => {
        await mkdir(path.join(directory, FONT_PATH), { recursive: true });
        await expect(generateNhfRichMenuAsset(directory)).rejects.toThrow("required Thai-capable font");
    });

    it("fails explicitly when a canonical primary SVG is missing", async () => {
        await copyFont();
        await expect(generateNhfRichMenuAsset(directory)).rejects.toThrow(
            /Unable to read Rich Menu artwork: .*\.svg/,
        );
    });

    it("preserves a valid image and removes staging files after invalid output", async () => {
        await copyCommittedArtifact();
        const outputPath = getNhfRichMenuImagePath(directory);
        const original = await readFile(outputPath);
        const manifest = await readFile(path.join(directory, MANIFEST));
        const { sourceFingerprint }: TestManifest = JSON.parse(manifest.toString("utf8"));
        const transparent = await sharp({
            create: { width: 2500, height: 843, channels: 4, background: "#00000000" },
        }).png().toBuffer();

        await expect(publishNhfRichMenuImage(transparent, outputPath, sourceFingerprint)).rejects.toThrow("opaque PNG");
        await expect(publishNhfRichMenuImage(original.subarray(0, 64), outputPath, sourceFingerprint)).rejects.toThrow();
        expect(await readFile(outputPath)).toEqual(original);
        expect(await readFile(path.join(directory, MANIFEST))).toEqual(manifest);
        expect(await readdir(path.dirname(outputPath))).toEqual(["nhf-rich-menu.manifest.json", "nhf-rich-menu.png"]);
        await expect(verifyNhfRichMenuAsset(directory)).resolves.toMatchObject({ format: "png" });
    });

    it.each([FONT_PATH, GENERATOR_SOURCE, `${ARTWORK_DIRECTORY}/stock.svg`])(
        "detects a changed input at %s without regenerating",
        async (source) => {
            await copyCommittedArtifact();
            const output = getNhfRichMenuImagePath(directory);
            const before = await readFile(output);
            await appendFile(path.join(directory, source), "\nchanged input");
            await expect(verifyNhfRichMenuAsset(directory)).rejects.toThrow("generation inputs changed");
            expect(await readFile(output)).toEqual(before);
            expect(fetchMock).not.toHaveBeenCalled();
        },
    );

    it("rejects missing inputs, missing metadata, and malformed metadata", async () => {
        await copyCommittedArtifact();
        const asset = path.join(ARTWORK_DIRECTORY, "leave.svg");
        await rm(path.join(directory, asset));
        await expect(verifyNhfRichMenuAsset(directory)).rejects.toThrow(/Unable to read Rich Menu artwork.*leave.svg/);
        await copyFile(asset, path.join(directory, asset));
        const manifest = path.join(directory, MANIFEST);
        await rm(manifest);
        await expect(verifyNhfRichMenuAsset(directory)).rejects.toThrow(/ENOENT.*manifest/);
        await writeFile(manifest, JSON.stringify({ schemaVersion: 2 }));
        await expect(verifyNhfRichMenuAsset(directory)).rejects.toThrow("manifest does not match its schema");
    });

    it("rejects an inconsistent publication even when the replacement is a valid PNG", async () => {
        await copyCommittedArtifact();
        const output = getNhfRichMenuImagePath(directory);
        const replacement = await sharp({
            create: { width: 2500, height: 843, channels: 3, background: "#fff" },
        }).png().toBuffer();
        await writeFile(output, replacement);
        await expect(verifyNhfRichMenuAsset(directory)).rejects.toThrow("PNG does not match the generated manifest");
    });

    it.each([
        { name: "JPEG", width: 2500, height: 843, format: "jpeg", background: "#ffffff", error: "must be a PNG" },
        { name: "wrong dimensions", width: 80, height: 80, format: "png", background: "#ffffff", error: "2500x843" },
        { name: "transparent output", width: 2500, height: 843, format: "png", background: "#00000000", error: "opaque PNG" },
    ] as const)("rejects $name even if its hash matches the manifest", async ({ width, height, format, background, error }) => {
        await copyCommittedArtifact();
        const image = await sharp({ create: { width, height, channels: 4, background } }).toFormat(format).toBuffer();
        const manifestPath = path.join(directory, MANIFEST);
        const manifest: TestManifest = JSON.parse(await readFile(manifestPath, "utf8"));
        manifest.image.sha256 = createHash("sha256").update(image).digest("hex");
        manifest.image.bytes = image.length;
        await writeFile(manifestPath, JSON.stringify(manifest));
        await writeFile(getNhfRichMenuImagePath(directory), image);
        await expect(verifyNhfRichMenuAsset(directory)).rejects.toThrow(error);
    });

    it("rejects an image that exceeds LINE's byte limit", async () => {
        await copyCommittedArtifact();
        await writeFile(getNhfRichMenuImagePath(directory), Buffer.alloc(NHF_RICH_MENU_MAX_BYTES + 1));
        await expect(verifyNhfRichMenuAsset(directory)).rejects.toThrow("1 MB limit");
    });
});
