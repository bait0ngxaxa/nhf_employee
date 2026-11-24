/* eslint-disable no-console -- Development asset generation reports its output path. */
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import sharp, { type OverlayOptions, type Sharp } from "sharp";
import { z } from "zod";

import {
    getNhfRichMenuImagePath,
    NHF_RICH_MENU_HEIGHT,
    NHF_RICH_MENU_MAX_BYTES,
    NHF_RICH_MENU_WIDTH,
} from "../lib/line/rich-menu";

const THAI_FONT_FAMILY = "Noto Sans Thai";
const FONT_UNAVAILABLE_MESSAGE =
    "Unable to generate NHFapp Rich Menu: required Thai-capable font is unavailable.";

const ARTWORK_SIZE = 360;
const ARTWORK_TOP = 152;
const LABEL_SIZE = 112;
const LABEL_CENTER_Y = 611;
const LABEL_SIDE_PADDING = 44;
const LABEL_COLOR = "#0f172a"; // --content-primary
const DIVIDER_COLOR = "#e2e8f0"; // --border-subtle
const DIVIDER_WIDTH = 5;

// Surfaces mirror the light module badge tokens in app/globals.css.
const TILES = [
    { source: "stock.svg", label: "เบิกวัสดุ", surface: "#fff7ed" },
    { source: "leave.svg", label: "ลางาน", surface: "#eef2ff" },
    { source: "routine.svg", label: "งานของฉัน", surface: "#f0fdfa" },
    { source: "it-ticket.svg", label: "แจ้งปัญหา", surface: "#eff6ff" },
] as const;

const TILE_WIDTH = NHF_RICH_MENU_WIDTH / TILES.length;
const FONT_SOURCE = "assets/fonts/NotoSansThai-Variable.ttf";
const artworkSource = (filename: string): string => `public/assets/modules/${filename}`;
const GENERATOR_SOURCE = "scripts/generate-nhf-rich-menu.ts";
const sourcePaths = [FONT_SOURCE, GENERATOR_SOURCE, ...TILES.map(({ source }) => artworkSource(source))].sort();
const manifestPath = (imagePath: string): string => imagePath.replace(/\.png$/, ".manifest.json");
const sha256 = (input: Buffer | string): string => createHash("sha256").update(input).digest("hex");
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const manifestSchema = z.strictObject({
    schemaVersion: z.literal(1),
    sourceFingerprint: digest,
    image: z.strictObject({
        sha256: digest,
        width: z.literal(NHF_RICH_MENU_WIDTH),
        height: z.literal(NHF_RICH_MENU_HEIGHT),
        bytes: z.number().int().positive().max(NHF_RICH_MENU_MAX_BYTES),
        format: z.literal("png"),
    }),
});
type RichMenuManifest = z.infer<typeof manifestSchema>;

function renderThaiText(text: string, fontPath: string, fontSize: number): Sharp {
    return sharp({
        text: {
            text: `<span foreground="${LABEL_COLOR}" font_weight="700">${text}</span>`,
            font: `${THAI_FONT_FAMILY} ${fontSize}`,
            fontfile: fontPath,
            rgba: true,
        },
    });
}

async function assertThaiFontAvailable(fontPath: string): Promise<void> {
    try {
        await readFile(fontPath);
        await renderThaiText("เลือกบริการ", fontPath, 16).png().toBuffer();
    } catch (cause) {
        throw new Error(FONT_UNAVAILABLE_MESSAGE, { cause });
    }
}

async function readArtwork(sourcePath: string): Promise<Buffer> {
    try {
        return await readFile(sourcePath);
    } catch (cause) {
        throw new Error(`Unable to read Rich Menu artwork: ${sourcePath}`, { cause });
    }
}

async function readInputs(workingDirectory: string): Promise<Map<string, Buffer>> {
    return new Map(await Promise.all(sourcePaths.map(async (source): Promise<[string, Buffer]> => {
        const filename = path.join(workingDirectory, source);
        if (source.startsWith("public/")) return [source, await readArtwork(filename)];
        try {
            return [source, await readFile(filename)];
        } catch (cause) {
            throw new Error(`Unable to read Rich Menu input: ${source}`, { cause });
        }
    })));
}

function fingerprint(inputs: ReadonlyMap<string, Buffer>): string {
    // Git may check out text with CRLF or LF. The font is hashed byte-for-byte.
    const files = [...inputs].map(([source, bytes]) => [
        source, sha256(source === FONT_SOURCE ? bytes : bytes.toString("utf8").replaceAll("\r\n", "\n")),
    ]);
    return sha256(JSON.stringify({
        files, width: NHF_RICH_MENU_WIDTH, height: NHF_RICH_MENU_HEIGHT,
        columns: TILES.length, maxBytes: NHF_RICH_MENU_MAX_BYTES,
    }));
}

async function renderTile(
    tile: (typeof TILES)[number],
    inputs: ReadonlyMap<string, Buffer>,
    fontPath: string,
    hasDivider: boolean,
): Promise<Buffer> {
    const vector = inputs.get(artworkSource(tile.source));
    if (!vector) throw new Error(`Missing Rich Menu artwork input: ${tile.source}`);
    const artwork = await sharp(vector, { density: 288 })
        .resize(ARTWORK_SIZE, ARTWORK_SIZE, { fit: "contain", background: "#00000000" })
        .png()
        .toBuffer();
    const label = await renderThaiText(tile.label, fontPath, LABEL_SIZE)
        .png()
        .toBuffer({ resolveWithObject: true });
    const labelTop = Math.round(LABEL_CENTER_Y - label.info.height / 2);

    if (
        ARTWORK_SIZE > TILE_WIDTH
        || label.info.width > TILE_WIDTH - 2 * LABEL_SIDE_PADDING
        || labelTop <= ARTWORK_TOP + ARTWORK_SIZE
        || labelTop + label.info.height > NHF_RICH_MENU_HEIGHT
    ) {
        throw new Error(`Rich Menu artwork or label exceeds its tile: ${tile.source}`);
    }

    const [artworkStats, labelStats] = await Promise.all([
        sharp(artwork).stats(),
        sharp(label.data).stats(),
    ]);
    if (!artworkStats.channels[3]?.max || !labelStats.channels[3]?.max) {
        throw new Error(`Rich Menu artwork or label is empty: ${tile.source}`);
    }

    const layers: OverlayOptions[] = [
        { input: artwork, left: Math.floor((TILE_WIDTH - ARTWORK_SIZE) / 2), top: ARTWORK_TOP },
        { input: label.data, left: Math.round((TILE_WIDTH - label.info.width) / 2), top: labelTop },
    ];
    if (hasDivider) {
        layers.push({
            input: {
                create: {
                    width: DIVIDER_WIDTH,
                    height: NHF_RICH_MENU_HEIGHT,
                    channels: 3,
                    background: DIVIDER_COLOR,
                },
            },
            left: 0,
            top: 0,
        });
    }

    return sharp({
        create: {
            width: TILE_WIDTH,
            height: NHF_RICH_MENU_HEIGHT,
            channels: 3,
            background: tile.surface,
        },
    }).composite(layers).png().toBuffer();
}

async function inspectImage(image: Buffer): Promise<RichMenuManifest["image"]> {
    if (image.length > NHF_RICH_MENU_MAX_BYTES) throw new Error("Generated Rich Menu exceeds the 1 MB limit");
    const decoded = sharp(image, { failOn: "warning" });
    const { width, height, format } = await decoded.metadata();
    if (format !== "png") throw new Error("Generated Rich Menu must be a PNG");
    if (width !== NHF_RICH_MENU_WIDTH || height !== NHF_RICH_MENU_HEIGHT) {
        throw new Error(`Generated Rich Menu must be ${NHF_RICH_MENU_WIDTH}x${NHF_RICH_MENU_HEIGHT}px`);
    }
    if (!(await decoded.stats()).isOpaque) throw new Error("Generated Rich Menu must be an opaque PNG");
    return { sha256: sha256(image), width, height, bytes: image.length, format };
}

export async function publishNhfRichMenuImage(image: Buffer, outputPath: string, sourceFingerprint: string): Promise<void> {
    const manifest = manifestSchema.parse({ schemaVersion: 1, sourceFingerprint, image: await inspectImage(image) });
    const outputDirectory = path.dirname(outputPath);
    await mkdir(outputDirectory, { recursive: true });
    const stagingDirectory = await mkdtemp(path.join(outputDirectory, ".rich-menu-"));
    try {
        const stagedImage = path.join(stagingDirectory, "menu.png");
        const stagedManifest = path.join(stagingDirectory, "manifest.json");
        await writeFile(stagedImage, image);
        await writeFile(stagedManifest, JSON.stringify(manifest, null, 4) + "\n");
        // Each rename is atomic. If publication stops between them, verification rejects the pair.
        await rename(stagedImage, outputPath);
        await rename(stagedManifest, manifestPath(outputPath));
    } finally {
        await rm(stagingDirectory, { recursive: true, force: true });
    }
}

export async function verifyNhfRichMenuAsset(workingDirectory = process.cwd()): Promise<RichMenuManifest["image"]> {
    const outputPath = getNhfRichMenuImagePath(workingDirectory);
    const current = fingerprint(await readInputs(workingDirectory));
    const json: unknown = JSON.parse(await readFile(manifestPath(outputPath), "utf8"));
    const manifest = manifestSchema.safeParse(json);
    if (!manifest.success) throw new Error("Rich Menu manifest does not match its schema");
    if (current !== manifest.data.sourceFingerprint) throw new Error("Rich Menu generation inputs changed");
    const image = await inspectImage(await readFile(outputPath));
    if (image.sha256 !== manifest.data.image.sha256 || image.bytes !== manifest.data.image.bytes) {
        throw new Error("Rich Menu PNG does not match the generated manifest");
    }
    return image;
}

export async function generateNhfRichMenuAsset(workingDirectory = process.cwd()): Promise<void> {
    const outputPath = getNhfRichMenuImagePath(workingDirectory);
    const fontPath = path.join(workingDirectory, FONT_SOURCE);
    await assertThaiFontAvailable(fontPath);
    const inputs = await readInputs(workingDirectory);
    const sourceFingerprint = fingerprint(inputs);

    const tiles = await Promise.all(TILES.map((tile, index) =>
        renderTile(tile, inputs, fontPath, index > 0),
    ));
    const image = await sharp({
        create: {
            width: NHF_RICH_MENU_WIDTH,
            height: NHF_RICH_MENU_HEIGHT,
            channels: 3,
            background: LABEL_COLOR,
        },
    }).composite(tiles.map((input, index) => ({
        input,
        left: TILE_WIDTH * index,
        top: 0,
    }))).png({ compressionLevel: 9 }).toBuffer();

    if (sourceFingerprint !== fingerprint(await readInputs(workingDirectory))) {
        throw new Error("Rich Menu generation inputs changed during rendering. Run generation again.");
    }
    await publishNhfRichMenuImage(image, outputPath, sourceFingerprint);
    console.log(`Generated ${outputPath} (${image.length} bytes)`);
}

const scriptPath = process.argv[1];
if (scriptPath && import.meta.url === pathToFileURL(path.resolve(scriptPath)).href) {
    const verify = process.argv.includes("--verify");
    const operation = verify
        ? verifyNhfRichMenuAsset().then(({ width, height, bytes }) => {
            console.log(`Verified Rich Menu PNG (${width}x${height}, ${bytes} bytes) and source freshness.`);
        })
        : generateNhfRichMenuAsset();
    void operation.catch((error: unknown) => {
        console.error(
            error instanceof Error ? error.message : "Rich Menu asset generation failed",
        );
        if (verify) console.error("Restore the missing inputs or run npm run line:richmenu:asset and review the generated PNG and manifest.");
        process.exitCode = 1;
    });
}
