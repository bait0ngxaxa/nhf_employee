/* Compatibility entry point for the former Routine-only Rich Menu command. */
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
    loadNhfRichMenuEnvironment,
    runNhfRichMenuCli,
} from "./line-rich-menu";

export const loadRoutineRichMenuEnvironment = loadNhfRichMenuEnvironment;
export const runRoutineRichMenuCli = runNhfRichMenuCli;

const scriptPath = process.argv[1];
if (scriptPath && import.meta.url === pathToFileURL(path.resolve(scriptPath)).href) {
    loadRoutineRichMenuEnvironment();
    void runRoutineRichMenuCli(process.argv.slice(2)).then((exitCode) => {
        process.exitCode = exitCode;
    });
}
