/* eslint-disable no-console -- Operational Rich Menu CLI intentionally reports status to stdout. */
import path from "node:path";
import { pathToFileURL } from "node:url";

import { loadEnvConfig } from "@next/env";

import {
    getNhfRichMenuStatus,
    provisionNhfRichMenu,
    RichMenuProvisioningError,
    type NhfRichMenuProvisionResult,
    type NhfRichMenuStatus,
} from "../lib/line/rich-menu";

function yesNo(value: boolean): string {
    return value ? "yes" : "no";
}

function printProvisioningPlan(result: NhfRichMenuProvisionResult): void {
    console.log("NHFapp LINE Rich Menu plan");
    console.log(`  Stock LIFF URL: ${result.liffUrls.stock}`);
    console.log(`  Leave LIFF URL: ${result.liffUrls.leave}`);
    console.log(`  Routine LIFF URL: ${result.liffUrls.routine}`);
    console.log(`  Image: ${result.imagePath}`);
    console.log(
        `  Image details: ${result.image.width}x${result.image.height}, ${result.image.format.toUpperCase()}, ${result.image.bytes} bytes`,
    );
    console.log(
        `  Modules: stock=${result.modules.stock.status}, leave=${result.modules.leave.status}, routine=${result.modules.routine.status}`,
    );
    console.log("  Areas: three equal mobile destinations → Stock | Leave | Routine");
}

function printStatus(status: NhfRichMenuStatus): void {
    console.log("NHFapp LINE configuration (unified Rich Menu)");
    console.log(`  LIFF ID configured: ${yesNo(status.liffIdConfigured)}`);
    console.log(`  Login channel configured: ${yesNo(status.loginChannelConfigured)}`);
    console.log(
        `  Messaging API access token configured: ${yesNo(status.channelAccessTokenConfigured)}`,
    );
    console.log(`  Messaging API channel secret configured: ${yesNo(status.channelSecretConfigured)}`);
    console.log(`  LIFF session secret configured: ${yesNo(status.sessionSecretConfigured)}`);
    console.log(`  LIFF session TTL configured: ${yesNo(status.sessionTtlConfigured)}`);
    console.log(`  LIFF session configuration valid: ${yesNo(status.sessionConfigValid)}`);
    console.log(`  Stock module: ${status.modules.stock.status}`);
    console.log(`  Leave module: ${status.modules.leave.status}`);
    console.log(`  Routine module: ${status.modules.routine.status}`);
    console.log(`  Stock LIFF URL: ${status.liffUrls?.stock ?? "not available"}`);
    console.log(`  Leave LIFF URL: ${status.liffUrls?.leave ?? "not available"}`);
    console.log(`  Routine LIFF URL: ${status.liffUrls?.routine ?? "not available"}`);

    switch (status.defaultRichMenuStatus) {
        case "configured":
            console.log(`  Messaging API default richMenuId: ${status.defaultRichMenuId}`);
            break;
        case "not-set":
            console.log("  Messaging API default richMenuId: not set");
            break;
        case "managed-elsewhere":
            console.log(
                "  Messaging API default richMenuId: managed by another LINE channel or OA Manager",
            );
            break;
        default:
            console.log(
                `  Messaging API default richMenuId: unavailable (${status.defaultRichMenuError ?? "unknown error"})`,
            );
            break;
    }
}

function printProvisioningError(error: unknown): void {
    if (!(error instanceof RichMenuProvisioningError)) {
        console.error("Rich Menu provisioning failed.");
        return;
    }

    console.error(`Rich Menu provisioning failed during ${error.phase}.`);
    console.error(`Reason: ${error.message}`);
    if (error.richMenuId) {
        console.error(`Created richMenuId: ${error.richMenuId}`);
        if (error.phase === "upload") {
            console.error("The new menu was NOT set as default. Existing default was not changed.");
        } else if (error.phase === "set-default") {
            console.error("The new menu may not be the default. Check the status command before retrying.");
        } else if (error.phase === "verify") {
            console.error("The default may have changed. Check the status command before retrying.");
        }
    }
}

async function runProvision(apply: boolean): Promise<void> {
    const result = await provisionNhfRichMenu({ apply });
    printProvisioningPlan(result);

    if (!apply) {
        console.log("Dry-run only. No LINE API request was made.");
        return;
    }

    console.log(`Created and set default richMenuId: ${result.richMenuId}`);
    console.log(`Verified default richMenuId: ${result.verifiedDefaultRichMenuId}`);
}

async function runStatus(): Promise<void> {
    printStatus(await getNhfRichMenuStatus());
}

function printUsage(): void {
    console.log("Usage:");
    console.log("  npm run line:richmenu:status");
    console.log("  npm run line:richmenu:provision");
    console.log("  npm run line:richmenu:provision -- --apply");
}

export function loadNhfRichMenuEnvironment(): void {
    loadEnvConfig(process.cwd(), process.env.NODE_ENV === "development");
}

export async function runNhfRichMenuCli(args: string[]): Promise<number> {
    const command = args[0] ?? "help";
    try {
        if (command === "status") {
            await runStatus();
            return 0;
        }
        if (command === "provision") {
            await runProvision(args.includes("--apply"));
            return 0;
        }

        printUsage();
        return command === "help" ? 0 : 1;
    } catch (error) {
        printProvisioningError(error);
        return 1;
    }
}

const scriptPath = process.argv[1];
if (scriptPath && import.meta.url === pathToFileURL(path.resolve(scriptPath)).href) {
    loadNhfRichMenuEnvironment();
    void runNhfRichMenuCli(process.argv.slice(2)).then((exitCode) => {
        process.exitCode = exitCode;
    });
}
