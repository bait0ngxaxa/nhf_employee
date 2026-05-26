import { NextResponse } from "next/server";

import { requireApiSession } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getEmployeeIdFromUserId } from "@/lib/services/leave/get-employee-id";
import { operationFailed } from "@/lib/ssot/http";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";

export async function GET(): Promise<NextResponse> {
    try {
        const auth = await requireApiSession();
        if (!auth.ok) return auth.response;

        const userId = Number(auth.session.user.id);
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
