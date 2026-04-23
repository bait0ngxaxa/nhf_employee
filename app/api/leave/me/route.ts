import { NextResponse } from "next/server";

import { ALL_LEAVE_TYPES, DEFAULT_LEAVE_QUOTAS } from "@/constants/leave";
import { prisma } from "@/lib/prisma";
import { getEmployeeIdFromUserId } from "@/lib/services/leave/get-employee-id";
import { getApiAuthSession } from "@/lib/server-auth";
import { jsonError, unauthorized } from "@/lib/ssot/http";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";

const LEAVE_PAGINATION_MESSAGES = {
    invalidPage: "หมายเลขหน้าต้องเป็นจำนวนเต็มที่มากกว่าหรือเท่ากับ 1",
    invalidLimit: "จำนวนรายการต่อหน้าต้องอยู่ระหว่าง 1 ถึง 50",
} as const;

export async function GET(req: Request) {
    try {
        const session = await getApiAuthSession();
        if (!session?.user?.id) {
            return unauthorized();
        }

        const userId = Number(session.user.id);
        if (Number.isNaN(userId)) {
            return jsonError(COMMON_API_MESSAGES.invalidUserId, 400);
        }

        const employeeId = await getEmployeeIdFromUserId(userId);
        if (!employeeId) {
            return jsonError(COMMON_API_MESSAGES.operationFailed, 404);
        }

        const currentYear = new Date().getFullYear();
        const existingQuotas = await prisma.leaveQuota.findMany({
            where: { employeeId, year: currentYear },
        });

        const existingTypes = new Set(existingQuotas.map((q) => q.leaveType));
        const missingTypes = ALL_LEAVE_TYPES.filter((type) => !existingTypes.has(type));

        if (missingTypes.length > 0) {
            await prisma.leaveQuota.createMany({
                data: missingTypes.map((leaveType) => ({
                    employeeId,
                    year: currentYear,
                    leaveType,
                    totalDays: DEFAULT_LEAVE_QUOTAS[leaveType],
                    usedDays: 0,
                })),
                skipDuplicates: true,
            });
        }

        const quotas =
            missingTypes.length > 0
                ? await prisma.leaveQuota.findMany({ where: { employeeId, year: currentYear } })
                : existingQuotas;

        const url = new URL(req.url);
        const page = Number.parseInt(url.searchParams.get("page") || "1", 10);
        const limit = Number.parseInt(url.searchParams.get("limit") || "10", 10);

        if (!Number.isInteger(page) || page < 1) {
            return jsonError(LEAVE_PAGINATION_MESSAGES.invalidPage, 400);
        }
        if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
            return jsonError(LEAVE_PAGINATION_MESSAGES.invalidLimit, 400);
        }

        const skip = (page - 1) * limit;

        const [history, totalCount] = await Promise.all([
            prisma.leaveRequest.findMany({
                where: { employeeId },
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
                include: {
                    approver: {
                        select: {
                            firstName: true,
                            lastName: true,
                            nickname: true,
                        },
                    },
                },
            }),
            prisma.leaveRequest.count({ where: { employeeId } }),
        ]);

        return NextResponse.json({
            quotas,
            history,
            metadata: {
                currentPage: page,
                totalPages: Math.ceil(totalCount / limit),
                totalItems: totalCount,
                itemsPerPage: limit,
            },
        });
    } catch (error) {
        console.error("Error fetching leave data:", error);
        return jsonError(COMMON_API_MESSAGES.failedToFetchLeaveData, 500);
    }
}
