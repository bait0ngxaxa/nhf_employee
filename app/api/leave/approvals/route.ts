import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getApiAuthSession } from "@/lib/server-auth";
import { getEmployeeIdFromUserId } from "@/lib/services/leave/get-employee-id";
import { operationFailed, unauthorized } from "@/lib/ssot/http";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";

export async function GET(): Promise<NextResponse> {
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

        const pendingApprovals = await prisma.leaveRequest.findMany({
            where: {
                approverId: managerId,
                status: "PENDING",
            },
            take: 50,
            orderBy: {
                createdAt: "asc",
            },
            include: {
                employee: {
                    select: {
                        firstName: true,
                        lastName: true,
                        nickname: true,
                        position: true,
                        departmentId: true,
                        dept: {
                            select: {
                                name: true,
                            },
                        },
                    },
                },
            },
        });

        const approvalHistory = await prisma.leaveRequest.findMany({
            where: {
                approverId: managerId,
                status: {
                    in: ["APPROVED", "REJECTED"],
                },
            },
            orderBy: {
                updatedAt: "desc",
            },
            take: 20,
            include: {
                employee: {
                    select: {
                        firstName: true,
                        lastName: true,
                        nickname: true,
                        position: true,
                    },
                },
            },
        });

        return NextResponse.json({
            pending: pendingApprovals,
            history: approvalHistory,
        });
    } catch (error) {
        console.error("Error fetching leave approvals:", error);
        return NextResponse.json(
            { error: COMMON_API_MESSAGES.failedToFetchApprovals },
            { status: 500 },
        );
    }
}
