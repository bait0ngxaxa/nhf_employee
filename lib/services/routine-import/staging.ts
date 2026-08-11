import { basename } from "node:path";
import { createHash } from "node:crypto";

import type {
    Prisma,
    RoutineImportBatchStatus,
    RoutineImportRowStatus,
    RoutineImportRow as PrismaRoutineImportRow,
} from "@prisma/client";
import * as XLSX from "xlsx";

import { runSerializableTransaction } from "@/lib/db/transaction";
import { prisma } from "@/lib/db/prisma";
import {
    calendarDateToDate,
    getCurrentBangkokDate,
    isCalendarDate,
    toBangkokCalendarDate,
} from "@/lib/routine/schedule";
import { isRoutineNotificationReady } from "@/lib/routine/notification-readiness";
import { assertActiveAdminInTransaction } from "@/lib/services/routine/authorization";
import { createRoutineTaskInTransaction } from "@/lib/services/routine/mutations";
import type { RoutineCommandActor } from "@/lib/services/routine/types";
import {
    RoutineConflictError,
    RoutineNotFoundError,
    RoutineValidationError,
} from "@/lib/services/routine/errors";
import {
    parseRoutineScheduleConfig,
    routineTaskCreateSchema,
    type RoutineTaskCreateInput,
} from "@/lib/validations/routine";
import type { RoutineImportRowUpdateInput } from "@/lib/validations/routine-import";

import {
    ROUTINE_IMPORT_PLACEHOLDER_TITLES,
    ROUTINE_IMPORT_REVIEW_REASONS,
} from "./constants";
import {
    buildExactRoutineOwnerMapping,
    resolveRoutineOwners,
} from "./owner-mapping";
import {
    buildRoutineImportManifest,
    readRoutineWorkbook,
} from "./workbook";
import {
    buildRoutineImportTaskInput,
} from "./apply";
import {
    ROUTINE_IMPORT_BATCH_TTL_DAYS,
    ROUTINE_IMPORT_MAX_COLUMNS,
    ROUTINE_IMPORT_MAX_FILE_BYTES,
    ROUTINE_IMPORT_MAX_ROWS,
    ROUTINE_IMPORT_TARGET_SHEET,
    ROUTINE_IMPORT_TARGET_UNIT_CODE,
    buildRoutineImportSourceKey,
    getRoutineImportSheetScope,
} from "./sheet-config";
import { getRoutineXlsxContainerIssue } from "./xlsx-safety";
import {
    parseRoutineImportRow,
} from "./validation";
import type {
    RoutineImportJsonObject,
    RoutineImportManifest,
    RoutineImportReferenceData,
    RoutineImportRow,
} from "./types";

const ALLOWED_EXTENSIONS = new Set([".xls", ".xlsx"]);
const ALLOWED_MIME_TYPES = new Set([
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/octet-stream",
]);
const OLE_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04];
const ROUTINE_IMPORT_PAGE_LIMIT = 50;
const ROUTINE_IMPORT_APPLY_MAX_WAIT_MS = 5_000;
const ROUTINE_IMPORT_APPLY_TIMEOUT_MS = 30_000;
const REUSABLE_BATCH_STATUSES: RoutineImportBatchStatus[] = [
    "READY",
    "PREVIEW",
    "APPLYING",
];

export type { RoutineImportRowUpdateInput } from "@/lib/validations/routine-import";

export interface RoutineImportRowsFilter {
    page: number;
    limit: number;
    status?: RoutineImportRowStatus;
    selected?: boolean;
    issue?: "UNRESOLVED_OWNER";
    search?: string;
}

export interface RoutineImportBatchView {
    id: number;
    originalFileName: string;
    fileHashPrefix: string;
    targetSheet: string;
    ignoredSheetNames: string[];
    asOfDate: string;
    status: RoutineImportBatchStatus;
    uploadedBy: { id: number; name: string };
    totalRows: number;
    validRows: number;
    reviewRows: number;
    excludedRows: number;
    alreadyImportedRows: number;
    appliedRows: number;
    conflictRows: number;
    failedRows: number;
    selectedRows: number;
    selectedValidRows: number;
    unresolvedOwnerRows: number;
    expiresAt: string | null;
    appliedAt: string | null;
    errorMessage: string | null;
    version: number;
    createdAt: string;
    updatedAt: string;
}

export interface RoutineImportRowView {
    id: number;
    sourceKey: string;
    sourceSheet: string;
    sourceRow: number;
    sourceFingerprint: string;
    status: RoutineImportRowStatus;
    selected: boolean;
    proposedActivation: "ACTIVE";
    reviewReasons: string[];
    appliedTaskId: number | null;
    version: number;
    data: RoutineImportRow;
}

export interface RoutineImportRowsPage {
    rows: RoutineImportRowView[];
    pagination: { page: number; limit: number; total: number; pages: number };
}

export interface RoutineImportApplyView {
    batch: RoutineImportBatchView;
    idempotent: boolean;
    importedTaskIds: number[];
    importedRowIds: number[];
    importedCount: number;
    skippedCount: number;
    appliedBy: {
        userId: number;
        email: string;
    };
}

type StoredBatch = Prisma.RoutineImportBatchGetPayload<{
    include: { uploadedBy: { select: { id: true; name: true } } };
}>;

type StoredRow = PrismaRoutineImportRow;

function hasPrefix(bytes: Uint8Array, prefix: readonly number[]): boolean {
    return prefix.every((value, index) => bytes[index] === value);
}

function safeFileName(value: string): string {
    const trimmed = value.trim();
    const fileName = basename(trimmed);
    if (
        !fileName
        || fileName !== trimmed
        || trimmed.includes("/")
        || trimmed.includes("\\")
        || fileName.includes("..")
    ) {
        throw new RoutineValidationError("ชื่อไฟล์ไม่ถูกต้อง");
    }
    return fileName;
}

function assertFileSignature(fileName: string, bytes: Uint8Array): void {
    const extension = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
    if (extension === ".xls" && !hasPrefix(bytes, OLE_SIGNATURE)) {
        throw new RoutineValidationError("ไฟล์ .xls ไม่ใช่ไฟล์ Excel ที่ถูกต้อง");
    }
    if (extension === ".xlsx") {
        if (!hasPrefix(bytes, ZIP_SIGNATURE)) {
            throw new RoutineValidationError("ไฟล์ .xlsx ไม่ใช่ไฟล์ Excel ที่ถูกต้อง");
        }
        const containerIssue = getRoutineXlsxContainerIssue(bytes);
        if (containerIssue) throw new RoutineValidationError(containerIssue);
    }
}

function assertWorkbookSize(workbook: XLSX.WorkBook, manifest: RoutineImportManifest): void {
    const targetInspection = manifest.inspection.sheets.find(
        (sheet) => sheet.sheetName === ROUTINE_IMPORT_TARGET_SHEET,
    );
    if (!targetInspection) {
        throw new RoutineValidationError("ไม่พบโครงสร้างของชีต มสช.");
    }
    if (targetInspection.dataRows.length > ROUTINE_IMPORT_MAX_ROWS) {
        throw new RoutineValidationError("ไฟล์มีจำนวนแถวเกินขีดจำกัดที่รองรับ");
    }

    const targetWorksheet = workbook.Sheets[ROUTINE_IMPORT_TARGET_SHEET];
    const range = targetWorksheet?.["!ref"] as string | undefined;
    if (!range) return;
    const decoded = XLSX.utils.decode_range(range);
    if (decoded.e.c - decoded.s.c + 1 > ROUTINE_IMPORT_MAX_COLUMNS) {
        throw new RoutineValidationError("ไฟล์มีจำนวนคอลัมน์เกินขีดจำกัดที่รองรับ");
    }
}

function parseWorkbookBytes(
    fileName: string,
    bytes: Uint8Array,
): XLSX.WorkBook {
    try {
        assertFileSignature(fileName, bytes);
        return readRoutineWorkbook(bytes);
    } catch (error) {
        if (error instanceof RoutineValidationError) throw error;
        throw new RoutineValidationError(
            "ไม่สามารถเปิดไฟล์ Excel ได้ กรุณาตรวจว่าไฟล์ไม่ถูกเข้ารหัสหรือเสียหาย",
        );
    }
}

async function readUploadFile(file: File): Promise<{
    fileName: string;
    bytes: Uint8Array;
    hash: string;
}> {
    const fileName = safeFileName(file.name);
    const extension = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(extension)) {
        throw new RoutineValidationError("รองรับเฉพาะไฟล์ .xls หรือ .xlsx");
    }
    if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
        throw new RoutineValidationError("ชนิดไฟล์ไม่ตรงกับไฟล์ Excel ที่รองรับ");
    }
    if (file.size <= 0 || file.size > ROUTINE_IMPORT_MAX_FILE_BYTES) {
        throw new RoutineValidationError("ไฟล์ต้องมีขนาดไม่เกิน 10 MB");
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.length === 0 || bytes.length > ROUTINE_IMPORT_MAX_FILE_BYTES) {
        throw new RoutineValidationError("ไฟล์ต้องมีขนาดไม่เกิน 10 MB");
    }
    return {
        fileName,
        bytes,
        hash: createHash("sha256").update(bytes).digest("hex"),
    };
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function stringArray(value: Prisma.JsonValue | null): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === "string");
}

function getBatchView(
    batch: StoredBatch,
    selectedValidRows: number,
): RoutineImportBatchView {
    return {
        id: batch.id,
        originalFileName: batch.originalFileName,
        fileHashPrefix: `${batch.fileHash.slice(0, 12)}…`,
        targetSheet: batch.targetSheet,
        ignoredSheetNames: stringArray(batch.ignoredSheets),
        asOfDate: toBangkokCalendarDate(batch.asOfDate),
        status: batch.status,
        uploadedBy: batch.uploadedBy,
        totalRows: batch.totalRows,
        validRows: batch.validRows,
        reviewRows: batch.reviewRows,
        excludedRows: batch.excludedRows,
        alreadyImportedRows: batch.alreadyImportedRows,
        appliedRows: batch.appliedRows,
        conflictRows: batch.conflictRows,
        failedRows: batch.failedRows,
        selectedRows: batch.selectedRows,
        selectedValidRows,
        unresolvedOwnerRows: batch.unresolvedOwnerRows,
        expiresAt: batch.expiresAt?.toISOString() ?? null,
        appliedAt: batch.appliedAt?.toISOString() ?? null,
        errorMessage: batch.errorMessage,
        version: batch.version,
        createdAt: batch.createdAt.toISOString(),
        updatedAt: batch.updatedAt.toISOString(),
    };
}

function getRowView(row: StoredRow): RoutineImportRowView {
    return {
        id: row.id,
        sourceKey: row.sourceKey,
        sourceSheet: row.sourceSheet,
        sourceRow: row.sourceRow,
        sourceFingerprint: row.sourceFingerprint,
        status: row.status,
        selected: row.selected,
        proposedActivation: row.proposedActivation,
        reviewReasons: stringArray(row.reviewReasons),
        appliedTaskId: row.appliedTaskId,
        version: row.version,
        data: parseRoutineImportRow(row.normalizedData),
    };
}

function addReason(reasons: string[], reason: string): void {
    if (!reasons.includes(reason)) reasons.push(reason);
}

function initialRowStatus(
    row: RoutineImportRow,
): { status: RoutineImportRowStatus; selected: boolean } {
    if (row.requiresReview) {
        return { status: "REQUIRES_REVIEW", selected: true };
    }
    return { status: "VALID", selected: true };
}

function mapEmployeeNames(
    ids: readonly number[],
    referenceData: RoutineImportReferenceData,
): string[] {
    const employeesById = new Map(
        referenceData.employees.map((employee) => [employee.id, employee]),
    );
    return ids.flatMap((id) => {
        const employee = employeesById.get(id);
        if (!employee) return [`ไม่พบข้อมูลพนักงาน (ID: ${id})`];
        return [`${employee.firstName} ${employee.lastName}`.trim()];
    });
}

function withStagingDefaults(row: RoutineImportRow): RoutineImportRow {
    return {
        ...row,
        proposedActivation: "ACTIVE",
        mappedAssignees: row.mappedEmployeeIds.map((employeeId, index) => ({
            employeeId,
            role: index === 0 ? "OWNER" : "CO_OWNER",
        })),
        reminderRules: [],
    };
}

function addExactOwnerResolution(
    row: RoutineImportRow,
    referenceData: RoutineImportReferenceData,
): RoutineImportRow {
    const mapping = buildExactRoutineOwnerMapping(referenceData);
    const resolution = resolveRoutineOwners(row.ownerNames, mapping, referenceData);
    const reasons = row.reviewReasons.filter(
        (reason) => !reason.startsWith(ROUTINE_IMPORT_REVIEW_REASONS.OWNER_MAPPING_EMPLOYEE_NOT_FOUND)
            && !reason.startsWith(ROUTINE_IMPORT_REVIEW_REASONS.OWNER_MAPPING_EMPLOYEE_INACTIVE),
    );
    for (const reason of resolution.reviewReasons) addReason(reasons, reason);
    const mappedEmployeeIds = resolution.mappedEmployeeIds;
    const next = withStagingDefaults({
        ...row,
        mappedEmployeeIds,
        mappedEmployeeNames: resolution.mappedEmployeeNames,
        reviewReasons: reasons,
        requiresReview: reasons.length > 0,
        proposedActivation: "ACTIVE",
    });
    return next;
}

function targetReferenceData(
    referenceData: RoutineImportReferenceData,
): RoutineImportReferenceData {
    if (referenceData.units.some((unit) => unit.code === ROUTINE_IMPORT_TARGET_UNIT_CODE)) {
        return referenceData;
    }
    return {
        ...referenceData,
        units: [
            ...referenceData.units,
            {
                id: 0,
                code: ROUTINE_IMPORT_TARGET_UNIT_CODE,
                name: ROUTINE_IMPORT_TARGET_SHEET,
                isActive: true,
            },
        ],
    };
}

function existingRowStatus(
    row: RoutineImportRow,
    ledgers: Array<{
        sourceRow: number;
        sourceFingerprint: string;
        status: string;
        taskId: number | null;
    }>,
    tasks: Array<{ sourceRow: number | null; id: number }>,
): RoutineImportRowStatus | null {
    const matchingLedgers = ledgers.filter((ledger) => ledger.sourceRow === row.sourceRow);
    const sameFingerprint = matchingLedgers.find(
        (ledger) => ledger.sourceFingerprint === row.sourceFingerprint,
    );
    if (sameFingerprint && sameFingerprint.status !== "CONFLICT") {
        return "ALREADY_IMPORTED";
    }
    if (matchingLedgers.length > 0 || tasks.some((task) => task.sourceRow === row.sourceRow)) {
        return "CONFLICT";
    }
    return null;
}

interface RoutineImportBatchCounts {
    totalRows: number;
    validRows: number;
    reviewRows: number;
    excludedRows: number;
    alreadyImportedRows: number;
    appliedRows: number;
    conflictRows: number;
    failedRows: number;
    selectedRows: number;
    unresolvedOwnerRows: number;
}

function hasReasonCode(value: Prisma.JsonValue | null, code: string): boolean {
    return stringArray(value).some(
        (reason) => reason === code || reason.startsWith(`${code}:`),
    );
}

function recalculateBatchCounts(
    rows: Array<{
        status: RoutineImportRowStatus;
        selected: boolean;
        reviewReasons: Prisma.JsonValue | null;
    }>,
): RoutineImportBatchCounts {
    return {
        totalRows: rows.length,
        validRows: rows.filter((row) => row.status === "VALID").length,
        reviewRows: rows.filter((row) => row.status === "REQUIRES_REVIEW").length,
        excludedRows: rows.filter((row) => row.status === "EXCLUDED").length,
        alreadyImportedRows: rows.filter((row) => row.status === "ALREADY_IMPORTED").length,
        appliedRows: rows.filter((row) => row.status === "APPLIED").length,
        conflictRows: rows.filter((row) => row.status === "CONFLICT").length,
        failedRows: rows.filter((row) => row.status === "FAILED").length,
        selectedRows: rows.filter((row) => row.selected).length,
        unresolvedOwnerRows: rows.filter((row) => (
            hasReasonCode(row.reviewReasons, ROUTINE_IMPORT_REVIEW_REASONS.MISSING_OWNER)
            || hasReasonCode(row.reviewReasons, ROUTINE_IMPORT_REVIEW_REASONS.OWNER_MAPPING_EMPLOYEE_NOT_FOUND)
            || hasReasonCode(row.reviewReasons, ROUTINE_IMPORT_REVIEW_REASONS.OWNER_MAPPING_EMPLOYEE_INACTIVE)
        )).length,
    };
}

async function loadBatchOrThrow(
    batchId: number,
): Promise<StoredBatch> {
    const batch = await prisma.routineImportBatch.findUnique({
        where: { id: batchId },
        include: { uploadedBy: { select: { id: true, name: true } } },
    });
    if (!batch) throw new RoutineNotFoundError("ไม่พบรายการนำเข้า");
    return batch;
}

async function countSelectedValidRows(
    client: Pick<Prisma.TransactionClient, "routineImportRow">,
    batchId: number,
): Promise<number> {
    return client.routineImportRow.count({
        where: { batchId, selected: true, status: "VALID" },
    });
}

async function expireBatchIfNeeded(batch: StoredBatch): Promise<StoredBatch> {
    if (
        (batch.status !== "READY" && batch.status !== "PREVIEW")
        || !batch.expiresAt
        || batch.expiresAt.getTime() > Date.now()
    ) {
        return batch;
    }
    const updated = await prisma.routineImportBatch.update({
        where: { id: batch.id },
        data: { status: "EXPIRED" },
        include: { uploadedBy: { select: { id: true, name: true } } },
    });
    return updated;
}

export async function createRoutineImportPreview(
    file: File,
    actor: RoutineCommandActor,
    asOfDate = getCurrentBangkokDate(),
): Promise<{ batch: RoutineImportBatchView; reusedExisting: boolean }> {
    const upload = await readUploadFile(file);
    const workbook = parseWorkbookBytes(upload.fileName, upload.bytes);
    let scope: ReturnType<typeof getRoutineImportSheetScope>;
    try {
        scope = getRoutineImportSheetScope(workbook.SheetNames);
    } catch (error) {
        throw new RoutineValidationError(
            error instanceof Error ? error.message : "ไม่พบชีต มสช. ในไฟล์ Excel",
        );
    }
    const referenceData = targetReferenceData(
        await loadRoutineReferenceDataForImport(),
    );
    const manifest = buildRoutineImportManifest(
        workbook,
        upload.fileName,
        upload.hash,
        asOfDate,
        {},
        referenceData,
        new Date().toISOString(),
        { includeSheets: [scope.targetSheet] },
    );
    const rows = manifest.rows.map((row) => addExactOwnerResolution(row, referenceData));
    assertWorkbookSize(workbook, { ...manifest, rows });

    const existingBatch = await prisma.routineImportBatch.findFirst({
        where: {
            fileHash: upload.hash,
            targetSheet: scope.targetSheet,
            status: { in: REUSABLE_BATCH_STATUSES },
        },
        orderBy: { createdAt: "desc" },
        include: { uploadedBy: { select: { id: true, name: true } } },
    });
    if (existingBatch) {
        const selectedValidRows = await countSelectedValidRows(prisma, existingBatch.id);
        return {
            batch: getBatchView(existingBatch, selectedValidRows),
            reusedExisting: true,
        };
    }

    const created = await runSerializableTransaction(async (tx) => {
        const concurrentExisting = await tx.routineImportBatch.findFirst({
            where: {
                fileHash: upload.hash,
                targetSheet: scope.targetSheet,
                status: { in: REUSABLE_BATCH_STATUSES },
            },
            orderBy: { createdAt: "desc" },
            include: { uploadedBy: { select: { id: true, name: true } } },
        });
        if (concurrentExisting) return { id: concurrentExisting.id, reusedExisting: true };

        const sourceRows = rows.map((row) => row.sourceRow);
        const [ledgers, tasks] = await Promise.all([
            tx.routineImportLedger.findMany({
                where: {
                    sourceSheet: scope.targetSheet,
                    sourceRow: { in: sourceRows },
                },
                select: {
                    sourceRow: true,
                    sourceFingerprint: true,
                    status: true,
                    taskId: true,
                },
            }),
            tx.routineTask.findMany({
                where: {
                    sourceSheet: scope.targetSheet,
                    sourceRow: { in: sourceRows },
                },
                select: { sourceRow: true, id: true },
            }),
        ]);
        const stagedRows = rows.map((rawRow) => {
            const row = addExactOwnerResolution(rawRow, referenceData);
            const importedStatus = existingRowStatus(row, ledgers, tasks);
            const initial = initialRowStatus(row);
            const status = importedStatus ?? initial.status;
            const selected = importedStatus ? false : initial.selected;
            return {
                row,
                status,
                selected,
                proposedActivation: row.proposedActivation,
                reviewReasons: row.reviewReasons,
                rawData: {
                    sourceSheet: row.sourceSheet,
                    sourceRow: row.sourceRow,
                    sourceCells: row.sourceCells,
                    categorySourceText: row.categorySourceText,
                    ownerSourceText: row.ownerSourceText,
                    scheduleText: row.scheduleText,
                    contractText: row.contractText,
                    extraDetails: row.extraDetails,
                },
            };
        });
        const counts = recalculateBatchCounts(stagedRows);
        const expiresAt = new Date(
            Date.now() + ROUTINE_IMPORT_BATCH_TTL_DAYS * 24 * 60 * 60 * 1000,
        );
        const batch = await tx.routineImportBatch.create({
            data: {
                originalFileName: upload.fileName,
                fileHash: upload.hash,
                targetSheet: scope.targetSheet,
                asOfDate: calendarDateToDate(asOfDate),
                ignoredSheets: toPrismaJson(scope.ignoredSheetNames),
                status: "READY",
                uploadedById: actor.id,
                ...counts,
                expiresAt,
                rows: {
                    create: stagedRows.map(({ row, status, selected, rawData }) => ({
                        sourceSheet: row.sourceSheet,
                        sourceRow: row.sourceRow,
                        sourceKey: buildRoutineImportSourceKey(row.sourceSheet, row.sourceRow),
                        sourceFingerprint: row.sourceFingerprint,
                        categoryName: row.categoryName,
                        title: row.title,
                        ownerNamesText: row.ownerNames.join(", "),
                        rawData: toPrismaJson(rawData),
                        normalizedData: toPrismaJson(row),
                        status,
                        selected,
                        proposedActivation: row.proposedActivation,
                        reviewReasons: toPrismaJson(row.reviewReasons),
                    })),
                },
            },
            include: { uploadedBy: { select: { id: true, name: true } } },
        });
        await tx.auditLog.create({
            data: {
                action: "ROUTINE_IMPORT_UPLOAD",
                entityType: "RoutineImportBatch",
                entityId: batch.id,
                userId: actor.id,
                userEmail: actor.email,
                ipAddress: actor.ipAddress,
                userAgent: actor.userAgent,
                details: JSON.stringify({
                    batchId: batch.id,
                    fileName: upload.fileName,
                    fileHash: upload.hash,
                    targetSheet: scope.targetSheet,
                    totalRows: counts.totalRows,
                    ignoredSheetCount: scope.ignoredSheetNames.length,
                }),
            },
        });
        return { id: batch.id, reusedExisting: false };
    });

    const savedBatch = await loadBatchOrThrow(created.id);
    const selectedValidRows = await countSelectedValidRows(prisma, created.id);
    return {
        batch: getBatchView(savedBatch, selectedValidRows),
        reusedExisting: created.reusedExisting,
    };
}

async function loadRoutineReferenceDataForImport(): Promise<RoutineImportReferenceData> {
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
                departmentId: true,
                status: true,
                deletedAt: true,
                user: {
                    select: {
                        isActive: true,
                        deletedAt: true,
                    },
                },
            },
            orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        }),
    ]);
    return targetReferenceData({
        units,
        categories,
        employees: employees.map((employee) => ({
            id: employee.id,
            firstName: employee.firstName,
            lastName: employee.lastName,
            nickname: employee.nickname,
            departmentId: employee.departmentId,
            status: employee.status.toString(),
            deletedAt: employee.deletedAt?.toISOString() ?? null,
            notificationReady: isRoutineNotificationReady(employee),
        })),
    });
}

export async function getRoutineImportReferenceData(): Promise<RoutineImportReferenceData> {
    return loadRoutineReferenceDataForImport();
}

export async function getRoutineImportBatch(
    batchId: number,
): Promise<RoutineImportBatchView> {
    const batch = await expireBatchIfNeeded(await loadBatchOrThrow(batchId));
    const selectedValidRows = await countSelectedValidRows(prisma, batchId);
    return getBatchView(batch, selectedValidRows);
}

export async function getRoutineImportRows(
    batchId: number,
    filters: RoutineImportRowsFilter,
): Promise<RoutineImportRowsPage> {
    await getRoutineImportBatch(batchId);
    const search = filters.search?.trim();
    const where: Prisma.RoutineImportRowWhereInput = {
        batchId,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.selected === undefined ? {} : { selected: filters.selected }),
        ...(search
            ? {
                  OR: [
                      { title: { contains: search } },
                      { categoryName: { contains: search } },
                      { ownerNamesText: { contains: search } },
                  ],
              }
            : {}),
    };
    let rows: StoredRow[];
    let total: number;
    if (filters.issue) {
        const allRows = await prisma.routineImportRow.findMany({
            where,
            orderBy: { sourceRow: "asc" },
        });
        const filteredRows = allRows.filter((row) => {
            return hasReasonCode(row.reviewReasons, ROUTINE_IMPORT_REVIEW_REASONS.MISSING_OWNER)
                || hasReasonCode(row.reviewReasons, ROUTINE_IMPORT_REVIEW_REASONS.OWNER_MAPPING_EMPLOYEE_NOT_FOUND)
                || hasReasonCode(row.reviewReasons, ROUTINE_IMPORT_REVIEW_REASONS.OWNER_MAPPING_EMPLOYEE_INACTIVE);
        });
        total = filteredRows.length;
        const start = (filters.page - 1) * filters.limit;
        rows = filteredRows.slice(start, start + filters.limit);
    } else {
        const result = await Promise.all([
            prisma.routineImportRow.findMany({
                where,
                orderBy: { sourceRow: "asc" },
                skip: (filters.page - 1) * filters.limit,
                take: filters.limit,
            }),
            prisma.routineImportRow.count({ where }),
        ]);
        rows = result[0];
        total = result[1];
    }
    return {
        rows: rows.map(getRowView),
        pagination: {
            page: filters.page,
            limit: filters.limit,
            total,
            pages: Math.max(1, Math.ceil(total / filters.limit)),
        },
    };
}

function validateDate(value: string | null, label: string): void {
    if (value !== null && !isCalendarDate(value)) {
        throw new RoutineValidationError(`${label} ไม่ถูกต้อง`);
    }
}

function buildReviewReasons(
    input: RoutineImportRowUpdateInput,
    referenceData: RoutineImportReferenceData,
    employees: RoutineImportReferenceData["employees"],
): string[] {
    const reasons: string[] = [];
    const unit = referenceData.units.find(
        (candidate) => candidate.code === ROUTINE_IMPORT_TARGET_UNIT_CODE,
    );
    if (!unit) addReason(reasons, ROUTINE_IMPORT_REVIEW_REASONS.MISSING_UNIT);
    else if (!unit.isActive) addReason(reasons, ROUTINE_IMPORT_REVIEW_REASONS.INACTIVE_UNIT);
    const category = referenceData.categories.find(
        (candidate) => candidate.name === input.categoryName,
    );
    if (!category) addReason(reasons, ROUTINE_IMPORT_REVIEW_REASONS.MISSING_CATEGORY);
    else if (!category.isActive) addReason(reasons, ROUTINE_IMPORT_REVIEW_REASONS.INACTIVE_CATEGORY);

    if (input.mappedAssignees.length === 0) {
        addReason(reasons, ROUTINE_IMPORT_REVIEW_REASONS.MISSING_OWNER);
    }
    const ids = new Set<number>();
    let ownerCount = 0;
    for (const assignee of input.mappedAssignees) {
        if (ids.has(assignee.employeeId)) addReason(reasons, ROUTINE_IMPORT_REVIEW_REASONS.DUPLICATE_OWNER);
        ids.add(assignee.employeeId);
        if (assignee.role === "OWNER") ownerCount += 1;
        const employee = employees.find((candidate) => candidate.id === assignee.employeeId);
        if (!employee) addReason(reasons, `${ROUTINE_IMPORT_REVIEW_REASONS.OWNER_MAPPING_EMPLOYEE_NOT_FOUND}:${assignee.employeeId}`);
        else if (employee.status !== "ACTIVE" || employee.deletedAt !== null) {
            addReason(reasons, `${ROUTINE_IMPORT_REVIEW_REASONS.OWNER_MAPPING_EMPLOYEE_INACTIVE}:${assignee.employeeId}`);
        }
    }
    if (input.mappedAssignees.length > 0 && ownerCount !== 1) {
        addReason(reasons, ROUTINE_IMPORT_REVIEW_REASONS.INVALID_OWNER_ROLE);
    }
    validateDate(input.contractStartDate, "วันเริ่มสัญญา");
    validateDate(input.contractEndDate, "วันสิ้นสุดสัญญา");
    if (input.contractStartDate && input.contractEndDate && input.contractStartDate > input.contractEndDate) {
        addReason(reasons, ROUTINE_IMPORT_REVIEW_REASONS.INVALID_CONTRACT_DATE_RANGE);
    }
    if (ROUTINE_IMPORT_PLACEHOLDER_TITLES.has(input.title.trim())) {
        addReason(reasons, ROUTINE_IMPORT_REVIEW_REASONS.PLACEHOLDER_ROW);
    }
    return [...new Set(reasons)];
}

function buildUpdatedRow(
    current: RoutineImportRow,
    input: RoutineImportRowUpdateInput,
    referenceData: RoutineImportReferenceData,
): RoutineImportRow {
    const employees = referenceData.employees;
    let normalizedConfig: RoutineImportJsonObject;
    try {
        normalizedConfig = parseRoutineScheduleConfig(
            input.scheduleType,
            input.scheduleConfig,
        ) as RoutineImportJsonObject;
    } catch {
        throw new RoutineValidationError("กำหนดค่าตารางงานประจำไม่ถูกต้อง");
    }
    const reasons = buildReviewReasons(input, referenceData, employees);
    const mappedEmployeeIds = input.mappedAssignees.map((assignee) => assignee.employeeId);
    const mappedEmployeeNames = mapEmployeeNames(mappedEmployeeIds, referenceData);
    return {
        ...current,
        categoryName: input.categoryName,
        title: input.title.trim(),
        mappedEmployeeIds,
        mappedEmployeeNames,
        mappedAssignees: input.mappedAssignees,
        reminderRules: input.reminderRules ?? [],
        scheduleText: input.scheduleText?.trim() || null,
        normalizedSchedule: {
            scheduleType: input.scheduleType,
            scheduleConfig: normalizedConfig,
            businessDayPolicy: input.businessDayPolicy,
        },
        contractStartDate: input.contractStartDate,
        contractEndDate: input.contractEndDate,
        contractText: input.contractText?.trim() || null,
        extraDetails: input.extraDetails?.trim() || null,
        requiresReview: reasons.length > 0,
        reviewReasons: reasons,
        proposedActivation: "ACTIVE",
    };
}

function assertRowCanApply(row: RoutineImportRow): void {
    if (!row.requiresReview && row.reviewReasons.length === 0) return;
    throw new RoutineValidationError("มีรายการที่เลือกซึ่งยังต้องตรวจสอบให้เรียบร้อยก่อนนำเข้า");
}

interface PreparedRoutineImportRow {
    storedRow: StoredRow;
    taskInput: RoutineTaskCreateInput;
}

function rowAssignees(row: RoutineImportRow): Array<{
    employeeId: number;
    role: "OWNER" | "CO_OWNER";
}> {
    return row.mappedAssignees ?? row.mappedEmployeeIds.map((employeeId, index) => ({
        employeeId,
        role: index === 0 ? "OWNER" : "CO_OWNER",
    }));
}

async function prepareRowsForApplyInTransaction(
    tx: Prisma.TransactionClient,
    storedRows: StoredRow[],
): Promise<PreparedRoutineImportRow[]> {
    const parsedRows = storedRows.map((storedRow) => {
        if (storedRow.status !== "VALID") {
            throw new RoutineValidationError(
                "มีรายการที่เลือกซึ่งยังต้องตรวจสอบให้เรียบร้อยก่อนนำเข้า",
            );
        }
        if (stringArray(storedRow.reviewReasons).length > 0) {
            throw new RoutineValidationError(
                "มีรายการที่เลือกซึ่งยังมีเหตุผลที่ต้องตรวจสอบก่อนนำเข้า",
            );
        }
        const row = parseRoutineImportRow(storedRow.normalizedData);
        assertRowCanApply(row);
        if (row.sourceSheet !== ROUTINE_IMPORT_TARGET_SHEET) {
            throw new RoutineValidationError("อนุญาตให้นำเข้าเฉพาะชีต มสช. เท่านั้น");
        }
        if (row.sourceFingerprint !== storedRow.sourceFingerprint) {
            throw new RoutineConflictError(
                `ข้อมูลต้นทางของแถว ${storedRow.sourceRow} ไม่ตรงกับ staging`,
            );
        }
        return { storedRow, row, assignees: rowAssignees(row) };
    });
    const categoryNames = [...new Set(parsedRows.map(({ row }) => row.categoryName))];
    const employeeIds = [
        ...new Set(parsedRows.flatMap(({ assignees }) => (
            assignees.map((assignee) => assignee.employeeId)
        ))),
    ];
    const sourceRows = parsedRows.map(({ storedRow }) => storedRow.sourceRow);
    const [targetUnit, categories, employees, ledgers, tasks] = await Promise.all([
        tx.routineUnit.findUnique({
            where: { code: ROUTINE_IMPORT_TARGET_UNIT_CODE },
            select: { id: true, isActive: true },
        }),
        tx.routineCategory.findMany({
            where: { name: { in: categoryNames } },
            select: { id: true, name: true, isActive: true },
        }),
        tx.employee.findMany({
            where: { id: { in: employeeIds } },
            select: { id: true, status: true, deletedAt: true },
        }),
        tx.routineImportLedger.findMany({
            where: {
                sourceSheet: ROUTINE_IMPORT_TARGET_SHEET,
                sourceRow: { in: sourceRows },
            },
            select: {
                sourceRow: true,
                sourceFingerprint: true,
                status: true,
            },
        }),
        tx.routineTask.findMany({
            where: {
                sourceSheet: ROUTINE_IMPORT_TARGET_SHEET,
                sourceRow: { in: sourceRows },
            },
            select: { sourceRow: true },
        }),
    ]);
    if (!targetUnit || !targetUnit.isActive) {
        throw new RoutineValidationError("หน่วยงาน มสช. ไม่พร้อมใช้งาน");
    }
    const categoriesByName = new Map(categories.map((category) => [category.name, category]));
    const employeesById = new Map(employees.map((employee) => [employee.id, employee]));
    const ledgersBySourceRow = new Map<number, typeof ledgers>();
    for (const ledger of ledgers) {
        const matching = ledgersBySourceRow.get(ledger.sourceRow) ?? [];
        matching.push(ledger);
        ledgersBySourceRow.set(ledger.sourceRow, matching);
    }
    const taskSourceRows = new Set(tasks.map((task) => task.sourceRow));

    return parsedRows.map(({ storedRow, row, assignees }) => {
        const category = categoriesByName.get(row.categoryName);
        if (!category?.isActive) {
            throw new RoutineValidationError(
                `หมวดหมู่ของแถว ${storedRow.sourceRow} ไม่พร้อมใช้งาน`,
            );
        }
        const uniqueEmployeeIds = new Set<number>();
        let ownerCount = 0;
        for (const assignee of assignees) {
            if (uniqueEmployeeIds.has(assignee.employeeId)) {
                throw new RoutineValidationError(
                    `ผู้รับผิดชอบของแถว ${storedRow.sourceRow} ซ้ำกัน`,
                );
            }
            uniqueEmployeeIds.add(assignee.employeeId);
            if (assignee.role === "OWNER") ownerCount += 1;
            const employee = employeesById.get(assignee.employeeId);
            if (!employee || employee.status !== "ACTIVE" || employee.deletedAt !== null) {
                throw new RoutineValidationError(
                    `ผู้รับผิดชอบของแถว ${storedRow.sourceRow} ไม่พร้อมใช้งาน`,
                );
            }
        }
        if (ownerCount !== 1) {
            throw new RoutineValidationError(
                `แถว ${storedRow.sourceRow} ต้องมีผู้รับผิดชอบหลัก 1 คน`,
            );
        }
        const matchingLedgers = ledgersBySourceRow.get(storedRow.sourceRow) ?? [];
        const sameFingerprint = matchingLedgers.some(
            (ledger) => ledger.sourceFingerprint === storedRow.sourceFingerprint
                && ledger.status !== "CONFLICT",
        );
        if (sameFingerprint) {
            throw new RoutineConflictError(`แถว ${storedRow.sourceRow} ถูกนำเข้าแล้ว`);
        }
        if (matchingLedgers.length > 0 || taskSourceRows.has(storedRow.sourceRow)) {
            throw new RoutineConflictError(`แถว ${storedRow.sourceRow} มี source conflict`);
        }
        const parsedTask = routineTaskCreateSchema.safeParse(
            buildRoutineImportTaskInput(row, targetUnit.id, category.id),
        );
        if (!parsedTask.success) {
            throw new RoutineValidationError(
                `ข้อมูลแถว ${storedRow.sourceRow} ไม่ผ่านการตรวจสอบ`,
            );
        }
        return { storedRow, taskInput: parsedTask.data };
    });
}

export async function updateRoutineImportRow(
    batchId: number,
    rowId: number,
    input: RoutineImportRowUpdateInput,
    actor: RoutineCommandActor,
): Promise<RoutineImportRowView> {
    return runSerializableTransaction(async (tx) => {
        await assertActiveAdminInTransaction(tx, actor);
        const row = await tx.routineImportRow.findUnique({
            where: { id: rowId },
            include: { batch: true },
        });
        if (!row || row.batchId !== batchId) throw new RoutineNotFoundError("ไม่พบแถวข้อมูลนำเข้า");
        if (row.batch.status !== "READY" && row.batch.status !== "PREVIEW") {
            throw new RoutineConflictError("ชุดข้อมูลนี้ไม่อยู่ในสถานะที่แก้ไขได้");
        }
        if (row.batch.expiresAt && row.batch.expiresAt.getTime() <= Date.now()) {
            throw new RoutineConflictError("ชุดข้อมูลนำเข้าหมดอายุแล้ว กรุณาอัปโหลดใหม่");
        }
        if (row.status === "ALREADY_IMPORTED" || row.status === "CONFLICT" || row.status === "APPLIED") {
            throw new RoutineConflictError("แถวนี้ถูกนำเข้าแล้วหรือมี conflict ไม่สามารถแก้ไขได้");
        }
        const current = parseRoutineImportRow(row.normalizedData);
        const referenceData = await loadRoutineReferenceDataInTransaction(tx);
        const updatedData = buildUpdatedRow(current, input, referenceData);
        const selectedStatus: RoutineImportRowStatus = updatedData.requiresReview
            ? "REQUIRES_REVIEW"
            : input.selected ? "VALID" : "EXCLUDED";
        const selectedForStorage = input.selected;
        const updated = await tx.routineImportRow.updateMany({
            where: { id: rowId, batchId, version: input.version },
            data: {
                categoryName: updatedData.categoryName,
                title: updatedData.title,
                ownerNamesText: updatedData.ownerNames.join(", "),
                normalizedData: toPrismaJson(updatedData),
                status: selectedStatus,
                selected: selectedForStorage,
                proposedActivation: "ACTIVE",
                reviewReasons: toPrismaJson(updatedData.reviewReasons),
                version: { increment: 1 },
            },
        });
        if (updated.count !== 1) throw new RoutineConflictError();
        const allRows = await tx.routineImportRow.findMany({
            where: { batchId },
            select: { status: true, selected: true, proposedActivation: true, reviewReasons: true },
        });
        await tx.routineImportBatch.update({
            where: { id: batchId },
            data: recalculateBatchCounts(allRows),
        });
        await tx.auditLog.create({
            data: {
                action: "ROUTINE_IMPORT_ROW_UPDATE",
                entityType: "RoutineImportRow",
                entityId: rowId,
                userId: actor.id,
                userEmail: actor.email,
                ipAddress: actor.ipAddress,
                userAgent: actor.userAgent,
                details: JSON.stringify({
                    batchId,
                    sourceKey: row.sourceKey,
                    selected: selectedForStorage,
                    affectedEmployeeIds: updatedData.mappedEmployeeIds,
                }),
            },
        });
        const saved = await tx.routineImportRow.findUniqueOrThrow({ where: { id: rowId } });
        return getRowView(saved);
    });
}

async function loadRoutineReferenceDataInTransaction(
    tx: Prisma.TransactionClient,
): Promise<RoutineImportReferenceData> {
    const [units, categories, employees] = await Promise.all([
        tx.routineUnit.findMany({
            select: { id: true, code: true, name: true, isActive: true },
            orderBy: { code: "asc" },
        }),
        tx.routineCategory.findMany({
            select: { id: true, name: true, sortOrder: true, isActive: true },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        }),
        tx.employee.findMany({
            select: {
                id: true,
                firstName: true,
                lastName: true,
                nickname: true,
                departmentId: true,
                status: true,
                deletedAt: true,
            },
            orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        }),
    ]);
    return targetReferenceData({
        units,
        categories,
        employees: employees.map((employee) => ({
            ...employee,
            status: employee.status.toString(),
            deletedAt: employee.deletedAt?.toISOString() ?? null,
        })),
    });
}

async function refreshBatchCountsInTransaction(
    tx: Prisma.TransactionClient,
    batchId: number,
): Promise<RoutineImportBatchCounts> {
    const rows = await tx.routineImportRow.findMany({
        where: { batchId },
        select: { status: true, selected: true, proposedActivation: true, reviewReasons: true },
    });
    return recalculateBatchCounts(rows);
}

export async function applyRoutineImportBatch(
    batchId: number,
    actor: RoutineCommandActor,
): Promise<RoutineImportApplyView> {
    const result = await runSerializableTransaction(async (tx) => {
        await assertActiveAdminInTransaction(tx, actor);
        const batch = await tx.routineImportBatch.findUnique({ where: { id: batchId } });
        if (!batch) throw new RoutineNotFoundError("ไม่พบรายการนำเข้า");
        if (batch.status === "COMPLETED") {
            throw new RoutineConflictError("นำเข้าชุดข้อมูลนี้เสร็จแล้ว");
        }
        if (batch.status === "APPLYING") {
            throw new RoutineConflictError(
                "ชุดข้อมูลกำลังถูกนำเข้าโดยผู้ดูแลระบบคนอื่น",
            );
        }
        if (batch.status !== "READY" && batch.status !== "PREVIEW") {
            throw new RoutineConflictError("ชุดข้อมูลนี้ไม่อยู่ในสถานะที่นำเข้าได้");
        }
        if (batch.expiresAt && batch.expiresAt.getTime() <= Date.now()) {
            await tx.routineImportBatch.update({
                where: { id: batchId },
                data: { status: "EXPIRED" },
            });
            return { kind: "EXPIRED" as const };
        }
        const rows = await tx.routineImportRow.findMany({
            where: { batchId, selected: true },
            orderBy: { sourceRow: "asc" },
        });
        if (rows.length === 0) {
            throw new RoutineValidationError(
                "กรุณาเลือกรายการที่จะนำเข้าอย่างน้อย 1 รายการ",
            );
        }

        const preparedRows = await prepareRowsForApplyInTransaction(tx, rows);

        const claimed = await tx.routineImportBatch.updateMany({
            where: {
                id: batchId,
                status: { in: ["READY", "PREVIEW"] },
                version: batch.version,
            },
            data: { status: "APPLYING", version: { increment: 1 } },
        });
        if (claimed.count !== 1) {
            throw new RoutineConflictError(
                "ชุดข้อมูลกำลังถูกนำเข้าโดยผู้ดูแลระบบคนอื่น",
            );
        }

        const importedTaskIds: number[] = [];
        const importedRowIds: number[] = [];
        for (const { storedRow, taskInput } of preparedRows) {
            const task = await createRoutineTaskInTransaction(
                tx,
                taskInput,
                actor,
                { excludePastDue: true },
            );
            await tx.routineImportLedger.create({
                data: {
                    sourceFileName: taskInput.sourceFileName ?? batch.originalFileName,
                    sourceSheet: taskInput.sourceSheet ?? batch.targetSheet,
                    sourceRow: taskInput.sourceRow ?? storedRow.sourceRow,
                    sourceFingerprint: storedRow.sourceFingerprint,
                    status: "APPLIED",
                    taskId: task.id,
                    appliedById: actor.id,
                },
            });
            await tx.routineImportRow.update({
                where: { id: storedRow.id },
                data: {
                    status: "APPLIED",
                    appliedTaskId: task.id,
                    version: { increment: 1 },
                },
            });
            importedTaskIds.push(task.id);
            importedRowIds.push(storedRow.id);
        }

        const counts = await refreshBatchCountsInTransaction(tx, batchId);
        const completed = await tx.routineImportBatch.update({
            where: { id: batchId },
            data: {
                status: "COMPLETED",
                appliedAt: new Date(),
                errorMessage: null,
                ...counts,
            },
            include: { uploadedBy: { select: { id: true, name: true } } },
        });
        await tx.auditLog.create({
            data: {
                action: "ROUTINE_IMPORT_APPLY",
                entityType: "RoutineImportBatch",
                entityId: batchId,
                userId: actor.id,
                userEmail: actor.email,
                ipAddress: actor.ipAddress,
                userAgent: actor.userAgent,
                details: JSON.stringify({
                    batchId,
                    targetSheet: batch.targetSheet,
                    totalSelected: rows.length,
                    appliedRows: completed.appliedRows,
                    conflictRows: completed.conflictRows,
                    taskIds: importedTaskIds,
                    importedRowIds,
                }),
            },
        });
        const selectedValidRows = await countSelectedValidRows(tx, batchId);
        return {
            kind: "APPLIED" as const,
            batch: completed,
            selectedValidRows,
            importedTaskIds,
            importedRowIds,
            skippedCount: Math.max(0, completed.totalRows - importedRowIds.length),
        };
    }, {
        maxWaitMs: ROUTINE_IMPORT_APPLY_MAX_WAIT_MS,
        timeoutMs: ROUTINE_IMPORT_APPLY_TIMEOUT_MS,
    });
    if (result.kind === "EXPIRED") {
        throw new RoutineConflictError("ชุดข้อมูลนำเข้าหมดอายุแล้ว กรุณาอัปโหลดใหม่");
    }
    return {
        batch: getBatchView(result.batch, result.selectedValidRows),
        idempotent: false,
        importedTaskIds: result.importedTaskIds,
        importedRowIds: result.importedRowIds,
        importedCount: result.importedTaskIds.length,
        skippedCount: result.skippedCount,
        appliedBy: {
            userId: actor.id,
            email: actor.email,
        },
    };
}

export async function cancelRoutineImportBatch(
    batchId: number,
    actor: RoutineCommandActor,
): Promise<RoutineImportBatchView> {
    const batch = await runSerializableTransaction(async (tx) => {
        await assertActiveAdminInTransaction(tx, actor);
        const current = await tx.routineImportBatch.findUnique({ where: { id: batchId } });
        if (!current) throw new RoutineNotFoundError("ไม่พบรายการนำเข้า");
        if (current.status === "COMPLETED") throw new RoutineConflictError("นำเข้าชุดข้อมูลนี้เสร็จแล้ว ไม่สามารถยกเลิกได้");
        if (!["READY", "PREVIEW"].includes(current.status)) throw new RoutineConflictError("ชุดข้อมูลนี้ไม่อยู่ในสถานะที่ยกเลิกได้");
        const updated = await tx.routineImportBatch.update({
            where: { id: batchId, version: current.version },
            data: { status: "CANCELLED", version: { increment: 1 } },
            include: { uploadedBy: { select: { id: true, name: true } } },
        });
        await tx.auditLog.create({
            data: {
                action: "ROUTINE_IMPORT_CANCEL",
                entityType: "RoutineImportBatch",
                entityId: batchId,
                userId: actor.id,
                userEmail: actor.email,
                ipAddress: actor.ipAddress,
                userAgent: actor.userAgent,
                details: JSON.stringify({ batchId, targetSheet: current.targetSheet }),
            },
        });
        return updated;
    });
    const selectedValidRows = await countSelectedValidRows(prisma, batchId);
    return getBatchView(batch, selectedValidRows);
}

export function routineImportRowsQueryLimit(value: number): number {
    return Math.min(Math.max(value, 1), ROUTINE_IMPORT_PAGE_LIMIT);
}
