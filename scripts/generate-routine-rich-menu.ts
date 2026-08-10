/* eslint-disable no-console -- Development asset generation reports its output path. */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import sharp from "sharp";

import {
    ROUTINE_RICH_MENU_HEIGHT,
    ROUTINE_RICH_MENU_WIDTH,
    ROUTINE_RICH_MENU_IMAGE_PATH,
} from "../lib/line/rich-menu";

const OUTPUT_PATH = path.resolve(process.cwd(), ROUTINE_RICH_MENU_IMAGE_PATH);

const ROUTINE_RICH_MENU_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="${ROUTINE_RICH_MENU_WIDTH}" height="${ROUTINE_RICH_MENU_HEIGHT}" viewBox="0 0 ${ROUTINE_RICH_MENU_WIDTH} ${ROUTINE_RICH_MENU_HEIGHT}">
  <rect width="2500" height="843" fill="#0f2747"/>
  <rect x="1660" y="0" width="840" height="843" fill="#123b63" opacity="0.75"/>
  <path d="M1660 0H2500V843H2040L1660 463Z" fill="#174f76" opacity="0.52"/>
  <path d="M1660 0H2500" stroke="#67e8f9" stroke-width="8" opacity="0.7"/>
  <circle cx="470" cy="421.5" r="170" fill="#123b63" stroke="#67e8f9" stroke-width="8"/>
  <path d="M385 423L443 481L560 350" fill="none" stroke="#ecfeff" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="760" y="322" fill="#bae6fd" font-family="Tahoma, Leelawadee UI, sans-serif" font-size="36" font-weight="700" letter-spacing="4">NHF ROUTINE</text>
  <text x="760" y="465" fill="#ffffff" font-family="Tahoma, Leelawadee UI, sans-serif" font-size="112" font-weight="700">งานของฉัน</text>
  <text x="766" y="552" fill="#dbeafe" font-family="Tahoma, Leelawadee UI, sans-serif" font-size="46" font-weight="400">ดูงาน Routine ที่ได้รับมอบหมาย</text>
  <path d="M2165 376L2250 461L2165 546" fill="none" stroke="#ecfeff" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

export async function generateRoutineRichMenuAsset(): Promise<void> {
    await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
    await sharp(Buffer.from(ROUTINE_RICH_MENU_SVG, "utf8"))
        .png({ compressionLevel: 9 })
        .toFile(OUTPUT_PATH);

    console.log(`Generated ${OUTPUT_PATH}`);
}

const scriptPath = process.argv[1];
if (scriptPath && import.meta.url === pathToFileURL(path.resolve(scriptPath)).href) {
    void generateRoutineRichMenuAsset().catch((error: unknown) => {
        console.error(
            error instanceof Error ? error.message : "Rich Menu asset generation failed",
        );
        process.exitCode = 1;
    });
}
