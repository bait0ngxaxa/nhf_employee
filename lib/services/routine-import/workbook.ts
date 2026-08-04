import { basename } from "node:path";
import { createHash } from "node:crypto";

import * as XLSX from "xlsx";
import type {
    CellObject,
    Range,
    WorkBook,
    WorkSheet,
} from "xlsx";

import {
    ROUTINE_IMPORT_CATEGORY_ALIASES,
    ROUTINE_IMPORT_FOOTER_PREFIXES,
    ROUTINE_IMPORT_PLACEHOLDER_TITLES,
    ROUTINE_IMPORT_REVIEW_REASONS,
} from "./constants";
import {
    isDateExpired,
    isDateNumberFormat,
    normalizeCellDate,
    normalizeSourceText,
    parseContractDates,
    parseSourceDates,
} from "./dates";
import { hasUnresolvedOwnerReview, resolveRoutineOwners, splitOwnerNames } from "./owner-mapping";
import { normalizeRoutineSchedule } from "./schedule-normalizer";
import type {
    RoutineImportManifest,
    RoutineImportReferenceData,
    RoutineImportFingerprintContext,
    RoutineImportRow,
    RoutineImportSheetInspection,
    RoutineImportSourceCell,
    RoutineImportWorkbookInspection,
} from "./types";

interface RoutineWorkbookColumnMap {
    owner: number;
    title: number;
    schedule: number | null;
    contract: number | null;
    details: number | null;
}

interface RoutineWorkbookExtractionResult {
    inspection: RoutineImportWorkbookInspection;
    rows: RoutineImportRow[];
}

export interface RoutineWorkbookExtractionOptions {
    includeSheets?: readonly string[];
}

function getSheetRange(sheet: WorkSheet): XLSX.Range {
    const ref = sheet["!ref"] as string | undefined;
    return ref ? XLSX.utils.decode_range(ref) : { s: { r: 0, c: 0 }, e: { r: -1, c: -1 } };
}

function getCell(sheet: WorkSheet, row: number, column: number): CellObject | null {
    const address = XLSX.utils.encode_cell({ r: row, c: column });
    const candidate = sheet[address] as CellObject | undefined;
    return candidate ?? null;
}

function getMerges(sheet: WorkSheet): Range[] {
    return (sheet["!merges"] as Range[] | undefined) ?? [];
}

function getMergedTopLeft(
    row: number,
    column: number,
    merges: readonly Range[],
): { row: number; column: number } | null {
    const merge = merges.find(
        (candidate) =>
            row >= candidate.s.r
            && row <= candidate.e.r
            && column >= candidate.s.c
            && column <= candidate.e.c,
    );
    return merge ? { row: merge.s.r, column: merge.s.c } : null;
}

function getEffectiveCell(
    sheet: WorkSheet,
    row: number,
    column: number,
    merges: readonly Range[],
): CellObject | null {
    const cell = getCell(sheet, row, column);
    if (cell && cell.v !== undefined) return cell;
    const topLeft = getMergedTopLeft(row, column, merges);
    return topLeft ? getCell(sheet, topLeft.row, topLeft.column) : cell;
}

function toImportCellValue(value: unknown): string | number | boolean | null {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return value;
    }
    return null;
}

function cellHasValue(cell: CellObject | null): boolean {
    if (!cell || cell.v === undefined || cell.v === null) return false;
    return typeof cell.v !== "string" || cell.v.trim().length > 0;
}

function cellText(
    cell: CellObject | null,
    date1904: boolean,
): string | null {
    if (!cell || cell.v === undefined || cell.v === null) return null;
    if (typeof cell.v === "string") {
        const value = normalizeSourceText(cell.v);
        return value.length > 0 ? value : null;
    }
    const normalizedDate = normalizeCellDate(cell.v, cell.z?.toString(), date1904);
    if (normalizedDate) return normalizedDate;
    if (typeof cell.v === "number" || typeof cell.v === "boolean") {
        return String(cell.v);
    }
    return cell.w?.trim() || null;
}

function rawCellText(
    cell: CellObject | null,
    date1904: boolean,
): string | null {
    if (!cell || cell.v === undefined || cell.v === null) return null;
    if (typeof cell.v === "string") return cell.v.trim().length > 0 ? cell.v : null;
    return cellText(cell, date1904);
}

function sourceCellFromCell(
    address: string,
    cell: CellObject,
): RoutineImportSourceCell {
    return {
        address,
        value: toImportCellValue(cell.v),
        formula: cell.f ?? null,
        type: cell.t ?? null,
    };
}

function sourceCellsForRow(
    sheet: WorkSheet,
    row: number,
    range: XLSX.Range,
): RoutineImportSourceCell[] {
    const cells: RoutineImportSourceCell[] = [];
    for (let column = range.s.c; column <= range.e.c; column += 1) {
        const address = XLSX.utils.encode_cell({ r: row, c: column });
        const cell = getCell(sheet, row, column);
        if (cell) cells.push(sourceCellFromCell(address, cell));
    }
    return cells;
}

function rowText(
    sheet: WorkSheet,
    row: number,
    column: number,
    merges: readonly Range[],
    date1904: boolean,
): string | null {
    return cellText(getEffectiveCell(sheet, row, column, merges), date1904);
}

function rawRowText(
    sheet: WorkSheet,
    row: number,
    column: number,
    merges: readonly Range[],
    date1904: boolean,
): string | null {
    return rawCellText(getEffectiveCell(sheet, row, column, merges), date1904);
}

function rowValues(
    sheet: WorkSheet,
    row: number,
    range: XLSX.Range,
    merges: readonly Range[],
    date1904: boolean,
): string[] {
    const values: string[] = [];
    for (let column = range.s.c; column <= range.e.c; column += 1) {
        values.push(rowText(sheet, row, column, merges, date1904) ?? "");
    }
    return values;
}

function findHeader(
    sheet: WorkSheet,
    range: XLSX.Range,
    merges: readonly Range[],
    date1904: boolean,
): { row: number; columns: RoutineWorkbookColumnMap; headerRows: number[] } | null {
    for (let row = range.s.r; row <= range.e.r; row += 1) {
        const values = rowValues(sheet, row, range, merges, date1904);
        const owner = values.findIndex((value) => value.includes("ผู้รับผิดชอบ"));
        const title = values.findIndex((value) => value === "รายการ" || value.includes("รายการ"));
        const schedule = values.findIndex(
            (value) => value.includes("กำหนดชำระ") || value.includes("รอบวางบิล"),
        );
        const contract = values.findIndex((value) => value.includes("กำหนดสัญญา"));
        const details = values.findIndex((value) => value.includes("รายละเอียด"));
        if (owner < 0 || title < 0 || (schedule < 0 && contract < 0)) continue;

        const headerRows = [row + 1];
        const nextRow = row + 1;
        if (nextRow <= range.e.r) {
            const nextValues = rowValues(sheet, nextRow, range, merges, date1904);
            if (nextValues.some((value) => value.includes("รอบวางบิล"))) {
                headerRows.push(nextRow + 1);
            }
        }
        return {
            row,
            columns: {
                owner: range.s.c + owner,
                title: range.s.c + title,
                schedule: schedule >= 0 ? range.s.c + schedule : null,
                contract: contract >= 0 ? range.s.c + contract : null,
                details: details >= 0 ? range.s.c + details : null,
            },
            headerRows,
        };
    }
    return null;
}

function canonicalCategory(value: string | null): string | null {
    if (!value) return null;
    return ROUTINE_IMPORT_CATEGORY_ALIASES[normalizeSourceText(value)] ?? null;
}

function isCategoryRow(
    sheet: WorkSheet,
    row: number,
    range: XLSX.Range,
    merges: readonly Range[],
    date1904: boolean,
): string | null {
    const marker = rowText(sheet, row, range.s.c, merges, date1904);
    const title = rowText(sheet, row, range.s.c + 2, merges, date1904);
    if (!title || !/^\d+$/u.test(marker ?? "")) return null;
    return canonicalCategory(title);
}

function isRepeatedHeaderRow(values: readonly string[]): boolean {
    return values.some((value) => value.includes("ผู้รับผิดชอบ"))
        || values.some((value) => value === "รายการ")
        || values.some((value) => value.includes("กำหนดสัญญา"));
}

function isBlankRow(
    sheet: WorkSheet,
    row: number,
    range: XLSX.Range,
): boolean {
    for (let column = range.s.c; column <= range.e.c; column += 1) {
        if (cellHasValue(getCell(sheet, row, column))) return false;
    }
    return true;
}

function addReason(reasons: string[], reason: string): void {
    if (!reasons.includes(reason)) reasons.push(reason);
}

function hasFormulaInRow(
    sheet: WorkSheet,
    row: number,
    range: XLSX.Range,
): boolean {
    for (let column = range.s.c; column <= range.e.c; column += 1) {
        if (getCell(sheet, row, column)?.f) return true;
    }
    return false;
}

export function computeRoutineImportRowFingerprint(
    sourceFileName: string,
    sourceSheet: string,
    sourceRow: number,
    sourceCells: readonly RoutineImportSourceCell[],
    context?: RoutineImportFingerprintContext,
): string {
    return createHash("sha256")
        .update(JSON.stringify({ sourceFileName, sourceSheet, sourceRow, sourceCells, context }))
        .digest("hex");
}

function inspectSheet(
    sheetName: string,
    sheet: WorkSheet,
    range: XLSX.Range,
    header: ReturnType<typeof findHeader>,
    merges: readonly Range[],
    date1904: boolean,
): RoutineImportSheetInspection {
    const formulaCells: string[] = [];
    const numericDateCells: string[] = [];
    const stringDateCells: string[] = [];
    const blankRows: number[] = [];
    const repeatedHeaderRows: number[] = [];
    const categoryRows: number[] = [];

    for (let row = range.s.r; row <= range.e.r; row += 1) {
        if (isBlankRow(sheet, row, range)) blankRows.push(row + 1);
        const values = rowValues(sheet, row, range, merges, date1904);
        if (isRepeatedHeaderRow(values) && row !== header?.row) {
            repeatedHeaderRows.push(row + 1);
        }
        if (isCategoryRow(sheet, row, range, merges, date1904)) {
            categoryRows.push(row + 1);
        }

        for (let column = range.s.c; column <= range.e.c; column += 1) {
            const address = XLSX.utils.encode_cell({ r: row, c: column });
            const cell = getCell(sheet, row, column);
            if (!cell) continue;
            if (cell.f) formulaCells.push(address);
            if (typeof cell.v === "number" && isDateNumberFormat(cell.z?.toString())) {
                numericDateCells.push(address);
            }
        }

        const candidateDateColumns = [
            header?.columns.schedule,
            header?.columns.contract,
        ].filter((column): column is number => column !== null && column !== undefined);
        for (const column of candidateDateColumns) {
            const cell = getCell(sheet, row, column);
            const text = rowText(sheet, row, column, merges, date1904);
            if (typeof cell?.v === "string" && parseSourceDates(cell.v).length > 0) {
                stringDateCells.push(XLSX.utils.encode_cell({ r: row, c: column }));
            }
            if (typeof cell?.v === "number" && normalizeCellDate(cell.v, cell.z?.toString(), date1904)) {
                numericDateCells.push(XLSX.utils.encode_cell({ r: row, c: column }));
            }
            if (text?.match(/^\d{4}-\d{2}-\d{2}$/u)) {
                stringDateCells.push(XLSX.utils.encode_cell({ r: row, c: column }));
            }
        }
    }

    return {
        sheetName,
        range: sheet["!ref"] as string | null | undefined ?? null,
        headerColumns: {
            owner: header ? XLSX.utils.encode_col(header.columns.owner) : null,
            title: header ? XLSX.utils.encode_col(header.columns.title) : null,
            schedule: header?.columns.schedule === null || header?.columns.schedule === undefined
                ? null
                : XLSX.utils.encode_col(header.columns.schedule),
            contract: header?.columns.contract === null || header?.columns.contract === undefined
                ? null
                : XLSX.utils.encode_col(header.columns.contract),
            details: header?.columns.details === null || header?.columns.details === undefined
                ? null
                : XLSX.utils.encode_col(header.columns.details),
        },
        headerRows: header?.headerRows ?? [],
        mergedRegions: merges.map((merge) => ({
            startAddress: XLSX.utils.encode_cell(merge.s),
            endAddress: XLSX.utils.encode_cell(merge.e),
        })),
        blankRows,
        repeatedHeaderRows: [...new Set(repeatedHeaderRows)],
        categoryRows: [...new Set(categoryRows)],
        dataRows: [],
        formulaCells: [...new Set(formulaCells)],
        numericDateCells: [...new Set(numericDateCells)],
        stringDateCells: [...new Set(stringDateCells)],
    };
}

function classifyActivation(
    reasons: readonly string[],
    ownerNames: readonly string[],
    mappedEmployeeIds: readonly number[],
    title: string,
    asOfDate: string,
    contractEndDate: string | null,
): RoutineImportRow["proposedActivation"] {
    const hasHistoryOnlyReason =
        ROUTINE_IMPORT_PLACEHOLDER_TITLES.has(normalizeSourceText(title))
        || ownerNames.length === 0
        || mappedEmployeeIds.length !== ownerNames.length
        || reasons.includes(ROUTINE_IMPORT_REVIEW_REASONS.MISSING_CATEGORY)
        || reasons.includes(ROUTINE_IMPORT_REVIEW_REASONS.MISSING_UNIT)
        || reasons.includes(ROUTINE_IMPORT_REVIEW_REASONS.INACTIVE_CATEGORY)
        || reasons.includes(ROUTINE_IMPORT_REVIEW_REASONS.INACTIVE_UNIT)
        || reasons.includes(ROUTINE_IMPORT_REVIEW_REASONS.INVALID_CONTRACT_DATE_RANGE);
    if (hasHistoryOnlyReason) return "HISTORY_ONLY";
    if (isDateExpired(contractEndDate, asOfDate)) return "INACTIVE";
    return reasons.length > 0 ? "INACTIVE" : "ACTIVE";
}

export function readRoutineWorkbook(input: Uint8Array): WorkBook {
    return XLSX.read(input, {
        type: "buffer",
        cellFormula: true,
        cellNF: true,
        cellStyles: true,
        cellDates: false,
        WTF: true,
    });
}

export function extractRoutineWorkbook(
    workbook: WorkBook,
    fileName: string,
    asOfDate: string,
    ownerMapping: Record<string, number>,
    referenceData: RoutineImportReferenceData,
    options: RoutineWorkbookExtractionOptions = {},
): RoutineWorkbookExtractionResult {
    const sourceFileName = basename(fileName);
    const date1904 = workbook.Workbook?.WBProps?.date1904 ?? false;
    const sheets: RoutineImportSheetInspection[] = [];
    const rows: RoutineImportRow[] = [];

    const sheetNames = options.includeSheets ?? workbook.SheetNames;
    for (const sheetName of sheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const range = getSheetRange(sheet);
        const merges = getMerges(sheet);
        const header = findHeader(sheet, range, merges, date1904);
        const inspection = inspectSheet(sheetName, sheet, range, header, merges, date1904);
        const dataRows: number[] = [];
        let currentCategory: string | null = null;
        let currentOwnerNames: string[] = [];

        if (header) {
            for (let row = header.row + 1; row <= range.e.r; row += 1) {
                const values = rowValues(sheet, row, range, merges, date1904);
                if (isBlankRow(sheet, row, range)) continue;
                if (isRepeatedHeaderRow(values)) continue;

                const category = isCategoryRow(sheet, row, range, merges, date1904);
                if (category) {
                    currentCategory = category;
                    currentOwnerNames = [];
                    continue;
                }

                const title = rowText(
                    sheet,
                    row,
                    header.columns.title,
                    merges,
                    date1904,
                );
                if (!title) continue;
                if (ROUTINE_IMPORT_FOOTER_PREFIXES.some((prefix) => title.startsWith(prefix))) {
                    continue;
                }

                dataRows.push(row + 1);
                const ownerCell = getEffectiveCell(
                    sheet,
                    row,
                    header.columns.owner,
                    merges,
                );
                const ownerSourceText = cellText(ownerCell, date1904);
                const directOwnerCell = getCell(sheet, row, header.columns.owner);
                const directOwnerText = cellText(directOwnerCell, date1904);
                const parsedOwnerNames = splitOwnerNames(ownerSourceText);
                if (parsedOwnerNames.length > 0) {
                    currentOwnerNames = parsedOwnerNames;
                }
                const ownerNames = parsedOwnerNames.length > 0
                    ? parsedOwnerNames
                    : currentOwnerNames;
                const scheduleText = header.columns.schedule === null
                    ? null
                    : rawRowText(sheet, row, header.columns.schedule, merges, date1904);
                const contractText = header.columns.contract === null
                    ? null
                    : rawRowText(sheet, row, header.columns.contract, merges, date1904);
                const extraDetails = header.columns.details === null
                    ? null
                    : rawRowText(sheet, row, header.columns.details, merges, date1904);
                const contract = parseContractDates(contractText);
                const schedule = normalizeRoutineSchedule(
                    scheduleText,
                    contract.startDate,
                );
                const ownerResolution = resolveRoutineOwners(
                    ownerNames,
                    ownerMapping,
                    referenceData,
                );
                const reasons = [
                    ...schedule.reviewReasons,
                    ...contract.reviewReasons,
                    ...ownerResolution.reviewReasons,
                ];
                if (isDateExpired(contract.endDate, asOfDate)) {
                    addReason(reasons, ROUTINE_IMPORT_REVIEW_REASONS.EXPIRED_CONTRACT);
                }
                if (!currentCategory) addReason(reasons, ROUTINE_IMPORT_REVIEW_REASONS.MISSING_CATEGORY);
                const unitReference = referenceData.units.find((unit) => unit.code === sheetName);
                if (!unitReference) {
                    addReason(reasons, ROUTINE_IMPORT_REVIEW_REASONS.MISSING_UNIT);
                } else if (!unitReference.isActive) {
                    addReason(reasons, ROUTINE_IMPORT_REVIEW_REASONS.INACTIVE_UNIT);
                }
                if (currentCategory) {
                    const categoryReference = referenceData.categories.find(
                        (categoryValue) => categoryValue.name === currentCategory,
                    );
                    if (!categoryReference) {
                        addReason(reasons, ROUTINE_IMPORT_REVIEW_REASONS.MISSING_CATEGORY);
                    } else if (!categoryReference.isActive) {
                        addReason(reasons, ROUTINE_IMPORT_REVIEW_REASONS.INACTIVE_CATEGORY);
                    }
                }
                if (hasFormulaInRow(sheet, row, range)) {
                    addReason(reasons, ROUTINE_IMPORT_REVIEW_REASONS.FORMULA_CELL);
                }
                if (ROUTINE_IMPORT_PLACEHOLDER_TITLES.has(normalizeSourceText(title))) {
                    addReason(reasons, ROUTINE_IMPORT_REVIEW_REASONS.PLACEHOLDER_ROW);
                }

                const sourceCells = sourceCellsForRow(sheet, row, range);
                const proposedActivation = classifyActivation(
                    reasons,
                    ownerNames,
                    ownerResolution.mappedEmployeeIds,
                    title,
                    asOfDate,
                    contract.endDate,
                );
                const importRow: RoutineImportRow = {
                    sourceFileName,
                    sourceSheet: sheetName,
                    sourceRow: row + 1,
                    sourceFingerprint: computeRoutineImportRowFingerprint(
                        sourceFileName,
                        sheetName,
                        row + 1,
                        sourceCells,
                        {
                            categoryName: currentCategory ?? "",
                            title,
                            ownerNames,
                            scheduleText,
                            contractText,
                            extraDetails,
                        },
                    ),
                    sourceCells,
                    categorySourceText: rawRowText(sheet, row, range.s.c + 2, merges, date1904),
                    ownerSourceText: directOwnerText,
                    unitCode: sheetName,
                    unitName: sheetName,
                    categoryName: currentCategory ?? "",
                    title,
                    ownerNames,
                    mappedEmployeeIds: ownerResolution.mappedEmployeeIds,
                    mappedEmployeeNames: ownerResolution.mappedEmployeeNames,
                    scheduleText,
                    contractText,
                    extraDetails,
                    normalizedSchedule: schedule.normalizedSchedule,
                    contractStartDate: contract.startDate,
                    contractEndDate: contract.endDate,
                    requiresReview: reasons.length > 0,
                    reviewReasons: [...new Set(reasons)],
                    proposedActivation,
                };
                rows.push(importRow);
            }
        }

        inspection.dataRows = dataRows;
        sheets.push(inspection);
    }

    return {
        inspection: {
            fileName: sourceFileName,
            sheetCount: workbook.SheetNames.length,
            sheets,
        },
        rows,
    };
}

export function buildRoutineImportManifest(
    workbook: WorkBook,
    fileName: string,
    sourceSha256: string,
    asOfDate: string,
    ownerMapping: Record<string, number>,
    referenceData: RoutineImportReferenceData,
    generatedAt = new Date().toISOString(),
    options: RoutineWorkbookExtractionOptions = {},
): RoutineImportManifest {
    const extracted = extractRoutineWorkbook(
        workbook,
        fileName,
        asOfDate,
        ownerMapping,
        referenceData,
        options,
    );
    const identityKeys = new Set<string>();
    let duplicateSourceRows = 0;
    for (const row of extracted.rows) {
        const key = `${row.sourceFileName}:${row.sourceSheet}:${row.sourceRow}`;
        if (identityKeys.has(key)) duplicateSourceRows += 1;
        identityKeys.add(key);
    }
    const summary = {
        totalRows: extracted.rows.length,
        validRows: extracted.rows.filter((row) => !row.requiresReview).length,
        requiresReview: extracted.rows.filter((row) => row.requiresReview).length,
        unresolvedOwners: extracted.rows.filter((row) => hasUnresolvedOwnerReview(row.reviewReasons)).length,
        ambiguousSchedules: extracted.rows.filter((row) =>
            row.reviewReasons.includes(ROUTINE_IMPORT_REVIEW_REASONS.AMBIGUOUS_SCHEDULE)
            || row.reviewReasons.includes(ROUTINE_IMPORT_REVIEW_REASONS.UNSUPPORTED_EVENT_SCHEDULE),
        ).length,
        expiredContracts: extracted.rows.filter((row) =>
            isDateExpired(row.contractEndDate, asOfDate),
        ).length,
        missingCategory: extracted.rows.filter((row) =>
            row.reviewReasons.includes(ROUTINE_IMPORT_REVIEW_REASONS.MISSING_CATEGORY),
        ).length,
        missingUnit: extracted.rows.filter((row) =>
            row.reviewReasons.includes(ROUTINE_IMPORT_REVIEW_REASONS.MISSING_UNIT),
        ).length,
        duplicateSourceRows,
        proposedActive: extracted.rows.filter((row) => row.proposedActivation === "ACTIVE").length,
        proposedInactive: extracted.rows.filter((row) => row.proposedActivation === "INACTIVE").length,
        proposedHistoryOnly: extracted.rows.filter((row) => row.proposedActivation === "HISTORY_ONLY").length,
    };
    return {
        manifestVersion: 1,
        sourceFileName: basename(fileName),
        sourceSha256,
        generatedAt,
        asOfDate,
        inspection: extracted.inspection,
        rows: extracted.rows,
        summary,
    };
}

export function assertRoutineImportManifestMatchesWorkbook(
    manifest: RoutineImportManifest,
    workbook: WorkBook,
    fileName: string,
): void {
    const extracted = extractRoutineWorkbook(
        workbook,
        fileName,
        manifest.asOfDate,
        {},
        { units: [], categories: [], employees: [] },
    );
    const expected = new Map(
        manifest.rows.map((row) => [
            `${row.sourceSheet}:${row.sourceRow}`,
            row.sourceFingerprint,
        ]),
    );
    const actual = new Map(
        extracted.rows.map((row) => [
            `${row.sourceSheet}:${row.sourceRow}`,
            row.sourceFingerprint,
        ]),
    );
    if (expected.size !== actual.size) {
        throw new Error("workbook มีจำนวน source row ไม่ตรงกับ manifest");
    }
    for (const [identity, fingerprint] of expected) {
        if (actual.get(identity) !== fingerprint) {
            throw new Error(`workbook source row ไม่ตรงกับ manifest: ${identity}`);
        }
    }
}
