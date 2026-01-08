import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET - Retrieve audit logs (Admin only)
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session || session.user?.role !== "ADMIN") {
            return NextResponse.json(
                { error: "ไม่มีสิทธิ์เข้าถึง" },
                { status: 403 }
            );
        }

        const { searchParams } = new URL(request.url);
        const action = searchParams.get("action");
        const entityType = searchParams.get("entityType");
        const userId = searchParams.get("userId");
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "20");

        // Build where clause
        const where: Record<string, unknown> = {};

        if (action) {
            where.action = action;
        }

        if (entityType) {
            where.entityType = entityType;
        }

        if (userId) {
            where.userId = parseInt(userId);
        }

        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) {
                (where.createdAt as Record<string, unknown>).gte = new Date(
                    startDate
                );
            }
            if (endDate) {
                (where.createdAt as Record<string, unknown>).lte = new Date(
                    endDate
                );
            }
        }

        const skip = (page - 1) * limit;

        const [auditLogs, totalCount] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
                orderBy: {
                    createdAt: "desc",
                },
                skip,
                take: limit,
            }),
            prisma.auditLog.count({ where }),
        ]);

        // Parse details JSON for each log
        const logsWithParsedDetails = auditLogs.map((log) => ({
            ...log,
            details: log.details ? JSON.parse(log.details) : null,
        }));

        return NextResponse.json(
            {
                auditLogs: logsWithParsedDetails,
                pagination: {
                    page,
                    limit,
                    total: totalCount,
                    pages: Math.ceil(totalCount / limit),
                },
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("Error fetching audit logs:", error);
        return NextResponse.json(
            { error: "เกิดข้อผิดพลาดในการดึงข้อมูล" },
            { status: 500 }
        );
    }
}
