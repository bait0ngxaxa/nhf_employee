import ExcelJS from "exceljs";

import { buildLeaveReportRows } from "@/lib/services/leave/report-model";
import type {
    LeaveDetailRow,
    LeaveReportEmployee,
    LeaveSummaryRow,
} from "@/lib/services/leave/report-types";

const SUMMARY_SHEET_NAME = "สรุปรายคน";
const DETAIL_SHEET_NAME = "รายละเอียดคำขอลา";
const NUMBER_FORMAT = "0.#";
const DATE_FORMAT = "dd/mm/yyyy";

export function createLeaveReportWorkbook(
    employees: LeaveReportEmployee[],
): ExcelJS.Workbook {
    const workbook = new ExcelJS.Workbook();
    const rows = buildLeaveReportRows(employees);

    workbook.creator = "NHF Employee";
    workbook.created = new Date();
    addSummarySheet(workbook, rows.summaryRows);
    addDetailSheet(workbook, rows.detailRows);

    return workbook;
}

function addSummarySheet(workbook: ExcelJS.Workbook, rows: LeaveSummaryRow[]): void {
    const sheet = workbook.addWorksheet(SUMMARY_SHEET_NAME);
    sheet.columns = getSummaryColumns();
    sheet.addRows(rows.map(toSummaryWorksheetRow));
    finishWorksheet(sheet, 3);
    styleTotalRow(sheet);
}

function addDetailSheet(workbook: ExcelJS.Workbook, rows: LeaveDetailRow[]): void {
    const sheet = workbook.addWorksheet(DETAIL_SHEET_NAME);
    sheet.columns = getDetailColumns();
    sheet.addRows(rows.map((row, index) => toDetailWorksheetRow(row, index + 1)));
    finishWorksheet(sheet, 5);
}

function finishWorksheet(sheet: ExcelJS.Worksheet, freezeColumnCount: number): void {
    sheet.views = [{ state: "frozen", xSplit: freezeColumnCount, ySplit: 1 }];
    sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: sheet.columnCount },
    };
    sheet.eachRow((row) => {
        row.font = { name: "Arial" };
    });
    styleHeaderRow(sheet.getRow(1));
    applyNumberFormat(sheet);
}

function styleHeaderRow(row: ExcelJS.Row): void {
    row.font = { name: "Arial", bold: true, color: { argb: "FFFFFFFF" } };
    row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1F2937" },
    };
    row.alignment = { vertical: "middle", horizontal: "center" };
}

function styleTotalRow(sheet: ExcelJS.Worksheet): void {
    const row = sheet.getRow(sheet.rowCount);
    row.font = { name: "Arial", bold: true };
    row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0F2FE" },
    };
}

function applyNumberFormat(sheet: ExcelJS.Worksheet): void {
    sheet.columns.forEach((column) => {
        const key = String(column.key ?? "");
        if (key.endsWith("Date") || key === "createdAt") {
            column.numFmt = DATE_FORMAT;
            return;
        }
        if (column.values?.some((value) => typeof value === "number")) {
            column.numFmt = NUMBER_FORMAT;
        }
    });
}

function toSummaryWorksheetRow(row: LeaveSummaryRow): Record<string, string | number | Date> {
    return {
        employeeName: row.employeeName,
        department: row.department,
        position: row.position,
        sickQuota: row.sickQuota,
        sickUsed: row.sickUsed,
        sickRemaining: row.sickRemaining,
        personalQuota: row.personalQuota,
        personalUsed: row.personalUsed,
        personalRemaining: row.personalRemaining,
        vacationQuota: row.vacationQuota,
        vacationUsed: row.vacationUsed,
        vacationRemaining: row.vacationRemaining,
        totalUsed: row.totalUsed,
        totalRemaining: row.totalRemaining,
        overQuotaDays: row.overQuotaDays,
        pendingDays: row.pendingDays,
        approvedRequestCount: row.approvedRequestCount,
        pendingRequestCount: row.pendingRequestCount,
        inactiveRequestCount: row.inactiveRequestCount,
        notTakenCount: row.notTakenCount,
        latestApprovedDate: row.latestApprovedDate ?? "-",
    };
}

function toDetailWorksheetRow(
    row: LeaveDetailRow,
    sequence: number,
): Record<string, string | number | Date> {
    return {
        sequence,
        employeeName: row.employeeName,
        department: row.department,
        position: row.position,
        leaveType: row.leaveType,
        startDate: row.startDate,
        endDate: row.endDate,
        period: row.period,
        status: row.status,
        requestedDays: row.requestedDays,
        effectiveDays: row.effectiveDays,
        overQuotaDays: row.overQuotaDays,
        reason: row.reason,
        emergencyReason: row.emergencyReason,
        specialReason: row.specialReason,
        rejectReason: row.rejectReason,
        notTakenReason: row.notTakenReason,
        createdAt: row.createdAt,
    };
}

function getSummaryColumns(): Partial<ExcelJS.Column>[] {
    return [
        { header: "ชื่อ-นามสกุล", key: "employeeName", width: 28 },
        { header: "แผนก", key: "department", width: 20 },
        { header: "ตำแหน่ง", key: "position", width: 24 },
        { header: "ลาป่วยโควต้า", key: "sickQuota", width: 14 },
        { header: "ลาป่วยใช้ไป", key: "sickUsed", width: 14 },
        { header: "ลาป่วยคงเหลือ", key: "sickRemaining", width: 16 },
        { header: "ลากิจโควต้า", key: "personalQuota", width: 14 },
        { header: "ลากิจใช้ไป", key: "personalUsed", width: 14 },
        { header: "ลากิจคงเหลือ", key: "personalRemaining", width: 16 },
        { header: "พักร้อนโควต้า", key: "vacationQuota", width: 16 },
        { header: "พักร้อนใช้ไป", key: "vacationUsed", width: 16 },
        { header: "พักร้อนคงเหลือ", key: "vacationRemaining", width: 18 },
        { header: "รวมใช้ไป", key: "totalUsed", width: 12 },
        { header: "รวมคงเหลือ", key: "totalRemaining", width: 14 },
        { header: "เกินสิทธิ์", key: "overQuotaDays", width: 12 },
        { header: "วันลารออนุมัติ", key: "pendingDays", width: 18 },
        { header: "จำนวนคำขออนุมัติแล้ว", key: "approvedRequestCount", width: 22 },
        { header: "จำนวนคำขอรออนุมัติ", key: "pendingRequestCount", width: 22 },
        { header: "จำนวนคำขอไม่อนุมัติ/ยกเลิก", key: "inactiveRequestCount", width: 28 },
        { header: "จำนวนรายการไม่ได้ใช้วันลา", key: "notTakenCount", width: 26 },
        { header: "วันที่ลาล่าสุด", key: "latestApprovedDate", width: 16 },
    ];
}

function getDetailColumns(): Partial<ExcelJS.Column>[] {
    return [
        { header: "ลำดับ", key: "sequence", width: 8 },
        { header: "ชื่อ-นามสกุล", key: "employeeName", width: 28 },
        { header: "แผนก", key: "department", width: 20 },
        { header: "ตำแหน่ง", key: "position", width: 24 },
        { header: "ประเภทการลา", key: "leaveType", width: 16 },
        { header: "วันที่เริ่ม", key: "startDate", width: 14 },
        { header: "วันที่สิ้นสุด", key: "endDate", width: 14 },
        { header: "ช่วงเวลา", key: "period", width: 16 },
        { header: "สถานะ", key: "status", width: 16 },
        { header: "จำนวนวันตามคำขอ", key: "requestedDays", width: 18 },
        { header: "วันลาสุทธิที่นับใช้", key: "effectiveDays", width: 20 },
        { header: "วันเกินสิทธิ์", key: "overQuotaDays", width: 14 },
        { header: "เหตุผลการลา", key: "reason", width: 32 },
        { header: "เหตุผลฉุกเฉิน", key: "emergencyReason", width: 28 },
        { header: "เหตุผลพิเศษ", key: "specialReason", width: 28 },
        { header: "เหตุผลไม่อนุมัติ", key: "rejectReason", width: 28 },
        { header: "โน๊ตไม่ได้ใช้วันลา", key: "notTakenReason", width: 28 },
        { header: "วันที่ยื่น", key: "createdAt", width: 14 },
    ];
}
