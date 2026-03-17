import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getEmployeeIdFromUserId } from "@/lib/services/leave/get-employee-id";

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = Number(session.user.id);
        if (isNaN(userId)) {
            return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
        }

        const managerId = await getEmployeeIdFromUserId(userId);
        if (!managerId) {
            return NextResponse.json(
                { error: "ไม่พบข้อมูลพนักงานที่เชื่อมกับบัญชีนี้" },
                { status: 404 }
            );
        }

        // Parse year filter from query — default to current year
        const url = new URL(req.url);
        const yearParam = url.searchParams.get("year");
        const yearsOnly = url.searchParams.get("yearsOnly") === "1";
        const year = yearParam ? parseInt(yearParam) : new Date().getFullYear();

        // Return list of distinct years that have leave data for this manager's team
        if (yearsOnly) {
            const rows = await prisma.leaveRequest.findMany({
                where: { approverId: managerId },
                select: { startDate: true },
                distinct: ["startDate"],
            });
            const yearSet = new Set(rows.map((r) => new Date(r.startDate).getFullYear()));
            // Always include current year even if no data yet
            yearSet.add(new Date().getFullYear());
            const years = Array.from(yearSet).sort((a, b) => b - a); // Descending
            return NextResponse.json({ years });
        }

        if (isNaN(year) || year < 2000 || year > 2100) {
            return NextResponse.json({ error: "ปีไม่ถูกต้อง" }, { status: 400 });
        }

        // Date range for the selected year (in UTC-friendly way)
        const startOfYear = new Date(`${year}-01-01T00:00:00.000Z`);
        const endOfYear = new Date(`${year + 1}-01-01T00:00:00.000Z`);

        // Fetch all leave requests for the manager's team for the given year
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
        return NextResponse.json(
            { error: "เกิดข้อผิดพลาดในการดึงข้อมูล" },
            { status: 500 }
        );
    }
}
