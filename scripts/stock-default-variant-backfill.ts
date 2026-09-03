/* eslint-disable no-console -- This migration CLI intentionally reports to stdout. */
import { prisma } from "../lib/db/prisma";
import {
    applyDefaultVariantBackfill,
    loadDefaultVariantBackfillReport,
    type DefaultVariantBackfillApplyResult,
    type DefaultVariantBackfillReport,
    assertDefaultVariantApplyAuthorized,
    assertDefaultVariantReportSafeForApply,
    getDefaultVariantDatabaseTarget,
} from "../modules/stock";

type BackfillOptions = {
    apply: boolean;
    json: boolean;
    allowProduction: boolean;
    acknowledgeDataWrite: boolean;
    confirmedDatabaseName: string | null;
};

type BackfillRunResult = {
    mode: "DRY_RUN" | "APPLY";
    databaseName: string;
    before: DefaultVariantBackfillReport;
    applyResult: DefaultVariantBackfillApplyResult | null;
    after: DefaultVariantBackfillReport | null;
};

function parseOptions(args: string[]): BackfillOptions {
    const confirmation = args.find((arg) =>
        arg.startsWith("--confirm-database="),
    );

    return {
        apply: args.includes("--apply"),
        json: args.includes("--json"),
        allowProduction: args.includes("--allow-production"),
        acknowledgeDataWrite: args.includes("--acknowledge-data-write"),
        confirmedDatabaseName: confirmation?.slice(
            "--confirm-database=".length,
        ) || null,
    };
}

function printReport(
    title: string,
    report: DefaultVariantBackfillReport,
): void {
    console.log(`\n${title}`);
    console.table(
        Object.entries(report.summary).map(([check, count]) => ({
            check,
            count,
        })),
    );
    if (report.details.length > 0) {
        console.table(report.details);
    }
}

function printTerminalResult(result: BackfillRunResult): void {
    console.log("Stock explicit default variant backfill");
    console.log(`Mode: ${result.mode}`);
    console.log(`Database: ${result.databaseName}`);
    printReport("Before", result.before);

    if (result.applyResult) {
        console.log("\nApply result");
        console.table([result.applyResult]);
    }
    if (result.after) {
        printReport("After / shadow comparison", result.after);
    }
}

async function main(): Promise<void> {
    const options = parseOptions(process.argv.slice(2));
    const target = getDefaultVariantDatabaseTarget(process.env.DATABASE_URL);
    assertDefaultVariantApplyAuthorized(options, target);

    const before = await loadDefaultVariantBackfillReport();
    if (options.apply) {
        assertDefaultVariantReportSafeForApply(before);
    }
    const applyResult = options.apply
        ? await applyDefaultVariantBackfill(before.candidateItemIds)
        : null;
    const after = options.apply
        ? await loadDefaultVariantBackfillReport()
        : null;
    const result: BackfillRunResult = {
        mode: options.apply ? "APPLY" : "DRY_RUN",
        databaseName: target.databaseName,
        before,
        applyResult,
        after,
    };

    if (options.json) {
        console.log(JSON.stringify(result, null, 2));
    } else {
        printTerminalResult(result);
    }
}

async function run(): Promise<void> {
    try {
        await main();
    } catch (error: unknown) {
        console.error(
            "Stock default variant backfill ทำงานไม่สำเร็จ:",
            error instanceof Error ? error.message : "Unknown error",
        );
        process.exitCode = 1;
    } finally {
        await prisma.$disconnect();
    }
}

void run();
