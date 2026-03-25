import { type NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getApiAuthSession } from "@/lib/server-auth";
import { getEmployeeIdFromUserId } from "@/lib/services/leave/get-employee-id";
import { operationFailed, unauthorized } from "@/lib/ssot/http";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";

export async function GET(req: NextRequest): Promise<NextResponse> {
    try {
        const session = await getApiAuthSession();
        if (!session?.user?.id) {
            return unauthorized();
        }

        const userId = Number(session.user.id);
        if (isNaN(userId)) {
            return NextResponse.json({ error: COMMON_API_MESSAGES.invalidUserId }, { status: 400 });
        }

        const managerId = await getEmployeeIdFromUserId(userId);
        if (!managerId) {
            return operationFailed(404);
        }

        const url = new URL(req.url);
        const yearParam = url.searchParams.get("year");
        const yearsOnly = url.searchParams.get("yearsOnly") === "1";
        const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

        if (yearsOnly) {
            const rows = await prisma.leaveRequest.findMany({
                where: { approverId: managerId },
                select: { startDate: true },
                distinct: ["startDate"],
            });
            const yearSet = new Set(rows.map((r) => new Date(r.startDate).getFullYear()));
            yearSet.add(new Date().getFullYear());
            const years = Array.from(yearSet).sort((a, b) => b - a);
            return NextResponse.json({ years });
        }

        if (isNaN(year) || year < 2000 || year > 2100) {
            return operationFailed(400);
        }

        const startOfYear = new Date(`${year}-01-01T00:00:00.000Z`);
        const endOfYear = new Date(`${year + 1}-01-01T00:00:00.000Z`);

        const leaveRequests = await prisma.leaveRequest.findMany({
            where: {
                approverId: managerId,
                startDate: {
                    gte: startOfYear,
                    lt: endOfYear,
                },
            },
            orderBy: [
                { employee: { firstName: "asc" } },
                { startDate: "asc" },
            ],
            include: {
                employee: {
                    select: {
                        firstName: true,
                        lastName: true,
                        nickname: true,
                        position: true,
                        dept: { select: { name: true } },
                    },
                },
            },
        });

        return NextResponse.json({ data: leaveRequests, year, count: leaveRequests.length });
    } catch (error) {
        console.error("Leave export error:", error);
        return operationFailed(500);
    }
}
