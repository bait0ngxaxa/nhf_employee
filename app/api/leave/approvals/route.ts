import { NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
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

        const employeeInclude = {
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
        } as const;

        const [pendingApprovals, notTakenPending, approvalHistory] = await Promise.all([
            prisma.leaveRequest.findMany({
                where: {
                    approverId: managerId,
                    status: "PENDING",
                },
                take: 50,
                orderBy: {
                    createdAt: "asc",
                },
                include: employeeInclude,
            }),
            prisma.leaveRequest.findMany({
                where: {
                    approverId: managerId,
                    status: "APPROVED",
                    notTakenRequestedAt: { not: null },
                    notTakenConfirmedAt: null,
                },
                take: 50,
                orderBy: {
                    notTakenRequestedAt: "asc",
                },
                include: employeeInclude,
            }),
            prisma.leaveRequest.findMany({
                where: {
                    approverId: managerId,
                    OR: [
                        { status: { in: ["REJECTED", "NOT_TAKEN"] } },
                        {
                            status: "APPROVED",
                            OR: [
                                { notTakenRequestedAt: null },
                                { notTakenConfirmedAt: { not: null } },
                            ],
                        },
                    ],
                },
                orderBy: {
                    updatedAt: "desc",
                },
                take: 20,
                include: employeeInclude,
            }),
        ]);

        return NextResponse.json({
            pending: pendingApprovals,
            notTakenPending,
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
