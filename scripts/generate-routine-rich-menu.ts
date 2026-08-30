/* Compatibility entry point for operators who used the Routine-only command. */
import path from "node:path";
import { pathToFileURL } from "node:url";

import { generateNhfRichMenuAsset } from "./generate-nhf-rich-menu";

export const generateRoutineRichMenuAsset = generateNhfRichMenuAsset;

const scriptPath = process.argv[1];
if (scriptPath && import.meta.url === pathToFileURL(path.resolve(scriptPath)).href) {
    void generateRoutineRichMenuAsset().catch((error: unknown) => {
        console.error(
            error instanceof Error ? error.message : "Rich Menu asset generation failed",
        );
        process.exitCode = 1;
    });
}
