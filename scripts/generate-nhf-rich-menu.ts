/* eslint-disable no-console -- Development asset generation reports its output path. */
import { mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import sharp, { type OverlayOptions, type Sharp } from "sharp";

import {
    getNhfRichMenuImagePath,
    NHF_RICH_MENU_HEIGHT,
    NHF_RICH_MENU_WIDTH,
    validateNhfRichMenuImage,
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
        if (!(await stat(fontPath)).isFile()) throw new Error(FONT_UNAVAILABLE_MESSAGE);
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

async function renderTile(
    tile: (typeof TILES)[number],
    assetDirectory: string,
    fontPath: string,
    hasDivider: boolean,
): Promise<Buffer> {
    const vector = await readArtwork(path.join(assetDirectory, tile.source));
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

export async function publishNhfRichMenuImage(image: Buffer, outputPath: string): Promise<void> {
    const outputDirectory = path.dirname(outputPath);
    await mkdir(outputDirectory, { recursive: true });
    const stagingDirectory = await mkdtemp(path.join(outputDirectory, ".rich-menu-"));
    try {
        const stagedImage = path.join(stagingDirectory, "menu.png");
        await writeFile(stagedImage, image);
        const info = await validateNhfRichMenuImage(stagedImage);
        if (info.format !== "png" || !(await sharp(stagedImage, { failOn: "warning" }).stats()).isOpaque) {
            throw new Error("Generated Rich Menu must be an opaque PNG");
        }
        await rename(stagedImage, outputPath);
    } finally {
        await rm(stagingDirectory, { recursive: true, force: true });
    }
}

export async function generateNhfRichMenuAsset(workingDirectory = process.cwd()): Promise<void> {
    const outputPath = getNhfRichMenuImagePath(workingDirectory);
    const fontPath = path.join(workingDirectory, "assets/fonts/NotoSansThai-Variable.ttf");
    const assetDirectory = path.join(workingDirectory, "public/assets/modules");
    await assertThaiFontAvailable(fontPath);

    const tiles = await Promise.all(TILES.map((tile, index) =>
        renderTile(tile, assetDirectory, fontPath, index > 0),
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

    await publishNhfRichMenuImage(image, outputPath);
    console.log(`Generated ${outputPath} (${image.length} bytes)`);
}

const scriptPath = process.argv[1];
if (scriptPath && import.meta.url === pathToFileURL(path.resolve(scriptPath)).href) {
    void generateNhfRichMenuAsset().catch((error: unknown) => {
        console.error(
            error instanceof Error ? error.message : "Rich Menu asset generation failed",
        );
        process.exitCode = 1;
    });
}
