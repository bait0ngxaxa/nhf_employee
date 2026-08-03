import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { prisma } from "@/lib/db/prisma";

import { parseRoutineImportManifest, parseRoutineOwnerMapping } from "./validation";
import {
    assertRoutineImportManifestMatchesWorkbook,
    buildRoutineImportManifest,
    readRoutineWorkbook,
} from "./workbook";
import type {
    RoutineImportManifest,
    RoutineImportOwnerMapping,
    RoutineImportReferenceData,
} from "./types";

export async function loadRoutineImportReferenceData(): Promise<RoutineImportReferenceData> {
    const [units, categories, employees] = await Promise.all([
        prisma.routineUnit.findMany({
            select: { id: true, code: true, name: true, isActive: true },
            orderBy: { code: "asc" },
        }),
        prisma.routineCategory.findMany({
            select: { id: true, name: true, sortOrder: true, isActive: true },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        }),
        prisma.employee.findMany({
            select: {
                id: true,
                firstName: true,
                lastName: true,
                nickname: true,
                status: true,
                deletedAt: true,
            },
            orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        }),
    ]);
    return {
        units,
        categories,
        employees: employees.map((employee) => ({
            ...employee,
            status: employee.status.toString(),
            deletedAt: employee.deletedAt?.toISOString() ?? null,
        })),
    };
}

export async function readJsonFile(path: string): Promise<unknown> {
    const content = await readFile(path, "utf8");
    return JSON.parse(content) as unknown;
}

export async function loadRoutineOwnerMapping(
    path: string | null,
): Promise<RoutineImportOwnerMapping> {
    if (!path) return {};
    return parseRoutineOwnerMapping(await readJsonFile(path));
}

export async function buildRoutineImportManifestFromFile(
    filePath: string,
    asOfDate: string,
    ownerMapping: RoutineImportOwnerMapping,
    referenceData: RoutineImportReferenceData,
    generatedAt = new Date().toISOString(),
): Promise<RoutineImportManifest> {
    const buffer = await readFile(filePath);
    const sourceSha256 = createHash("sha256").update(buffer).digest("hex");
    const workbook = readRoutineWorkbook(buffer);
    return buildRoutineImportManifest(
        workbook,
        filePath,
        sourceSha256,
        asOfDate,
        ownerMapping,
        referenceData,
        generatedAt,
    );
}

export async function loadRoutineImportManifest(
    path: string,
): Promise<RoutineImportManifest> {
    return parseRoutineImportManifest(await readJsonFile(path));
}

export async function verifyRoutineImportManifestSource(
    manifest: RoutineImportManifest,
    filePath: string,
): Promise<void> {
    const buffer = await readFile(filePath);
    const sourceSha256 = createHash("sha256").update(buffer).digest("hex");
    if (sourceSha256 !== manifest.sourceSha256) {
        throw new Error("workbook hash ไม่ตรงกับ manifest");
    }
    assertRoutineImportManifestMatchesWorkbook(
        manifest,
        readRoutineWorkbook(buffer),
        filePath,
    );
}
