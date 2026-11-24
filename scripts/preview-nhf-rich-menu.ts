import { copyFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { buildNhfRichMenuDefinition, getNhfRichMenuImagePath } from "../lib/line/rich-menu";

const EVIDENCE_DIRECTORY = "docs/verification/rich-menu-visual-identity";
const PREVIEW_WIDTHS = [430, 390, 360, 320] as const;
const MODULE_SOURCES = ["stock", "leave", "routine", "it-ticket"] as const;

function evidenceFile(file: string): string {
    return path.join(EVIDENCE_DIRECTORY, file);
}

async function main(): Promise<void> {
    const outputPath = getNhfRichMenuImagePath();
    const { size, areas } = buildNhfRichMenuDefinition();
    await copyFile(outputPath, evidenceFile("after-2500.png"));

    const previews = await Promise.all(PREVIEW_WIDTHS.map(async (width) => {
        const image = await sharp(outputPath).resize({ width }).png().toBuffer();
        await sharp(image).toFile(evidenceFile(`preview-${width}.png`));
        return image;
    }));

    const overlay = areas.map(({ action, bounds: { x, y, width, height } }) => {
        const [, , destination] = new URL(action.uri).pathname.split("/");
        return `
            <rect x="${x + 4}" y="${y + 4}" width="${width - 8}" height="${height - 8}" fill="none" stroke="#075985" stroke-width="8"/>
            <rect x="${x + 8}" y="${y + 8}" width="${width - 16}" height="91" fill="#0f172a"/>
            <text x="${x + 26}" y="${y + 44}" fill="#ffffff">${destination?.toUpperCase()}  /${destination}</text>
            <text x="${x + 26}" y="${y + 79}" fill="#bae6fd">x=${x}  y=${y}  w=${width}  h=${height}</text>`;
    }).join("");
    await sharp(outputPath).composite([{
        input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}" font-family="sans-serif" font-size="28">${overlay}</svg>`),
    }]).png().toFile(evidenceFile("tap-area-overlay.png"));

    const [before, after, icons] = await Promise.all([
        sharp(evidenceFile("before.png")).resize({ width: 1000 }).png().toBuffer(),
        sharp(outputPath).resize({ width: 1000 }).png().toBuffer(),
        Promise.all(MODULE_SOURCES.map((id) =>
            sharp(`public/assets/modules/${id}.svg`, { density: 144 }).resize(100).png().toBuffer(),
        )),
    ]);
    const captions = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1440" font-family="sans-serif" fill="#0f172a">
        <text x="40" y="54" font-size="30" font-weight="bold">NHFapp · LINE Rich Menu identity</text>
        <text x="40" y="107" font-size="18">Before · committed baseline</text>
        <text x="40" y="486" font-size="18">After · generated PNG</text>
        <text x="40" y="866" font-size="18">Canonical module artwork</text>
        ${MODULE_SOURCES.map((id, index) =>
            `<text x="${165 + index * 250}" y="1024" text-anchor="middle" font-size="16">${id}</text>`,
        ).join("")}
        ${PREVIEW_WIDTHS.map((width, index) =>
            `<text x="${index % 2 === 0 ? 40 : 565}" y="${index < 2 ? 1083 : 1270}" font-size="16">${width}px</text>`,
        ).join("")}
    </svg>`);
    await sharp({
        create: { width: 1080, height: 1440, channels: 3, background: "#ffffff" },
    }).composite([
        { input: captions, left: 0, top: 0 },
        { input: before, left: 40, top: 120 },
        { input: after, left: 40, top: 500 },
        ...icons.map((input, index) => ({ input, left: 115 + index * 250, top: 895 })),
        ...previews.map((input, index) => ({
            input,
            left: index % 2 === 0 ? 40 : 565,
            top: index < 2 ? 1097 : 1284,
        })),
    ]).png().toFile(evidenceFile("contact-sheet.png"));
}

void main();
