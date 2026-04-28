import { after, type NextRequest, NextResponse } from "next/server";

import { logDataExport } from "@/lib/audit";
import { generateFilename } from "@/lib/helpers/date-helpers";
import {
    getEmployeeEmailStatus,
    getEmployeeStatusLabel,
} from "@/lib/helpers/employee-helpers";
import { prisma } from "@/lib/prisma";
import { createCsvDownloadResponse, encodeCsvRow } from "@/lib/server/csv";
import { getApiAuthSession } from "@/lib/server-auth";
import { createEmployeeWhereClause } from "@/lib/services/employee/queries";
import type { EmployeeFilters } from "@/lib/services/employee/types";
import { EXPORT_LIMITS } from "@/lib/ssot/exports";
import { jsonError, unauthorized } from "@/lib/ssot/http";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";
import { employeeFiltersSchema } from "@/lib/validations/employee";

function parseExportFilters(
    url: string,
): { success: true; data: EmployeeFilters } | { success: false; response: NextResponse } {
    const { searchParams } = new URL(url);
    // Only parse search/status filters — export manages its own batching via EXPORT_LIMITS
    const parsed = employeeFiltersSchema.safeParse({
        search: searchParams.get("search") || undefined,
        status: searchParams.get("status") || undefined,
    });

    if (!parsed.success) {
        return {
            success: false,
            response: jsonError(COMMON_API_MESSAGES.invalidInput, 400, {
                details: parsed.error.flatten().fieldErrors,
            }),
        };
    }

    return { success: true, data: parsed.data };
}

function sanitizeFilenamePart(value: string): string {
    return value.replace(/[\\/:*?"<>|]+/g, "-").trim();
}

function buildEmployeeExportFilename(filters: EmployeeFilters): string {
    const searchSuffix = filters.search
        ? `_ค้นหา-${sanitizeFilenamePart(filters.search)}`
        : "";
    const statusSuffix =
        filters.status && filters.status !== "all"
            ? `_สถานะ-${sanitizeFilenamePart(
                  getEmployeeStatusLabel(filters.status),
              )}`
            : "";

    return generateFilename(`รายชื่อพนักงาน${searchSuffix}${statusSuffix}`, "csv");
}

export async function GET(request: NextRequest): Promise<Response> {
    try {
        const session = await getApiAuthSession();

        if (!session?.user?.id) {
            return unauthorized();
        }

        const userId = Number(session.user.id);
        if (Number.isNaN(userId)) {
            return NextResponse.json(
                { error: COMMON_API_MESSAGES.invalidUserId },
                { status: 400 },
            );
        }

        const parsedFilters = parseExportFilters(request.url);
        if (!parsedFilters.success) {
            return parsedFilters.response;
        }

        const filters = parsedFilters.data;
        const where = createEmployeeWhereClause(filters);
        const recordCount = await prisma.employee.count({ where });

        if (recordCount > EXPORT_LIMITS.employee.maxRows) {
            return jsonError(
                `ส่งออกข้อมูลพนักงานได้ไม่เกิน ${EXPORT_LIMITS.employee.maxRows} รายการต่อครั้ง กรุณากรองข้อมูลเพิ่มเติม`,
                400,
                {
                    maxRows: EXPORT_LIMITS.employee.maxRows,
                    recordCount,
                },
            );
        }

        after(async () => {
            try {
                await logDataExport("Employee", userId, session.user.email || "", {
                    metadata: {
                        entityType: "Employee",
                        recordCount,
                        filters: {
                            search: filters.search || null,
                            status:
                                filters.status && filters.status !== "all"
                                    ? filters.status
                                    : null,
                        },
                        exportedAt: new Date().toISOString(),
                    },
                });
            } catch (error) {
                console.error("Failed to log employee export audit:", error);
            }
        });

        const filename = buildEmployeeExportFilename(filters);

        return createCsvDownloadResponse(filename, async (controller) => {
            controller.enqueue(
                encodeCsvRow([
                    "ลำดับ",
                    "ชื่อ",
                    "นามสกุล",
                    "ชื่อเล่น",
                    "ตำแหน่ง",
                    "สังกัด",
                    "แผนก",
                    "อีเมล",
                    "เบอร์โทร",
                    "สถานะ",
                ]),
            );

            for (
                let offset = 0;
                offset < recordCount;
                offset += EXPORT_LIMITS.employee.batchSize
            ) {
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
                        status: true,
                        dept: {
                            select: {
                                name: true,
                            },
                        },
                    },
                    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
                    skip: offset,
                    take: EXPORT_LIMITS.employee.batchSize,
                });

                for (const [index, employee] of employees.entries()) {
                    controller.enqueue(
                        encodeCsvRow([
                            offset + index + 1,
                            employee.firstName,
                            employee.lastName,
                            employee.nickname || "-",
                            employee.position,
                            employee.affiliation || "-",
                            employee.dept?.name || "-",
                            getEmployeeEmailStatus(employee.email) === "temp"
                                ? "-"
                                : employee.email,
                            employee.phone || "-",
                            getEmployeeStatusLabel(employee.status),
                        ]),
                    );
                }
            }
        });
    } catch (error) {
        console.error("Employee export error:", error);
        return jsonError("ไม่สามารถส่งออกข้อมูลพนักงานได้", 500);
    }
}
