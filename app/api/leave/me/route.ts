import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ALL_LEAVE_TYPES, DEFAULT_LEAVE_QUOTAS } from "@/constants/leave";
import { getEmployeeIdFromUserId } from "@/lib/services/leave/get-employee-id";

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
        }

        const userId = Number(session.user.id);
        if (isNaN(userId)) {
            return NextResponse.json(
                { error: "Invalid user ID" },
                { status: 400 },
            );
        }

        const employeeId = await getEmployeeIdFromUserId(userId);
        if (!employeeId) {
            return NextResponse.json(
                { error: "ไม่พบข้อมูลพนักงานที่เชื่อมกับบัญชีนี้" },
                { status: 404 },
            );
        }

        const currentYear = new Date().getFullYear();

        // Auto-create missing quotas for the current year
        const existingQuotas = await prisma.leaveQuota.findMany({
            where: { employeeId, year: currentYear },
        });

        const existingTypes = new Set(existingQuotas.map((q) => q.leaveType));
        const missingTypes = ALL_LEAVE_TYPES.filter(
            (t) => !existingTypes.has(t),
        );

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

        // Re-fetch to get complete set (existing + newly created)
        const quotas =
            missingTypes.length > 0
                ? await prisma.leaveQuota.findMany({
                      where: { employeeId, year: currentYear },
                  })
                : existingQuotas;

        // Pagination setup
        const url = new URL(req.url);
        const page = parseInt(url.searchParams.get("page") || "1");
        const limit = parseInt(url.searchParams.get("limit") || "10");
        const skip = (page - 1) * limit;

        // Fetch Leave History with pagination
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
            prisma.leaveRequest.count({
                 where: { employeeId }
            })
        ]);

        const totalPages = Math.ceil(totalCount / limit);

        return NextResponse.json({ 
            quotas, 
            history, 
            metadata: {
                 currentPage: page,
                 totalPages,
                 totalItems: totalCount,
                 itemsPerPage: limit
            }
        });
    } catch (error) {
        console.error("Error fetching leave data:", error);
        return NextResponse.json(
            { error: "Failed to fetch leave data" },
            { status: 500 },
        );
    }
}
