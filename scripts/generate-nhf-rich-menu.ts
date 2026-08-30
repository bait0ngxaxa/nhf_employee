/* eslint-disable no-console -- Development asset generation reports its output path. */
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import sharp from "sharp";

import {
    NHF_RICH_MENU_HEIGHT,
    NHF_RICH_MENU_IMAGE_PATH,
    NHF_RICH_MENU_WIDTH,
} from "../lib/line/rich-menu";

const OUTPUT_PATH = path.resolve(process.cwd(), NHF_RICH_MENU_IMAGE_PATH);
const THAI_FONT_PATH = path.resolve(
    process.cwd(),
    "assets/fonts/NotoSansThai-Variable.ttf",
);
const THAI_FONT_FAMILY = "Noto Sans Thai";
const FONT_UNAVAILABLE_MESSAGE =
    "Unable to generate NHFapp Rich Menu: required Thai-capable font is unavailable.";

const NHF_RICH_MENU_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="${NHF_RICH_MENU_WIDTH}" height="${NHF_RICH_MENU_HEIGHT}" viewBox="0 0 ${NHF_RICH_MENU_WIDTH} ${NHF_RICH_MENU_HEIGHT}">
  <rect width="2500" height="843" fill="#0f2747"/>
  <rect x="0" y="0" width="833" height="843" fill="#c2410c"/>
  <rect x="833" y="0" width="833" height="843" fill="#4338ca"/>
  <rect x="1666" y="0" width="834" height="843" fill="#0f766e"/>
  <path d="M0 0H833V190L0 843Z" fill="#ea580c" opacity="0.55"/>
  <path d="M833 0H1666V220L833 843Z" fill="#4f46e5" opacity="0.55"/>
  <path d="M1666 0H2500V190L1666 843Z" fill="#14b8a6" opacity="0.42"/>
  <path d="M833 0V843M1666 0V843" stroke="#ffffff" stroke-width="8" opacity="0.22"/>
  <g fill="none" stroke="#ffffff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" opacity="0.9">
    <rect x="83" y="104" width="112" height="82" rx="14"/>
    <path d="M83 143H195M111 104V186M167 104V186"/>
    <rect x="924" y="104" width="112" height="92" rx="14"/>
    <path d="M924 136H1036M952 83V119M1008 83V119M952 160H972M988 160H1008M952 180H972"/>
    <circle cx="1798" cy="148" r="56"/>
    <path d="M1768 148L1790 170L1830 124"/>
  </g>
</svg>`;

async function assertThaiFontAvailable(): Promise<void> {
    try {
        const fontStats = await stat(THAI_FONT_PATH);
        if (!fontStats.isFile()) throw new Error(FONT_UNAVAILABLE_MESSAGE);

        await sharp({
            text: {
                text: "เลือกบริการ",
                font: `${THAI_FONT_FAMILY} 16`,
                fontfile: THAI_FONT_PATH,
                rgba: true,
            },
        }).png().toBuffer();
    } catch {
        throw new Error(FONT_UNAVAILABLE_MESSAGE);
    }
}

function thaiText(
    text: string,
    fontSize: number,
    color: string,
): sharp.OverlayOptions {
    return {
        input: {
            text: {
                text: `<span foreground="${color}" font_weight="700">${text}</span>`,
                font: `${THAI_FONT_FAMILY} ${fontSize}`,
                fontfile: THAI_FONT_PATH,
                rgba: true,
            },
        },
    };
}

function englishText(
    text: string,
    fontSize: number,
    color: string,
): sharp.OverlayOptions {
    return {
        input: {
            text: {
                text: `<span foreground="${color}" font_weight="700" letter_spacing="2048">${text}</span>`,
                font: `${THAI_FONT_FAMILY} ${fontSize}`,
                fontfile: THAI_FONT_PATH,
                rgba: true,
            },
        },
    };
}

function supportingText(text: string): sharp.OverlayOptions {
    return {
        input: {
            text: {
                text: `<span foreground="#f8fafc" font_weight="400">${text}</span>`,
                font: `${THAI_FONT_FAMILY} 34`,
                fontfile: THAI_FONT_PATH,
                rgba: true,
            },
        },
    };
}

export async function generateNhfRichMenuAsset(): Promise<void> {
    await assertThaiFontAvailable();
    await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
    await sharp(Buffer.from(NHF_RICH_MENU_SVG, "utf8"))
        .composite([
            { ...englishText("STOCK", 32, "#ffedd5"), left: 83, top: 260 },
            { ...thaiText("เบิกวัสดุ", 82, "#ffffff"), left: 83, top: 325 },
            { ...supportingText("ขอและติดตามวัสดุ"), left: 83, top: 455 },
            { ...englishText("LEAVE", 32, "#e0e7ff"), left: 924, top: 260 },
            { ...thaiText("ลางาน", 82, "#ffffff"), left: 924, top: 325 },
            { ...supportingText("ตรวจสอบสิทธิ์วันลา"), left: 924, top: 455 },
            { ...englishText("ROUTINE", 32, "#ccfbf1"), left: 1750, top: 260 },
            { ...thaiText("งานของฉัน", 82, "#ffffff"), left: 1750, top: 325 },
            { ...supportingText("ดูงานประจำ"), left: 1750, top: 455 },
        ])
        .png({ compressionLevel: 9 })
        .toFile(OUTPUT_PATH);

    console.log(`Generated ${OUTPUT_PATH}`);
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
