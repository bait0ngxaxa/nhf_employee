import { prisma } from "@/lib/db/prisma";
import { generateFilename } from "@/lib/helpers/date-helpers";
import { createXlsxDownloadResponse } from "@/lib/server/xlsx";
import { createEmployeeExportWorkbook, type EmployeeExportRow } from "./employee-workbook";
import { getEmployeeEmailStatus, getEmployeeStatusLabel } from "../../domain/identity";
import {
    calculateEmploymentTenure,
    formatEmploymentHireDate,
    formatEmploymentTenure,
} from "../../domain/tenure";
import {
    EMPLOYEE_EXPORT_BATCH_SIZE,
    EMPLOYEE_EXPORT_MAX_ROWS,
} from "../../application/constants";
import type { EmployeeFilters } from "../../application/types";
import { createEmployeeWhereClause } from "../persistence/employee-queries";

export type EmployeeExportPreparation =
    | { status: "limit-exceeded"; recordCount: number; maxRows: number }
    | {
        status: "ready";
        recordCount: number;
        response: Response;
        auditFilters: { search: string | null; status: string | null };
    };

function sanitizeFilenamePart(value: string): string {
    return value.replace(/[\\/:*?"<>|]+/g, "-").trim();
}

function buildEmployeeExportFilename(filters: EmployeeFilters): string {
    const searchSuffix = filters.search
        ? `_ค้นหา-${sanitizeFilenamePart(filters.search)}`
        : "";
    const statusSuffix = filters.status && filters.status !== "all"
        ? `_สถานะ-${sanitizeFilenamePart(getEmployeeStatusLabel(filters.status))}`
        : "";
    return generateFilename(`รายชื่อพนักงาน${searchSuffix}${statusSuffix}`, "xlsx");
}

export async function createEmployeeExport(
    filters: EmployeeFilters,
): Promise<EmployeeExportPreparation> {
    const where = createEmployeeWhereClause(filters);
    const recordCount = await prisma.employee.count({ where });
    if (recordCount > EMPLOYEE_EXPORT_MAX_ROWS) {
        return { status: "limit-exceeded", recordCount, maxRows: EMPLOYEE_EXPORT_MAX_ROWS };
    }

    const rows: EmployeeExportRow[] = [];
    const asOfDate = new Date();
    for (let offset = 0; offset < recordCount; offset += EMPLOYEE_EXPORT_BATCH_SIZE) {
        const employees = await prisma.employee.findMany({
            where,
            select: {
                firstName: true,
                lastName: true,
                nickname: true,
                position: true,
                affiliation: true,
                email: true,
                phone: true,
                hireDate: true,
                status: true,
                dept: { select: { name: true } },
            },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            skip: offset,
            take: EMPLOYEE_EXPORT_BATCH_SIZE,
        });
        for (const [index, employee] of employees.entries()) {
            rows.push([
                offset + index + 1,
                employee.firstName,
                employee.lastName,
                employee.nickname || "-",
                employee.position,
                employee.affiliation || "-",
                employee.dept?.name || "-",
                getEmployeeEmailStatus(employee.email) === "temp" ? "-" : employee.email,
                employee.phone || "-",
                getEmployeeStatusLabel(employee.status),
                formatEmploymentHireDate(employee.hireDate),
                formatEmploymentTenure(
                    calculateEmploymentTenure(employee.hireDate, asOfDate),
                ),
            ]);
        }
    }
    const response = await createXlsxDownloadResponse(
        buildEmployeeExportFilename(filters),
        createEmployeeExportWorkbook(rows),
    );

    return {
        status: "ready",
        recordCount,
        response,
        auditFilters: {
            search: filters.search || null,
            status: filters.status && filters.status !== "all" ? filters.status : null,
        },
    };
}
