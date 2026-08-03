/* eslint-disable no-console -- This one-time CLI intentionally reports to stdout. */
import { writeFile } from "node:fs/promises";

import { prisma } from "../lib/db/prisma";
import {
    applyRoutineImportManifest,
    buildRoutineImportManifestFromFile,
    loadRoutineImportManifest,
    loadRoutineImportReferenceData,
    loadRoutineOwnerMapping,
    verifyRoutineImportManifestSource,
} from "../lib/services/routine-import";
import { getCurrentBangkokDate } from "../lib/routine/schedule";
import type { RoutineCommandActor } from "../lib/services/routine/types";
import type { RoutineImportApplyResult, RoutineImportManifest } from "../lib/services/routine-import/types";

type ImportOptions = {
    apply: boolean;
    preview: boolean;
    filePath: string | null;
    manifestPath: string | null;
    reportPath: string | null;
    ownerMappingPath: string | null;
    asOfDate: string;
    adminUserId: number | null;
    json: boolean;
};

function optionValue(args: readonly string[], name: string): string | null {
    const prefix = `${name}=`;
    const value = args.find((argument) => argument.startsWith(prefix));
    return value ? value.slice(prefix.length) : null;
}

function parseOptions(args: readonly string[]): ImportOptions {
    const adminUserId = optionValue(args, "--admin-user-id");
    return {
        apply: args.includes("--apply"),
        preview: args.includes("--preview"),
        filePath: optionValue(args, "--file"),
        manifestPath: optionValue(args, "--manifest"),
        reportPath: optionValue(args, "--report"),
        ownerMappingPath: optionValue(args, "--owner-mapping"),
        asOfDate: optionValue(args, "--as-of") ?? getCurrentBangkokDate(),
        adminUserId: adminUserId ? Number(adminUserId) : null,
        json: args.includes("--json"),
    };
}

function requireValue(value: string | null, optionName: string): string {
    if (!value) throw new Error(`กรุณาระบุ ${optionName}`);
    return value;
}

async function writeJson(path: string, value: unknown): Promise<void> {
    await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function loadAdminActor(userId: number): Promise<RoutineCommandActor> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, role: true },
    });
    if (!user) throw new Error("ไม่พบผู้ใช้สำหรับ apply manifest");
    return {
        id: user.id,
        email: user.email,
        role: user.role,
    };
}

function printPreview(manifest: RoutineImportManifest): void {
    console.log("NHF Routine Excel import preview (ไม่เขียนฐานข้อมูล)");
    console.log(`ไฟล์: ${manifest.sourceFileName}`);
    console.log(`ตรวจ ณ วันที่: ${manifest.asOfDate}`);
    console.table([manifest.summary]);
    console.log("\nWorkbook inspection");
    console.table(
        manifest.inspection.sheets.map((sheet) => ({
            sheet: sheet.sheetName,
            range: sheet.range,
            headers: sheet.headerRows.join(", "),
            merged: sheet.mergedRegions.length,
            blankRows: sheet.blankRows.length,
            repeatedHeaders: sheet.repeatedHeaderRows.length,
            categories: sheet.categoryRows.length,
            dataRows: sheet.dataRows.length,
            formulas: sheet.formulaCells.length,
            numericDates: sheet.numericDateCells.length,
            stringDates: sheet.stringDateCells.length,
        })),
    );
    console.log("\nRows requiring Admin review");
    console.table(
        manifest.rows
            .filter((row) => row.requiresReview)
            .map((row) => ({
                sheet: row.sourceSheet,
                row: row.sourceRow,
                title: row.title,
                owners: row.ownerNames.join(", "),
                mapped: row.mappedEmployeeNames.join(", "),
                schedule: row.scheduleText,
                contract: row.contractText,
                proposed: row.proposedActivation,
                reasons: row.reviewReasons.join(", "),
            })),
    );
}

function printApply(result: RoutineImportApplyResult): void {
    console.log("NHF Routine Excel import apply");
    console.table([{
        inserted: result.inserted,
        skipped: result.skipped,
        conflicts: result.conflicts,
        failed: result.failed,
        historyOnly: result.historyOnly,
        inactive: result.inactive,
    }]);
    if (result.errors.length > 0) {
        console.log("\nRows ที่ apply ไม่สำเร็จ");
        console.table(result.errors);
    }
}

async function runPreview(options: ImportOptions): Promise<void> {
    const filePath = requireValue(options.filePath, "--file=<path>");
    const referenceData = await loadRoutineImportReferenceData();
    const ownerMapping = await loadRoutineOwnerMapping(options.ownerMappingPath);
    const manifest = await buildRoutineImportManifestFromFile(
        filePath,
        options.asOfDate,
        ownerMapping,
        referenceData,
    );
    if (options.manifestPath) await writeJson(options.manifestPath, manifest);
    if (options.reportPath) await writeJson(options.reportPath, manifest);
    if (options.json) {
        console.log(JSON.stringify(manifest, null, 2));
    } else {
        printPreview(manifest);
    }
}

async function runApply(options: ImportOptions): Promise<void> {
    const manifestPath = requireValue(options.manifestPath, "--manifest=<path>");
    const manifest = await loadRoutineImportManifest(manifestPath);
    if (options.filePath) {
        await verifyRoutineImportManifestSource(manifest, options.filePath);
    }
    if (options.adminUserId === null || !Number.isInteger(options.adminUserId)) {
        throw new Error("การ apply ต้องระบุ --admin-user-id=<id>");
    }
    const actor = await loadAdminActor(options.adminUserId);
    const result = await applyRoutineImportManifest(manifest, actor);
    if (options.reportPath) await writeJson(options.reportPath, { manifest, result });
    if (options.json) {
        console.log(JSON.stringify(result, null, 2));
    } else {
        printApply(result);
    }
    if (result.failed > 0 || result.conflicts > 0) process.exitCode = 2;
}

async function main(): Promise<void> {
    const options = parseOptions(process.argv.slice(2));
    if (options.apply && options.preview) {
        throw new Error("เลือก --preview หรือ --apply อย่างใดอย่างหนึ่ง");
    }
    if (options.apply) {
        await runApply(options);
        return;
    }
    await runPreview(options);
}

async function run(): Promise<void> {
    try {
        await main();
    } catch (error: unknown) {
        console.error(
            "Routine import ทำงานไม่สำเร็จ:",
            error instanceof Error ? error.message : "ไม่ทราบสาเหตุ",
        );
        process.exitCode = 1;
    } finally {
        await prisma.$disconnect();
    }
}

void run();
