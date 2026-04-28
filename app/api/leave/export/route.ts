import { after, type NextRequest, NextResponse } from "next/server";

import { logDataExport } from "@/lib/audit";
import { generateFilename } from "@/lib/helpers/date-helpers";
import {
    LEAVE_PERIOD_TH,
    LEAVE_STATUS_TH,
    LEAVE_TYPE_TH,
} from "@/lib/helpers/csv-helpers";
import { prisma } from "@/lib/prisma";
import { createCsvDownloadResponse, encodeCsvRow } from "@/lib/server/csv";
import { getApiAuthSession } from "@/lib/server-auth";
import { getEmployeeIdFromUserId } from "@/lib/services/leave/get-employee-id";
import { EXPORT_LIMITS } from "@/lib/ssot/exports";
import { jsonError, operationFailed, unauthorized } from "@/lib/ssot/http";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";
import type { LeaveStatus } from "@prisma/client";

const PROCESSED_LEAVE_STATUSES: LeaveStatus[] = [
    "APPROVED",
    "REJECTED",
    "CANCELLED",
];

function createYearRange(year: number): { startOfYear: Date; endOfYear: Date } {
    return {
        startOfYear: new Date(`${year}-01-01T00:00:00.000Z`),
        endOfYear: new Date(`${year + 1}-01-01T00:00:00.000Z`),
    };
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

        const managerId = await getEmployeeIdFromUserId(userId);
        if (!managerId) {
            return operationFailed(404);
        }

        const url = new URL(request.url);
        const yearParam = url.searchParams.get("year");
        const yearsOnly = url.searchParams.get("yearsOnly") === "1";
        const metaOnly = url.searchParams.get("metaOnly") === "1";
        const format = url.searchParams.get("format");
        const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

        if (yearsOnly) {
            const rows = await prisma.leaveRequest.findMany({
                where: {
                    approverId: managerId,
                    status: { in: PROCESSED_LEAVE_STATUSES },
                },
                select: { startDate: true },
                distinct: ["startDate"],
            });
            const yearSet = new Set(rows.map((row) => new Date(row.startDate).getFullYear()));
            yearSet.add(new Date().getFullYear());
            const years = Array.from(yearSet).sort((a, b) => b - a);

            return NextResponse.json({ years });
        }

        if (Number.isNaN(year) || year < 2000 || year > 2100) {
            return jsonError("ปีที่ต้องการส่งออกไม่ถูกต้อง", 400);
        }

        const { startOfYear, endOfYear } = createYearRange(year);
        const where = {
            approverId: managerId,
            startDate: {
                gte: startOfYear,
                lt: endOfYear,
            },
            status: { in: PROCESSED_LEAVE_STATUSES },
        };

        const recordCount = await prisma.leaveRequest.count({ where });

        if (metaOnly) {
            return NextResponse.json({
                count: recordCount,
                maxRows: EXPORT_LIMITS.leave.maxRows,
            });
        }

        if (recordCount > EXPORT_LIMITS.leave.maxRows) {
            return jsonError(
                `ส่งออกข้อมูลการลาได้ไม่เกิน ${EXPORT_LIMITS.leave.maxRows} รายการต่อครั้ง กรุณาเลือกปีที่มีข้อมูลน้อยลง`,
                400,
                {
                    maxRows: EXPORT_LIMITS.leave.maxRows,
                    recordCount,
                },
            );
        }

        const orderBy = [
            { employee: { firstName: "asc" as const } },
            { startDate: "asc" as const },
            { id: "asc" as const },
        ];
        const select = {
            employee: {
                select: {
                    firstName: true,
                    lastName: true,
                    nickname: true,
                    position: true,
                    dept: { select: { name: true } },
                },
            },
            leaveType: true,
            startDate: true,
            endDate: true,
            period: true,
            durationDays: true,
            reason: true,
            status: true,
            createdAt: true,
        };

        if (format === "csv") {
            after(async () => {
                try {
                    await logDataExport("LeaveRequest", userId, session.user.email || "", {
                        metadata: {
                            entityType: "LeaveRequest",
                            recordCount,
                            filters: { year },
                            exportedAt: new Date().toISOString(),
                        },
                    });
                } catch (error) {
                    console.error("Failed to log leave export audit:", error);
                }
            });

            return createCsvDownloadResponse(
                generateFilename(`รายงานการลา_ปี-${year}`, "csv"),
                async (controller) => {
                    controller.enqueue(
                        encodeCsvRow([
                            "ลำดับ",
                            "ชื่อ-นามสกุล",
                            "แผนก",
                            "ตำแหน่ง",
                            "ประเภทการลา",
                            "วันที่เริ่ม",
                            "วันที่สิ้นสุด",
                            "ช่วงเวลา",
                            "จำนวนวัน",
                            "เหตุผล",
                            "สถานะ",
                            "วันที่ยื่น",
                        ]),
                    );

                    for (
                        let offset = 0;
                        offset < recordCount;
                        offset += EXPORT_LIMITS.leave.batchSize
                    ) {
                        const leaveRequests = await prisma.leaveRequest.findMany({
                            where,
                            orderBy,
                            select,
                            skip: offset,
                            take: EXPORT_LIMITS.leave.batchSize,
                        });

                        for (const [index, leaveRequest] of leaveRequests.entries()) {
                            const nickname = leaveRequest.employee.nickname
                                ? ` (${leaveRequest.employee.nickname})`
                                : "";

                            controller.enqueue(
                                encodeCsvRow([
                                    offset + index + 1,
                                    `${leaveRequest.employee.firstName} ${leaveRequest.employee.lastName}${nickname}`,
                                    leaveRequest.employee.dept?.name ?? "-",
                                    leaveRequest.employee.position,
                                    LEAVE_TYPE_TH[leaveRequest.leaveType] ?? leaveRequest.leaveType,
                                    leaveRequest.startDate.toLocaleDateString("th-TH"),
                                    leaveRequest.endDate.toLocaleDateString("th-TH"),
                                    LEAVE_PERIOD_TH[leaveRequest.period] ?? leaveRequest.period,
                                    leaveRequest.durationDays,
                                    leaveRequest.reason,
                                    LEAVE_STATUS_TH[leaveRequest.status] ?? leaveRequest.status,
                                    leaveRequest.createdAt.toLocaleDateString("th-TH"),
                                ]),
                            );
                        }
                    }
                },
            );
        }

        const leaveRequests = await prisma.leaveRequest.findMany({
            where,
            orderBy,
            select,
        });

        return NextResponse.json({ data: leaveRequests, year, count: leaveRequests.length });
    } catch (error) {
        console.error("Leave export error:", error);
        return operationFailed(500);
    }
}
